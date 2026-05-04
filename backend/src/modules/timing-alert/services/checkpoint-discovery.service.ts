import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import { RaceResultApiService } from '../../race-result/services/race-result-api.service';
import { SimulatorService } from './simulator.service';
import { parseTimeToSeconds } from '../utils/parsed-athlete';

/**
 * Phase 2.1 — Auto-derive checkpoints từ RaceResult API.
 *
 * **Pain point user (Danny 03/05/2026):** "bắt team tao đi cấu hình 2 lần có
 * mà điên" — RR API đã có timing point keys, không bắt BTC nhập tay.
 *
 * **Algorithm:**
 * 1. Fetch ALL athletes từ course.apiUrl
 * 2. Parse Chiptimes JSON cho mỗi athlete → set keys có time non-empty
 * 3. Aggregate per-key:
 *    - coverage = athletesWithThisKey / totalAthletes
 *    - medianTimeSeconds = median(parseTimeToSeconds(checkpointTimes[key]))
 * 4. Filter keys có coverage ≥ 80% (active checkpoints, ignore fluke fields)
 * 5. Sort theo medianTimeSeconds ASC → Start sớm nhất → Finish muộn nhất
 * 6. Distance derivation:
 *    - Nếu course.distanceKm có sẵn → distance proportional theo time
 *      `distance(cp_i) = course.distanceKm × medianTime(cp_i) / medianTime(Finish)`
 *    - Nếu không → null, BTC override
 *
 * **Edge cases:**
 * - Race chưa start (RR trả empty) → return empty preview + message
 * - Course không đủ finishers (< 10) → distance derivation skip, return null
 * - Athletes có Chiptimes empty hoặc malformed → skip, không fail toàn cục
 * - Single timing point (chỉ Start) → return preview với 1 row, BTC apply hay không tùy ý
 */
export interface DetectedCheckpoint {
  /** Timing point key từ RR API (VD "Start", "TM1", "Finish") */
  key: string;
  /** Display name suggestion = key by default. BTC override được khi apply. */
  suggestedName: string;
  /** Distance derivation theo time proportion. Null nếu thiếu data. */
  suggestedDistanceKm: number | null;
  /** Fraction athletes có time non-empty (0..1). Coverage thấp → skip key. */
  coverage: number;
  /** Median time seconds — dùng để order checkpoint chronologically. */
  medianTimeSeconds: number;
  /** 0-based order index (0 = earliest, N-1 = latest = Finish). */
  orderIndex: number;
  /** Số athletes có time tại key này. */
  passedCount: number;
  /**
   * True nếu key này là vạch xuất phát (orderIndex=0). Vendor có thể dùng
   * literal "Start" HOẶC custom key như "TM0". UI đánh dấu 🚩.
   */
  isImplicitStart: boolean;
  /**
   * True nếu key này là vạch đích (orderIndex=N-1). Vendor có thể dùng
   * literal "Finish" HOẶC custom key như "TM5". UI đánh dấu 🏁.
   */
  isImplicitFinish: boolean;
}

export interface CheckpointDiscoveryResult {
  courseId: string;
  courseName: string;
  /** Distance từ race document (BTC config) — input cho distance derivation. */
  courseDistanceKm: number | null;
  /** Tổng athletes trong RR API response. */
  totalAthletes: number;
  /** Athletes có ít nhất 1 checkpoint time non-empty. */
  athletesWithAnyTime: number;
  /** Athletes finished (có time tại checkpoint cuối). */
  finishersCount: number;
  /** Danh sách checkpoint suggested, ordered chronologically. */
  detectedCheckpoints: DetectedCheckpoint[];
  /** Metadata explanation cho admin UI hiển thị. */
  notes: string[];
}

/** Min coverage để 1 key được xem là "checkpoint thật" — filter noise fields. */
const MIN_COVERAGE = 0.8;

/** Min finishers để derive distance. Dưới ngưỡng → distance null. */
const MIN_FINISHERS_FOR_DISTANCE = 10;

@Injectable()
export class CheckpointDiscoveryService {
  private readonly logger = new Logger(CheckpointDiscoveryService.name);

  constructor(
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
    private readonly apiService: RaceResultApiService,
    private readonly simulatorService: SimulatorService,
  ) {}

  /**
   * Detect xem URL có phải simulator URL không. Nếu phải → return simCourseId
   * để fetch raw snapshot (bypass time filter + scenarios). Nếu không → null.
   */
  private extractSimCourseId(apiUrl: string): string | null {
    const match = apiUrl.match(
      /\/api\/timing-alert\/simulator-data\/([a-f0-9]{32})/i,
    );
    return match ? match[1] : null;
  }

  /**
   * Discover checkpoints cho 1 race × 1 course. Read-only — KHÔNG ghi DB.
   * BTC review preview rồi gọi `applyCheckpoints` để confirm save.
   */
  async discover(
    raceId: string,
    courseId: string,
  ): Promise<CheckpointDiscoveryResult> {
    const race = await this.raceModel.findById(raceId).lean<RaceDocument>().exec();
    if (!race) {
      throw new NotFoundException(`Race ${raceId} not found`);
    }
    const course = (race.courses ?? []).find((c) => c.courseId === courseId);
    if (!course) {
      throw new NotFoundException(
        `Course ${courseId} not found in race ${raceId}`,
      );
    }
    const apiUrl = course.apiUrl?.trim();
    if (!apiUrl) {
      throw new BadRequestException(
        `Course "${course.name}" thiếu apiUrl — sửa qua /admin/races/${raceId}/edit trước khi discover`,
      );
    }

    const courseDistanceKm =
      typeof course.distanceKm === 'number' && course.distanceKm > 0
        ? course.distanceKm
        : null;

    // Fetch data — nếu apiUrl là simulator URL → đọc raw snapshot bypass
    // time filter + scenarios. Discover cần biết vendor return keys gì,
    // KHÔNG nên thấy data đã bị MISS_FINISH/MISS_MIDDLE_CP scenario drop.
    const simCourseId = this.extractSimCourseId(apiUrl);
    const rawAthletes = simCourseId
      ? await this.simulatorService.getRawSnapshot(simCourseId)
      : await this.apiService.fetchRaceResults(apiUrl);

    if (simCourseId) {
      this.logger.log(
        `[discover] race=${raceId} course=${courseId} bypass simulator filter (raw snapshot ${rawAthletes.length} athletes)`,
      );
    }
    const totalAthletes = rawAthletes.length;
    if (totalAthletes === 0) {
      return {
        courseId,
        courseName: course.name,
        courseDistanceKm,
        totalAthletes: 0,
        athletesWithAnyTime: 0,
        finishersCount: 0,
        detectedCheckpoints: [],
        notes: [
          'RaceResult API trả 0 athletes. Race chưa khởi động hoặc URL sai.',
        ],
      };
    }

    // Per-key aggregation: collect time samples.
    // Note: Start time = "00:00" → 0 seconds VALID (race start moment), KHÔNG reject.
    // Chỉ reject nếu time format malformed (null) hoặc negative (vendor sentinel).
    //
    // **Merge Chiptimes + Guntimes:** vendor 42Km có Finish chỉ trong Guntimes
    // (gun-timed elapsed) NHƯNG không có trong Chiptimes (chip không bắt được
    // tại Finish line). Merge để discover thấy đầy đủ keys.
    const keyTimes = new Map<string, number[]>(); // key → seconds[]
    let athletesWithAnyTime = 0;

    for (const item of rawAthletes) {
      const chiptimes = mergeTimes(item.Chiptimes, item.Guntimes);
      if (Object.keys(chiptimes).length === 0) continue;

      let hasAnyTime = false;
      for (const [key, timeStr] of Object.entries(chiptimes)) {
        if (!timeStr || typeof timeStr !== 'string') continue;
        const trimmed = timeStr.trim();
        if (trimmed.length === 0) continue;
        const seconds = parseTimeToSeconds(trimmed);
        if (seconds === null || seconds < 0) continue;
        hasAnyTime = true;
        const list = keyTimes.get(key);
        if (list) list.push(seconds);
        else keyTimes.set(key, [seconds]);
      }
      if (hasAnyTime) athletesWithAnyTime += 1;
    }

    // Filter keys với coverage thấp (noise fields hoặc legacy fields RR vendor đẩy lung tung)
    const denominator = athletesWithAnyTime || totalAthletes;
    const surviving: Array<{
      key: string;
      coverage: number;
      passedCount: number;
      medianTimeSeconds: number;
    }> = [];
    for (const [key, samples] of keyTimes.entries()) {
      const coverage = samples.length / denominator;
      if (coverage < MIN_COVERAGE) continue;
      surviving.push({
        key,
        coverage,
        passedCount: samples.length,
        medianTimeSeconds: median(samples),
      });
    }

    // Sort chronologically theo median time
    surviving.sort((a, b) => a.medianTimeSeconds - b.medianTimeSeconds);

    // Last surviving = Finish (cup level)
    const finishKey = surviving.length > 0 ? surviving[surviving.length - 1] : null;
    const finishMedian = finishKey?.medianTimeSeconds ?? 0;
    const finishersCount = finishKey?.passedCount ?? 0;
    const canDeriveDistance =
      courseDistanceKm !== null && finishersCount >= MIN_FINISHERS_FOR_DISTANCE && finishMedian > 0;

    const notes: string[] = [];
    if (!canDeriveDistance) {
      if (courseDistanceKm === null) {
        notes.push(
          'Course chưa có distanceKm — distance suggestion null. Nhập distanceKm ở Race edit để auto-derive.',
        );
      } else if (finishersCount < MIN_FINISHERS_FOR_DISTANCE) {
        notes.push(
          `Chỉ ${finishersCount} athletes đã finish (<${MIN_FINISHERS_FOR_DISTANCE}) — distance derivation chưa đáng tin. BTC override sau khi race tiến triển.`,
        );
      }
    } else {
      notes.push(
        `Distance derived theo time proportion với reference courseDistanceKm=${courseDistanceKm}km, finish median=${formatSeconds(finishMedian)}.`,
      );
    }

    if (surviving.length === 0) {
      notes.push(
        `Không key nào đạt coverage ≥${(MIN_COVERAGE * 100).toFixed(0)}% — race có thể vừa start, đợi 5-10 min rồi discover lại.`,
      );
    }

    const lastIdx = surviving.length - 1;
    const detectedCheckpoints: DetectedCheckpoint[] = surviving.map((s, idx) => {
      const lower = s.key.toLowerCase();
      // Start: orderIndex = 0
      const isImplicitStart = idx === 0;
      // Finish: orderIndex = N-1 AND N > 1.
      // Note: nếu vendor có literal "Finish" key, sort theo time ASC →
      // Finish key sẽ có median time muộn nhất → naturally orderIndex=N-1.
      // Cả 2 trường hợp (literal "Finish" hoặc vendor dùng "TM5"):
      // last surviving = vạch về đích.
      const isImplicitFinish = idx === lastIdx && lastIdx > 0;

      // Suggested name — gợi ý đẹp hơn cho start/finish nếu vendor dùng key
      // không phải literal "Start"/"Finish"
      let suggestedName = s.key;
      if (isImplicitStart && lower !== 'start') {
        suggestedName = `Start (${s.key})`;
      } else if (isImplicitFinish && lower !== 'finish') {
        suggestedName = `Finish (${s.key})`;
      }
      return {
        key: s.key,
        suggestedName,
        suggestedDistanceKm:
          isImplicitStart && s.medianTimeSeconds === 0
            ? 0 // Start luôn = 0km
            : isImplicitFinish && courseDistanceKm !== null
              ? courseDistanceKm // Finish = course total distance
              : canDeriveDistance
                ? roundTo(
                    courseDistanceKm! *
                      (s.medianTimeSeconds / finishMedian),
                    2,
                  )
                : null,
        coverage: roundTo(s.coverage, 3),
        medianTimeSeconds: Math.round(s.medianTimeSeconds),
        orderIndex: idx,
        passedCount: s.passedCount,
        isImplicitStart,
        isImplicitFinish,
      };
    });

    this.logger.log(
      `[discover] race=${raceId} course=${courseId} total=${totalAthletes} surviving=${surviving.length} finishers=${finishersCount}`,
    );

    return {
      courseId,
      courseName: course.name,
      courseDistanceKm,
      totalAthletes,
      athletesWithAnyTime,
      finishersCount,
      detectedCheckpoints,
      notes,
    };
  }

  /**
   * Apply (save) checkpoints array vào `race.courses[].checkpoints`.
   *
   * BTC có thể override `name` + `distanceKm` của từng row trong preview trước
   * khi confirm. Service KHÔNG validate semantic (Finish phải là last) —
   * BTC tự chịu trách nhiệm config sai.
   *
   * **Atomic update:** dùng `findOneAndUpdate` với arrayFilters target
   * subdocument courseId match. Nếu courseId không tồn tại → throw.
   */
  async apply(
    raceId: string,
    courseId: string,
    checkpoints: Array<{
      key: string;
      name: string;
      distanceKm?: number | null;
    }>,
    userId: string,
  ): Promise<{ raceId: string; courseId: string; saved: number }> {
    if (checkpoints.length === 0) {
      throw new BadRequestException('checkpoints không được rỗng');
    }
    // Validate keys unique
    const keys = new Set(checkpoints.map((c) => c.key));
    if (keys.size !== checkpoints.length) {
      throw new BadRequestException('checkpoint keys phải unique trong cùng course');
    }

    const sanitized = checkpoints.map((c) => ({
      key: c.key.trim(),
      name: (c.name || c.key).trim(),
      distance:
        typeof c.distanceKm === 'number' && c.distanceKm > 0
          ? `${c.distanceKm}K`
          : undefined,
      distanceKm:
        typeof c.distanceKm === 'number' && c.distanceKm > 0
          ? c.distanceKm
          : undefined,
    }));

    const result = await this.raceModel
      .findOneAndUpdate(
        { _id: raceId, 'courses.courseId': courseId },
        {
          $set: {
            'courses.$.checkpoints': sanitized,
          },
        },
        { new: true },
      )
      .lean<RaceDocument>()
      .exec();

    if (!result) {
      throw new NotFoundException(
        `Race ${raceId} hoặc course ${courseId} không tồn tại`,
      );
    }

    this.logger.log(
      `[apply] race=${raceId} course=${courseId} saved=${sanitized.length} by=${userId}`,
    );
    return { raceId, courseId, saved: sanitized.length };
  }
}

// ─────────── helpers ───────────

function parseChiptimesSafe(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'string') return {};
  const trimmed = raw.trim();
  if (trimmed.length === 0) return {};
  try {
    const parsed = JSON.parse(trimmed) as Record<string, string>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/**
 * Merge Chiptimes (primary) + Guntimes (fallback) — Chiptimes value win.
 * Identical helper as utils/parsed-athlete.ts (duplicated để tránh circular
 * import; behavior must match).
 */
function mergeTimes(
  chiptimesRaw: unknown,
  guntimesRaw: unknown,
): Record<string, string> {
  const chip = parseChiptimesSafe(chiptimesRaw);
  const gun = parseChiptimesSafe(guntimesRaw);
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(gun)) {
    if (v && typeof v === 'string' && v.trim().length > 0) merged[k] = v;
  }
  for (const [k, v] of Object.entries(chip)) {
    if (v && typeof v === 'string' && v.trim().length > 0) merged[k] = v;
  }
  return merged;
}

function median(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function roundTo(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
