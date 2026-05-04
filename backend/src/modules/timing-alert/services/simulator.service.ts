import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  TimingAlertSimulation,
  TimingAlertSimulationDocument,
  SimulationCourse,
  SimulationStatus,
  SimulationScenario,
  ScenarioType,
} from '../schemas/timing-alert-simulation.schema';
import { applyScenarios } from './scenario-engine';
import {
  TimingAlertSimulationSnapshot,
  TimingAlertSimulationSnapshotDocument,
} from '../schemas/timing-alert-simulation-snapshot.schema';
import { RaceResultApiService } from '../../race-result/services/race-result-api.service';
import { RaceResultApiItem } from '../../race-result/types/race-result-api.types';
import { parseTimeToSeconds } from '../utils/parsed-athlete';

/**
 * Phase 2 — Race Timing Simulator.
 *
 * **Use case (Danny 2026-05-03):**
 * "Giả lập data realtime của 1 cuộc đua như thật, vì có khi tao cần test
 * nhiều lần... Cho phép gen ra API như này luôn để gán vào course chạy
 * như là RR đang truyền data thật luôn"
 *
 * **Architecture:**
 * 1. BTC tạo simulation, paste 4 RR URLs (5K/10K/21K/42K)
 * 2. Service fetch snapshot 1 lần → store Mongo
 * 3. BTC nhận lại 4 URL public dạng `/api/timing-alert/simulator-data/{simCourseId}`
 * 4. BTC paste vào `course.apiUrl` của race test
 * 5. Click Play → simulation clock chạy, public endpoint serve filtered chiptimes
 *
 * **Replay model:**
 * - `accumulatedSeconds` = elapsed simulation time trước resume hiện tại
 * - Status `running` → currentSimSeconds = accumulatedSeconds +
 *   (now - startedAt) × speedFactor + startOffsetSeconds
 * - Public serve filter: keep checkpoint times ≤ currentSimSeconds
 *
 * **Why not just hardcode JSON files?** Real RR data có vendor quirks
 * (TimingPoint case mixed, Bib=0 fallback cert URL, "-1" sentinel ranks).
 * Replay giúp test miss-detection logic với patterns thật, không phải
 * synthetic happy path.
 */
@Injectable()
export class SimulatorService {
  private readonly logger = new Logger(SimulatorService.name);

  constructor(
    @InjectModel(TimingAlertSimulation.name)
    private readonly simModel: Model<TimingAlertSimulationDocument>,
    @InjectModel(TimingAlertSimulationSnapshot.name)
    private readonly snapshotModel: Model<TimingAlertSimulationSnapshotDocument>,
    private readonly apiService: RaceResultApiService,
  ) {}

  // ─────────── Admin CRUD ───────────

  async list(): Promise<TimingAlertSimulationDocument[]> {
    return this.simModel
      .find({})
      .sort({ created_at: -1 })
      .lean<TimingAlertSimulationDocument[]>()
      .exec();
  }

  async get(id: string): Promise<TimingAlertSimulationDocument> {
    const sim = await this.simModel.findById(id).lean<TimingAlertSimulationDocument>().exec();
    if (!sim) throw new NotFoundException(`Simulation ${id} not found`);
    return sim;
  }

  /**
   * Create simulation + fetch snapshot cho từng course song song.
   *
   * **Idempotent:** nếu re-run cùng name → tạo simulation mới (không
   * dedupe). BTC tự manage list.
   */
  async create(
    input: {
      name: string;
      description?: string;
      speedFactor?: number;
      startOffsetSeconds?: number;
      courses: Array<{ label: string; sourceUrl: string }>;
    },
    userId: string,
  ): Promise<TimingAlertSimulationDocument> {
    if (!input.courses || input.courses.length === 0) {
      throw new BadRequestException('Phải có ít nhất 1 course');
    }
    if (input.courses.some((c) => !c.sourceUrl?.startsWith('http'))) {
      throw new BadRequestException('Mọi sourceUrl phải bắt đầu http(s)://');
    }

    // Generate sim course IDs upfront để snapshot fetch song song
    const courses: SimulationCourse[] = input.courses.map((c) => ({
      simCourseId: this.generateSimCourseId(),
      label: c.label.trim() || 'unnamed',
      sourceUrl: c.sourceUrl.trim(),
      snapshotItems: 0,
    }));

    const sim = await this.simModel.create({
      name: input.name.trim(),
      description: input.description?.trim(),
      speedFactor: input.speedFactor ?? 1.0,
      startOffsetSeconds: input.startOffsetSeconds ?? 0,
      status: 'created',
      accumulatedSeconds: 0,
      courses,
      createdBy: userId,
    });

    // Fetch snapshots song song (fire-and-forget per course để không bottleneck)
    await Promise.all(
      courses.map((c) => this.refreshSnapshot(String(sim._id), c.simCourseId)),
    );

    return this.get(String(sim._id));
  }

  async update(
    id: string,
    patch: {
      name?: string;
      description?: string;
      speedFactor?: number;
      startOffsetSeconds?: number;
    },
  ): Promise<TimingAlertSimulationDocument> {
    const updated = await this.simModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .lean<TimingAlertSimulationDocument>()
      .exec();
    if (!updated) throw new NotFoundException(`Simulation ${id} not found`);
    return updated;
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    const sim = await this.simModel.findById(id).lean().exec();
    if (!sim) return { deleted: false };
    await Promise.all([
      this.simModel.deleteOne({ _id: id }).exec(),
      this.snapshotModel.deleteMany({ simulationId: id }).exec(),
    ]);
    this.logger.log(`[delete] simulation=${id}`);
    return { deleted: true };
  }

  /**
   * Re-fetch RR snapshot cho 1 course (BTC click "Refresh" sau khi RR
   * update data). Update meta `snapshotFetchedAt` + `snapshotItems` +
   * earliest/latest seconds bounds.
   */
  async refreshSnapshot(
    simulationId: string,
    simCourseId: string,
  ): Promise<{ items: number; earliestSeconds: number | null; latestSeconds: number | null }> {
    const sim = await this.simModel.findById(simulationId).exec();
    if (!sim) throw new NotFoundException(`Simulation ${simulationId} not found`);
    const course = sim.courses.find((c) => c.simCourseId === simCourseId);
    if (!course) {
      throw new NotFoundException(
        `Course ${simCourseId} not in simulation ${simulationId}`,
      );
    }

    this.logger.log(
      `[refreshSnapshot] sim=${simulationId} course=${course.label} simCourseId=${maskToken(course.simCourseId)} fetching ${maskUrl(course.sourceUrl)}`,
    );

    let data: RaceResultApiItem[] = [];
    try {
      data = await this.apiService.fetchRaceResults(course.sourceUrl);
    } catch (err) {
      throw new BadRequestException(
        `Fetch RR failed: ${(err as Error).message}`,
      );
    }

    // Compute timing bounds — earliest non-zero "Start" seconds, latest
    // any seconds (for completed-detect heuristic).
    const { earliest, latest } = computeBounds(data);

    await this.snapshotModel
      .findOneAndUpdate(
        { simCourseId },
        {
          $set: {
            simulationId,
            simCourseId,
            data,
            fetchedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    // Update meta in parent simulation
    await this.simModel
      .updateOne(
        { _id: simulationId, 'courses.simCourseId': simCourseId },
        {
          $set: {
            'courses.$.snapshotFetchedAt': new Date(),
            'courses.$.snapshotItems': data.length,
            'courses.$.earliestSeconds': earliest,
            'courses.$.latestSeconds': latest,
          },
        },
      )
      .exec();

    return { items: data.length, earliestSeconds: earliest, latestSeconds: latest };
  }

  // ─────────── Lifecycle controls ───────────

  /**
   * Phase 3 (Manager M3) — atomic lifecycle ops via `findOneAndUpdate`.
   *
   * Trước đây dùng `findById → mutate → save` → 2 admin tab click play/pause
   * cùng lúc → race condition `accumulatedSeconds` doubling (compute elapsed
   * 2 lần, ghi đè nhau). Giờ atomic với precondition status check.
   *
   * **Pattern:** read first cho compute (elapsed needs current state) →
   * conditional update với `status === expectedStatus` → nếu race condition
   * (status đã đổi), update fail no-op + log.
   */
  async play(id: string): Promise<TimingAlertSimulationDocument> {
    const sim = await this.simModel.findById(id).lean<TimingAlertSimulationDocument>().exec();
    if (!sim) throw new NotFoundException(`Simulation ${id} not found`);
    if (sim.status === 'running') return sim;

    const updated = await this.simModel
      .findOneAndUpdate(
        { _id: id, status: { $ne: 'running' } },
        {
          $set: {
            status: 'running',
            startedAt: new Date(),
            pausedAt: null,
          },
        },
        { new: true },
      )
      .lean<TimingAlertSimulationDocument>()
      .exec();
    if (!updated) {
      // Concurrent play — return current state
      return (
        (await this.simModel.findById(id).lean<TimingAlertSimulationDocument>().exec()) ?? sim
      );
    }
    this.logger.log(`[play] simulation=${id} accumulated=${updated.accumulatedSeconds}s`);
    return updated;
  }

  async pause(id: string): Promise<TimingAlertSimulationDocument> {
    const sim = await this.simModel.findById(id).lean<TimingAlertSimulationDocument>().exec();
    if (!sim) throw new NotFoundException(`Simulation ${id} not found`);
    if (sim.status !== 'running') return sim;

    const now = new Date();
    const startedAtMs =
      sim.startedAt instanceof Date
        ? sim.startedAt.getTime()
        : new Date(sim.startedAt as unknown as string).getTime();
    const elapsedRealMs = now.getTime() - startedAtMs;
    const elapsedSimSeconds = (elapsedRealMs / 1000) * sim.speedFactor;
    const newAccumulated = Math.max(0, sim.accumulatedSeconds + elapsedSimSeconds);

    // Precondition check: status === 'running' AND startedAt match
    // (Nếu admin khác đã pause/reset trong khoảng thời gian read→update,
    // condition fail → update no-op tránh double-count elapsed.)
    const updated = await this.simModel
      .findOneAndUpdate(
        { _id: id, status: 'running', startedAt: sim.startedAt },
        {
          $set: {
            accumulatedSeconds: newAccumulated,
            status: 'paused',
            pausedAt: now,
            startedAt: null,
          },
        },
        { new: true },
      )
      .lean<TimingAlertSimulationDocument>()
      .exec();
    if (!updated) {
      this.logger.warn(`[pause] simulation=${id} concurrent state change — skip`);
      return (
        (await this.simModel.findById(id).lean<TimingAlertSimulationDocument>().exec()) ?? sim
      );
    }
    this.logger.log(`[pause] simulation=${id} accumulated=${updated.accumulatedSeconds}s`);
    return updated;
  }

  async reset(id: string): Promise<TimingAlertSimulationDocument> {
    const updated = await this.simModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            accumulatedSeconds: 0,
            status: 'created',
            startedAt: null,
            pausedAt: null,
          },
        },
        { new: true },
      )
      .lean<TimingAlertSimulationDocument>()
      .exec();
    if (!updated) throw new NotFoundException(`Simulation ${id} not found`);
    this.logger.log(`[reset] simulation=${id}`);
    return updated;
  }

  /** Seek tới T (giây) cụ thể — pause + override accumulatedSeconds. Atomic. */
  async seek(id: string, seconds: number): Promise<TimingAlertSimulationDocument> {
    if (seconds < 0) throw new BadRequestException('seconds phải >= 0');
    const updated = await this.simModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            accumulatedSeconds: seconds,
            status: 'paused',
            startedAt: null,
            pausedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean<TimingAlertSimulationDocument>()
      .exec();
    if (!updated) throw new NotFoundException(`Simulation ${id} not found`);
    this.logger.log(`[seek] simulation=${id} → ${seconds}s`);
    return updated;
  }

  // ─────────── Public serve (poll service hits this via apiUrl) ───────────

  /**
   * Trả RR-format JSON array cho 1 simCourseId. Filter Chiptimes theo
   * simulation clock hiện tại.
   *
   * **Performance:**
   * - Lookup snapshot O(1) qua unique index `simCourseId`
   * - Filter in-memory — typically 1000-5000 athletes/course
   * - No cache (poll service auto-cache via Redis if needed; simulator
   *   serve is frequent ~30s but cheap)
   */
  async serve(simCourseId: string): Promise<RaceResultApiItem[]> {
    const snapshot = await this.snapshotModel
      .findOne({ simCourseId })
      .lean<TimingAlertSimulationSnapshotDocument>()
      .exec();
    if (!snapshot) return [];

    const sim = await this.simModel
      .findById(snapshot.simulationId)
      .lean<TimingAlertSimulationDocument>()
      .exec();
    if (!sim) return [];

    const currentSimSeconds = computeCurrentSimSeconds(sim);

    // Find earliest checkpoint time across snapshot to use as baseline.
    // RR Simple API returns absolute "Start" times like "06:00" (clock time
    // of day) — we treat earliest "Start" như sim T=0. Athletes có Start
    // time > earliest (later wave) → only show khi simSeconds đã đủ.
    const baselineSeconds = sim.courses.find(
      (c) => c.simCourseId === simCourseId,
    )?.earliestSeconds;
    const baseline = typeof baselineSeconds === 'number' ? baselineSeconds : 0;

    // Fresh reset state — race CHƯA bắt đầu: cutoff = -1 để mọi checkpoint
    // (kể cả chip Start="00:00" → seconds=0) bị filter ra. Match semantic
    // "race hasn't started yet, no chip reads".
    //
    // Status running/paused với accumulatedSeconds>0: dùng baseline shift
    // bình thường (skip dead time đầu race cho UX demo speedFactor).
    const isFreshReset =
      sim.status === 'created' &&
      (sim.accumulatedSeconds ?? 0) === 0 &&
      currentSimSeconds <= 0;
    const cutoff = isFreshReset ? -1 : baseline + currentSimSeconds;

    const filtered: RaceResultApiItem[] = [];
    for (const item of snapshot.data) {
      const newItem = filterAthlete(item, cutoff);
      filtered.push(newItem);
    }

    // Apply scenarios on top of time-filtered data. Engine deterministic
    // theo hash(simCourseId+bib), KHÔNG mutate snapshot DB.
    const scenarios = sim.scenarios ?? [];
    let postScenario = filtered;
    if (scenarios.length > 0) {
      const result = applyScenarios(filtered, scenarios, simCourseId);
      postScenario = result.items;
    }

    // Re-derive scalar finals (Finished/ChipTime/OverallRank/...) từ
    // Chiptimes/Guntimes SAU scenarios. Lý do: scenarios drop chip keys
    // (vd MISS_FINISH drop Finish key) → nếu giữ scalar từ pre-scenario
    // sẽ inconsistent với chip data. Vendor real RR cũng không bao giờ
    // có OverallRank khi chip Finish empty (without backup logic).
    return postScenario.map((item) => deriveScalarsFromTimes(item));
  }

  // ─────────── Scenarios CRUD ───────────

  async addScenario(
    simulationId: string,
    scenario: Omit<SimulationScenario, 'id'>,
  ): Promise<TimingAlertSimulationDocument> {
    const sim = await this.simModel.findById(simulationId).exec();
    if (!sim) throw new NotFoundException(`Simulation ${simulationId} not found`);
    const id = randomBytes(8).toString('hex');
    sim.scenarios.push({ ...scenario, id } as SimulationScenario);
    await sim.save();
    return sim.toObject() as TimingAlertSimulationDocument;
  }

  async updateScenario(
    simulationId: string,
    scenarioId: string,
    patch: Partial<Omit<SimulationScenario, 'id'>>,
  ): Promise<TimingAlertSimulationDocument> {
    const sim = await this.simModel.findById(simulationId).exec();
    if (!sim) throw new NotFoundException(`Simulation ${simulationId} not found`);
    const sc = sim.scenarios.find((s) => s.id === scenarioId);
    if (!sc) {
      throw new NotFoundException(
        `Scenario ${scenarioId} not in simulation ${simulationId}`,
      );
    }
    Object.assign(sc, patch);
    await sim.save();
    return sim.toObject() as TimingAlertSimulationDocument;
  }

  async deleteScenario(
    simulationId: string,
    scenarioId: string,
  ): Promise<TimingAlertSimulationDocument> {
    const sim = await this.simModel.findById(simulationId).exec();
    if (!sim) throw new NotFoundException(`Simulation ${simulationId} not found`);
    sim.scenarios = sim.scenarios.filter((s) => s.id !== scenarioId);
    await sim.save();
    return sim.toObject() as TimingAlertSimulationDocument;
  }

  /**
   * Get raw snapshot data — bypass time filter + scenarios.
   * Used by discover service để see all vendor keys mà không bị scenarios
   * (MISS_FINISH, MISS_MIDDLE_CP) modify dữ liệu.
   */
  async getRawSnapshot(simCourseId: string): Promise<RaceResultApiItem[]> {
    const snapshot = await this.snapshotModel
      .findOne({ simCourseId })
      .lean<TimingAlertSimulationSnapshotDocument>()
      .exec();
    return snapshot?.data ?? [];
  }

  /** Compute và return current simulation seconds (đọc-only). */
  async getCurrentSimSeconds(simulationId: string): Promise<number> {
    const sim = await this.simModel
      .findById(simulationId)
      .lean<TimingAlertSimulationDocument>()
      .exec();
    if (!sim) throw new NotFoundException(`Simulation ${simulationId} not found`);
    return computeCurrentSimSeconds(sim);
  }

  // ─────────── Helpers ───────────

  private generateSimCourseId(): string {
    return randomBytes(16).toString('hex');
  }
}

// ─────────── Pure helper functions ───────────

/** Mask 32-hex token để log không leak full secret. Show first 8 + ***. */
function maskToken(token: string): string {
  if (!token || token.length < 12) return '***';
  return `${token.slice(0, 8)}***`;
}

/** Mask RR API URL — token portion là 32-char uppercase + digits. */
function maskUrl(url: string): string {
  return url.replace(/\/[A-Z0-9]{32}(\/|$|\?)/g, '/***$1');
}

/**
 * Filter athlete's Chiptimes + Guntimes — KEEP all keys, set value="" cho
 * điểm chưa qua. Match real RR vendor behavior:
 * - Athlete chưa start: 7 keys với value=""
 * - Athlete giữa course: keys đủ, value điền dần
 * - Athlete đã finish: full value
 *
 * **Phase A fix (BR-01):** trước đây drop keys khỏi JSON khi time > cutoff
 * → schema KHÔNG match real RR vendor. Sau fix: keep keys, value="" cho
 * điểm chưa qua. Output JSON shape giống vendor 100%.
 *
 * Áp dụng symmetric cho cả Chiptimes + Guntimes (BR-01 mandate cả 2 fields).
 *
 * Athletes có 0 checkpoint visible vẫn return — Bib + metadata giữ.
 */
function filterAthlete(
  item: RaceResultApiItem,
  cutoffSeconds: number,
): RaceResultApiItem {
  const chip = filterTimesField(item.Chiptimes, cutoffSeconds);
  const gun = filterTimesField(item.Guntimes, cutoffSeconds);

  // TimingPoint = key cuối cùng có value (theo vendor pattern: checkpoint
  // mới nhất athlete vừa qua). Lấy từ Chiptimes vì đây là chip-timed thực
  // tế. Nếu Chiptimes chưa có nhưng Guntimes có → fallback Guntimes.
  const lastKey = chip.lastVisibleKey ?? gun.lastVisibleKey ?? '';

  // Set "checkpoint đã passed" — union(Chiptimes_visible, Guntimes_visible).
  // Các field map khác (Paces, TODs, Sectors, OverallRanks, GenderRanks) chỉ
  // được giữ value tại key thuộc set này; key chưa qua → value="".
  const visibleKeys = new Set<string>([
    ...chip.visibleKeys,
    ...gun.visibleKeys,
  ]);

  // Final scalar results (ChipTime, GunTime, OverallRank, ...) CHỈ valid khi
  // athlete đã cross Finish. Nếu Finish chưa visible → clear toàn bộ scalar
  // final + reset Finished flag → match real RR vendor (athlete chưa finish
  // không có final rank/time).
  const finishKey = ['Finish', 'FINISH'].find((k) => visibleKeys.has(k));
  const finished = finishKey !== undefined;

  return {
    ...item,
    Chiptimes: chip.json ?? item.Chiptimes,
    Guntimes: gun.json ?? item.Guntimes,
    Paces: filterMapField(item.Paces, visibleKeys) ?? item.Paces,
    TODs: filterMapField(item.TODs, visibleKeys) ?? item.TODs,
    Sectors: filterMapField(item.Sectors, visibleKeys) ?? item.Sectors,
    OverallRanks: filterMapField(item.OverallRanks, visibleKeys) ?? item.OverallRanks,
    GenderRanks: filterMapField(item.GenderRanks, visibleKeys) ?? item.GenderRanks,
    TimingPoint: lastKey || (finished ? item.TimingPoint : '') || '',
    // Scalar final results: clear khi chưa Finish. Athletes giữa course không
    // có "final time" — vendor chỉ điền các field này khi cross Finish line.
    ChipTime: finished ? item.ChipTime : '',
    GunTime: finished ? item.GunTime : '',
    Pace: finished ? item.Pace : '',
    OverallRank: finished ? item.OverallRank : 0,
    GenderRank: finished ? item.GenderRank : 0,
    CatRank: finished ? item.CatRank : 0,
    OverrankLive: finished ? item.OverrankLive : 0,
    Gap: finished ? item.Gap : '',
    Certi: finished ? item.Certi : '',
    Certificate: finished ? item.Certificate : '',
    Finished: finished ? 1 : 0,
    Started: visibleKeys.size > 0 ? 1 : 0,
  };
}

/**
 * Re-derive scalar final result fields (Finished, ChipTime, GunTime, Pace,
 * OverallRank, ...) từ chip times hiện tại (post-scenario).
 *
 * Tại sao cần helper này:
 * - filterAthlete chạy TRƯỚC scenarios → scalars dựa theo chip times raw
 * - applyScenarios mutate Chiptimes/Guntimes (vd MISS_FINISH drop Finish)
 *   nhưng KHÔNG đụng scalars → scalars stale, không khớp chip
 * - Helper này re-walk chip Finish trong post-scenario item, clear scalars
 *   nếu Finish chip empty
 *
 * Cũng update Paces/TODs/Sectors/Ranks map fields theo visibleKeys
 * post-scenario (case scenario drop CP giữa course → các map field
 * tương ứng phải cleared theo).
 */
function deriveScalarsFromTimes(item: RaceResultApiItem): RaceResultApiItem {
  // Extract visible keys post-scenario from Chiptimes + Guntimes
  const chipKeys = extractVisibleKeysFromJson(item.Chiptimes);
  const gunKeys = extractVisibleKeysFromJson(item.Guntimes);
  const visibleKeys = new Set<string>([...chipKeys, ...gunKeys]);

  const finishKey = ['Finish', 'FINISH'].find((k) => visibleKeys.has(k));
  const finished = finishKey !== undefined;

  // Last visible CP for TimingPoint (use Chiptimes order preference)
  let lastVisibleKey = '';
  let lastSec = -1;
  const chipParsed = safeParseMap(item.Chiptimes);
  if (chipParsed) {
    for (const [k, v] of Object.entries(chipParsed)) {
      if (!v || typeof v !== 'string' || v.trim().length === 0) continue;
      const s = parseTimeToSeconds(v.trim());
      if (s !== null && s > lastSec) {
        lastSec = s;
        lastVisibleKey = k;
      }
    }
  }

  return {
    ...item,
    Paces: filterMapField(item.Paces, visibleKeys) ?? item.Paces,
    TODs: filterMapField(item.TODs, visibleKeys) ?? item.TODs,
    Sectors: filterMapField(item.Sectors, visibleKeys) ?? item.Sectors,
    OverallRanks: filterMapField(item.OverallRanks, visibleKeys) ?? item.OverallRanks,
    GenderRanks: filterMapField(item.GenderRanks, visibleKeys) ?? item.GenderRanks,
    TimingPoint: lastVisibleKey || (finished ? item.TimingPoint : '') || '',
    ChipTime: finished ? item.ChipTime : '',
    GunTime: finished ? item.GunTime : '',
    Pace: finished ? item.Pace : '',
    OverallRank: finished ? item.OverallRank : 0,
    GenderRank: finished ? item.GenderRank : 0,
    CatRank: finished ? item.CatRank : 0,
    OverrankLive: finished ? item.OverrankLive : 0,
    Gap: finished ? item.Gap : '',
    Certi: finished ? item.Certi : '',
    Certificate: finished ? item.Certificate : '',
    Finished: finished ? 1 : 0,
    Started: visibleKeys.size > 0 ? 1 : 0,
  };
}

/** Helper: parse Chiptimes/Guntimes → set keys with non-empty value. */
function extractVisibleKeysFromJson(raw: string | undefined | null): Set<string> {
  const result = new Set<string>();
  const parsed = safeParseMap(raw);
  if (!parsed) return result;
  for (const [key, val] of Object.entries(parsed)) {
    if (val && typeof val === 'string' && val.trim().length > 0) {
      result.add(key);
    }
  }
  return result;
}

/** Helper: parse JSON map field, return null on error. */
function safeParseMap(raw: string | undefined | null): Record<string, string> | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

/**
 * Filter checkpoint-keyed JSON map (Paces / TODs / Sectors / OverallRanks /
 * GenderRanks). Keep ALL keys (match vendor schema), set value="" cho key
 * KHÔNG thuộc visibleKeys (athlete chưa qua checkpoint đó).
 *
 * Returns null nếu raw không parse được — caller giữ nguyên field gốc.
 */
function filterMapField(
  raw: string | undefined | null,
  visibleKeys: Set<string>,
): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
  } catch {
    return null;
  }
  const filtered: Record<string, string> = {};
  for (const key of Object.keys(parsed)) {
    filtered[key] = visibleKeys.has(key) ? parsed[key] : '';
  }
  return JSON.stringify(filtered);
}

/**
 * Apply filter to 1 times field (Chiptimes hoặc Guntimes).
 *
 * Returns:
 * - `json`: stringified JSON với keys giữ nguyên, value="" cho time > cutoff
 * - `lastVisibleKey`: key cuối cùng có value non-empty (theo time order)
 * - `visibleKeys`: set keys có value non-empty (dùng để filter các field map khác)
 * - Nếu raw không parse được → trả null + empty set fallback caller giữ nguyên
 */
function filterTimesField(
  raw: string | undefined | null,
  cutoffSeconds: number,
): { json: string | null; lastVisibleKey: string | null; visibleKeys: Set<string> } {
  if (!raw || typeof raw !== 'string') {
    return { json: null, lastVisibleKey: null, visibleKeys: new Set() };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { json: null, lastVisibleKey: null, visibleKeys: new Set() };
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { json: null, lastVisibleKey: null, visibleKeys: new Set() };
    }
  } catch {
    return { json: null, lastVisibleKey: null, visibleKeys: new Set() };
  }

  const filtered: Record<string, string> = {};
  const visibleKeys = new Set<string>();
  let lastVisibleKey: string | null = null;
  let lastVisibleSeconds = -1;

  for (const [key, timeStr] of Object.entries(parsed)) {
    // BR-01: keep ALL keys. Set value="" nếu invalid hoặc > cutoff.
    if (!timeStr || typeof timeStr !== 'string') {
      filtered[key] = '';
      continue;
    }
    const trimmedTime = timeStr.trim();
    if (trimmedTime.length === 0) {
      filtered[key] = '';
      continue;
    }
    const seconds = parseTimeToSeconds(trimmedTime);
    if (seconds === null) {
      filtered[key] = '';
      continue;
    }
    if (seconds <= cutoffSeconds) {
      filtered[key] = timeStr;
      visibleKeys.add(key);
      // Track key có time muộn nhất → TimingPoint
      if (seconds > lastVisibleSeconds) {
        lastVisibleSeconds = seconds;
        lastVisibleKey = key;
      }
    } else {
      filtered[key] = ''; // KEY giữ nguyên, value="" — match real RR
    }
  }

  return { json: JSON.stringify(filtered), lastVisibleKey, visibleKeys };
}

/**
 * Compute current simulation seconds dựa status + speedFactor +
 * accumulatedSeconds + startOffsetSeconds.
 */
function computeCurrentSimSeconds(sim: TimingAlertSimulationDocument): number {
  const offset = sim.startOffsetSeconds ?? 0;
  if (sim.status !== 'running') {
    return sim.accumulatedSeconds + offset;
  }
  if (!sim.startedAt) {
    return sim.accumulatedSeconds + offset;
  }
  const elapsedRealMs = Date.now() - new Date(sim.startedAt).getTime();
  const elapsedSimSeconds = (elapsedRealMs / 1000) * (sim.speedFactor ?? 1.0);
  return sim.accumulatedSeconds + elapsedSimSeconds + offset;
}

/** Find earliest + latest checkpoint seconds across snapshot. */
function computeBounds(data: RaceResultApiItem[]): {
  earliest: number | null;
  latest: number | null;
} {
  let earliest: number | null = null;
  let latest: number | null = null;
  for (const item of data) {
    const raw = item.Chiptimes;
    if (!raw || typeof raw !== 'string') continue;
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(raw.trim()) as Record<string, string>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    } catch {
      continue;
    }
    for (const time of Object.values(parsed)) {
      if (!time || typeof time !== 'string') continue;
      const seconds = parseTimeToSeconds(time.trim());
      if (seconds === null || seconds <= 0) continue;
      if (earliest === null || seconds < earliest) earliest = seconds;
      if (latest === null || seconds > latest) latest = seconds;
    }
  }
  return { earliest, latest };
}

// ─────────── Test-only exports (FEATURE-002 TD-008 unit test access) ───────────
// File-local pure functions exposed cho spec test, KHÔNG được dùng ở runtime
// modules khác. Đặt namespace __test__ để dấu hiệu rõ.
export const __test__ = {
  filterAthlete,
  filterMapField,
  filterTimesField,
  deriveScalarsFromTimes,
  extractVisibleKeysFromJson,
  safeParseMap,
};
