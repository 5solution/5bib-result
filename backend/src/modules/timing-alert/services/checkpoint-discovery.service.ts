import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
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

/**
 * Sentinel keys vendor đôi khi emit (status flags, không phải timing point thật).
 * Filter trước khi vào surviving — defense in depth chống miss labeling như
 * "Finish" implicit nhầm.
 */
const SENTINEL_KEYS = new Set([
  'dns', 'dnf', 'dsq', 'dq', 'withdrawn', 'wd',
  'status', 'gap', 'rank',
]);

@Injectable()
export class CheckpointDiscoveryService {
  private readonly logger = new Logger(CheckpointDiscoveryService.name);

  /** Phase B: Redis cache TTL cho discover preview (1h). */
  private static readonly PREVIEW_CACHE_TTL_SECONDS = 3600;
  /** Phase B: SETNX lock TTL chống concurrent discover same (race, course). */
  private static readonly LOCK_TTL_SECONDS = 30;

  constructor(
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly apiService: RaceResultApiService,
    private readonly simulatorService: SimulatorService,
  ) {}

  /**
   * Phase B (BR-04, BR-05, BR-06): Auto-trigger discover preview khi BTC
   * paste apiUrl. Cache result Redis 1h, BTC fetch qua endpoint
   * `GET /discover-preview/:courseId`.
   *
   * Concurrent guard via Redis SETNX `master:discover-lock:{race}:{course}`.
   *
   * **Fire-and-forget:** caller (RacesService.update event hook) gọi async
   * với `.catch(err => log)`. Lỗi network/timeout KHÔNG block save race.
   */
  async discoverAndCachePreview(
    raceId: string,
    courseId: string,
  ): Promise<void> {
    const lockKey = `master:discover-lock:${raceId}:${courseId}`;
    const acquired = await this.redis.set(
      lockKey,
      '1',
      'EX',
      CheckpointDiscoveryService.LOCK_TTL_SECONDS,
      'NX',
    );
    if (acquired !== 'OK') {
      this.logger.warn(
        `[discover-preview] race=${raceId} course=${courseId} lock-held — skip`,
      );
      return;
    }

    try {
      const result = await this.discover(raceId, courseId);
      const cacheKey = `discover-preview:${raceId}:${courseId}`;
      await this.redis.set(
        cacheKey,
        JSON.stringify({
          ...result,
          generatedAt: new Date().toISOString(),
        }),
        'EX',
        CheckpointDiscoveryService.PREVIEW_CACHE_TTL_SECONDS,
      );
      this.logger.log(
        `[discover-preview] race=${raceId} course=${courseId} cached ${result.detectedCheckpoints.length} keys`,
      );
    } catch (err) {
      const message = (err as Error).message;
      // Cache error result để frontend hiển thị banner thay vì retry vô hạn
      const errorCacheKey = `discover-preview:${raceId}:${courseId}`;
      await this.redis
        .set(
          errorCacheKey,
          JSON.stringify({
            error: message,
            generatedAt: new Date().toISOString(),
          }),
          'EX',
          60, // shorter TTL cho error → BTC re-paste apiUrl mới retry
        )
        .catch(() => undefined);
      this.logger.warn(
        `[discover-preview] race=${raceId} course=${courseId} fail: ${message}`,
      );
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * Phase B: Read cached preview từ Redis. Trả null nếu cache miss.
   * Frontend gọi qua endpoint `GET /discover-preview/:courseId`.
   */
  async getCachedPreview(
    raceId: string,
    courseId: string,
  ): Promise<{
    cached: CheckpointDiscoveryResult | null;
    error: string | null;
    generatedAt: string | null;
  }> {
    const cacheKey = `discover-preview:${raceId}:${courseId}`;
    const raw = await this.redis.get(cacheKey);
    if (!raw) return { cached: null, error: null, generatedAt: null };
    try {
      const parsed = JSON.parse(raw) as
        | (CheckpointDiscoveryResult & { generatedAt: string })
        | { error: string; generatedAt: string };
      if ('error' in parsed) {
        return { cached: null, error: parsed.error, generatedAt: parsed.generatedAt };
      }
      return {
        cached: parsed,
        error: null,
        generatedAt: parsed.generatedAt,
      };
    } catch {
      return { cached: null, error: null, generatedAt: null };
    }
  }

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

    // **Phase C — Schema-from-1 với fallback aggregate (BR-08):**
    // Real RR vendor verified luôn return full schema (7 keys cho 42K race
    // verified curl). Sample 10 athletes đầu, nếu Object.keys identical ≥
    // 80% → trust schema-from-1 (1 athlete đủ get full keys).
    //
    // Else fallback current aggregate algorithm (defensive cho vendor edge
    // cases hoặc data corrupt).
    //
    // **Phase 3:** Distance/median time chỉ tính từ athletes có time non-empty
    // (athletes đã pass checkpoint thực sự). Sentinel filter giữ nguyên.

    const useSchemaFromOne = isVendorSchemaConsistent(rawAthletes);
    const candidateKeys = useSchemaFromOne
      ? extractKeysFromFirstAthlete(rawAthletes)
      : null; // null → fallback aggregate

    if (useSchemaFromOne) {
      this.logger.log(
        `[discover] race=${raceId} course=${courseId} schema-from-1 mode (vendor returns ${candidateKeys?.length} keys)`,
      );
    } else {
      this.logger.warn(
        `[discover] race=${raceId} course=${courseId} schema inconsistent → fallback aggregate algorithm`,
      );
    }

    // Aggregate time samples — dùng cho cả 2 mode.
    // Schema-from-1: dùng để compute median time / order
    // Fallback aggregate: dùng cả để filter coverage
    const keyTimes = new Map<string, number[]>();
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

    const denominator = athletesWithAnyTime || totalAthletes;
    const surviving: Array<{
      key: string;
      coverage: number;
      passedCount: number;
      medianTimeSeconds: number;
    }> = [];

    if (candidateKeys !== null) {
      // Schema-from-1: lấy keys từ vendor schema, KHÔNG filter coverage
      // (vendor đảm bảo full schema, missing samples = athletes chưa pass)
      for (const key of candidateKeys) {
        if (SENTINEL_KEYS.has(key.toLowerCase())) continue;
        const samples = keyTimes.get(key) ?? [];
        const coverage = samples.length / denominator;
        surviving.push({
          key,
          coverage,
          passedCount: samples.length,
          medianTimeSeconds: samples.length > 0 ? median(samples) : 0,
        });
      }
    } else {
      // Fallback aggregate: filter coverage threshold cho vendor lạ
      for (const [key, samples] of keyTimes.entries()) {
        if (SENTINEL_KEYS.has(key.toLowerCase())) continue;
        const coverage = samples.length / denominator;
        if (coverage < MIN_COVERAGE) continue;
        surviving.push({
          key,
          coverage,
          passedCount: samples.length,
          medianTimeSeconds: median(samples),
        });
      }
    }

    // Sort chronologically theo median time. Nếu nhiều keys có median=0
    // (race chưa start, schema-from-1 mode), preserve insertion order
    // (vendor RR thường insert theo course order trong JSON).
    const allMediansZero = surviving.every((s) => s.medianTimeSeconds === 0);
    if (!allMediansZero) {
      surviving.sort((a, b) => a.medianTimeSeconds - b.medianTimeSeconds);
    }
    // else: giữ insertion order từ vendor JSON

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

/**
 * Extract ALL keys (including empty value) from Chiptimes + Guntimes.
 * Khác với `mergeTimes` (chỉ keep keys có value non-empty), function này
 * lấy schema raw — works cho race chưa start (toàn empty value).
 */
function extractRawKeys(item: {
  Chiptimes?: string;
  Guntimes?: string;
}): Set<string> {
  const keys = new Set<string>();
  for (const raw of [item.Chiptimes, item.Guntimes]) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, string>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const k of Object.keys(parsed)) keys.add(k);
      }
    } catch {
      // skip malformed
    }
  }
  return keys;
}

/**
 * BR-08: Schema consistency check.
 * Sample first 10 athletes, check if Object.keys(Chiptimes ∪ Guntimes)
 * identical ≥ 80%. Real RR vendor returns full schema 100% verified curl —
 * works cho cả race chưa start (vendor return keys với value="").
 */
function isVendorSchemaConsistent(
  athletes: Array<{ Chiptimes?: string; Guntimes?: string }>,
): boolean {
  if (athletes.length === 0) return false;
  const sample = athletes.slice(0, Math.min(10, athletes.length));
  const sets = sample.map((a) => extractRawKeys(a));
  const reference = sets.find((s) => s.size > 0);
  if (!reference) return false;
  let consistent = 0;
  for (const s of sets) {
    if (s.size === 0) continue;
    if (
      s.size === reference.size &&
      [...reference].every((k) => s.has(k))
    ) {
      consistent += 1;
    }
  }
  const nonEmpty = sets.filter((s) => s.size > 0).length;
  return nonEmpty > 0 && consistent / nonEmpty >= 0.8;
}

/**
 * Extract checkpoint keys (raw) — trust vendor schema, lấy keys kể cả khi
 * value="" (race chưa start).
 */
function extractKeysFromFirstAthlete(
  athletes: Array<{ Chiptimes?: string; Guntimes?: string }>,
): string[] {
  for (const a of athletes) {
    const keys = extractRawKeys(a);
    if (keys.size > 0) return [...keys];
  }
  return [];
}

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
