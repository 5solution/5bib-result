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
      `[refreshSnapshot] sim=${simulationId} course=${course.label} fetching ${course.sourceUrl}`,
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
   * Start hoặc resume simulation. Set `startedAt = now`, status `running`.
   * `accumulatedSeconds` giữ nguyên — đảm bảo resume đúng vị trí trước.
   */
  async play(id: string): Promise<TimingAlertSimulationDocument> {
    const sim = await this.simModel.findById(id).exec();
    if (!sim) throw new NotFoundException(`Simulation ${id} not found`);
    if (sim.status === 'running') return sim.toObject() as TimingAlertSimulationDocument;

    sim.status = 'running';
    sim.startedAt = new Date();
    sim.pausedAt = null;
    await sim.save();
    this.logger.log(`[play] simulation=${id} accumulated=${sim.accumulatedSeconds}s`);
    return sim.toObject() as TimingAlertSimulationDocument;
  }

  async pause(id: string): Promise<TimingAlertSimulationDocument> {
    const sim = await this.simModel.findById(id).exec();
    if (!sim) throw new NotFoundException(`Simulation ${id} not found`);
    if (sim.status !== 'running') return sim.toObject() as TimingAlertSimulationDocument;

    // Compute elapsed for current run + add to accumulated
    const now = new Date();
    const elapsedRealMs =
      sim.startedAt instanceof Date ? now.getTime() - sim.startedAt.getTime() : 0;
    const elapsedSimSeconds = (elapsedRealMs / 1000) * sim.speedFactor;

    sim.accumulatedSeconds = Math.max(0, sim.accumulatedSeconds + elapsedSimSeconds);
    sim.status = 'paused';
    sim.pausedAt = now;
    sim.startedAt = null;
    await sim.save();
    this.logger.log(`[pause] simulation=${id} accumulated=${sim.accumulatedSeconds}s`);
    return sim.toObject() as TimingAlertSimulationDocument;
  }

  async reset(id: string): Promise<TimingAlertSimulationDocument> {
    const sim = await this.simModel.findById(id).exec();
    if (!sim) throw new NotFoundException(`Simulation ${id} not found`);
    sim.accumulatedSeconds = 0;
    sim.status = 'created';
    sim.startedAt = null;
    sim.pausedAt = null;
    await sim.save();
    this.logger.log(`[reset] simulation=${id}`);
    return sim.toObject() as TimingAlertSimulationDocument;
  }

  /** Seek tới T (giây) cụ thể — pause + override accumulatedSeconds. */
  async seek(id: string, seconds: number): Promise<TimingAlertSimulationDocument> {
    if (seconds < 0) throw new BadRequestException('seconds phải >= 0');
    const sim = await this.simModel.findById(id).exec();
    if (!sim) throw new NotFoundException(`Simulation ${id} not found`);
    sim.accumulatedSeconds = seconds;
    sim.status = 'paused';
    sim.startedAt = null;
    sim.pausedAt = new Date();
    await sim.save();
    this.logger.log(`[seek] simulation=${id} → ${seconds}s`);
    return sim.toObject() as TimingAlertSimulationDocument;
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

    const cutoff = baseline + currentSimSeconds;

    const filtered: RaceResultApiItem[] = [];
    for (const item of snapshot.data) {
      const newItem = filterAthlete(item, cutoff);
      filtered.push(newItem);
    }

    // Apply scenarios on top of time-filtered data. Engine deterministic
    // theo hash(simCourseId+bib), KHÔNG mutate snapshot DB.
    const scenarios = sim.scenarios ?? [];
    if (scenarios.length > 0) {
      const result = applyScenarios(filtered, scenarios, simCourseId);
      return result.items;
    }
    return filtered;
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

/**
 * Filter athlete's Chiptimes — chỉ giữ checkpoint có time ≤ cutoffSeconds.
 *
 * RR Chiptimes là JSON string `{"Start":"06:00","TM1":"06:24:30",...}`.
 * Time format "HH:MM:SS" hoặc "MM:SS". Convert → seconds, so sánh với
 * cutoff. Drop key nếu time > cutoff.
 *
 * Athletes có 0 checkpoint visible vẫn return — Bib + metadata giữ.
 * (Match RR behavior: pre-race athletes có Bib nhưng Chiptimes={}).
 */
function filterAthlete(
  item: RaceResultApiItem,
  cutoffSeconds: number,
): RaceResultApiItem {
  const chiptimesRaw = item.Chiptimes;
  if (!chiptimesRaw || typeof chiptimesRaw !== 'string') {
    return item;
  }
  const trimmed = chiptimesRaw.trim();
  if (trimmed.length === 0) return item;

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return item;
    }
  } catch {
    return item;
  }

  const filtered: Record<string, string> = {};
  let lastVisibleKey: string | null = null;

  for (const [key, timeStr] of Object.entries(parsed)) {
    if (!timeStr || typeof timeStr !== 'string') continue;
    const seconds = parseTimeToSeconds(timeStr.trim());
    if (seconds === null) continue;
    if (seconds <= cutoffSeconds) {
      filtered[key] = timeStr;
      lastVisibleKey = key;
    }
  }

  // Override TimingPoint với key visible cuối — match RR vendor behavior
  // khi athlete đang trên đường (TimingPoint = checkpoint mới nhất qua).
  return {
    ...item,
    Chiptimes: JSON.stringify(filtered),
    TimingPoint: lastVisibleKey ?? item.TimingPoint ?? '',
  };
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
