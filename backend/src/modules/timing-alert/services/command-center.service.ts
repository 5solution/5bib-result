import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import {
  RaceResult,
  RaceResultDocument,
} from '../../race-result/schemas/race-result.schema';
import {
  TimingAlert,
  TimingAlertDocument,
} from '../schemas/timing-alert.schema';
import {
  LiveLeaderboardCourseDto,
  LiveLeaderboardEntryDto,
} from '../dto/live-leaderboard.dto';
import { SummaryCardsDto } from '../dto/summary-cards.dto';
import { TimingAlertPollService } from './timing-alert-poll.service';

/**
 * FEATURE-005 — Command Center aggregator service.
 *
 * Orchestrate live leaderboard query + summary cards aggregation. KHÔNG
 * tạo poller mới — reuse `TimingAlertPollService` cho Force Refresh.
 *
 * **Cache strategy** (Redis namespace `master:`):
 * - `master:cc-leaderboard:<raceId>:<courseId>` TTL 60s — top N JSON
 * - `master:cc-refresh-lock-user:<raceId>:<userId>` TTL 30s — per-user spam guard
 * - `master:discover-lock:<raceId>:<courseId>` TTL 60s — REUSE F-001 anti-stampede
 *
 * **Sort logic** (BR-CC-08):
 * - Athletes có Finish → ASC theo finish time (smallest first)
 * - Athletes chưa Finish → DESC theo last checkpoint orderIndex
 *   (athlete đi xa hơn rank cao hơn)
 *
 * **Force Refresh 2-layer rate-limit** (BR-CC-10):
 * - Layer 1 (UX): user lock 30s NX → throw 409 nếu held
 * - Layer 2 (anti-stampede): reuse F-001 race lock — nếu held thì caller
 *   wait + return cached snapshot, KHÔNG reject
 */
@Injectable()
export class CommandCenterService {
  private readonly logger = new Logger(CommandCenterService.name);

  /** Cache TTL for per-course leaderboard. */
  private static readonly LEADERBOARD_TTL_SECONDS = 60;
  /** User-level spam guard duration. */
  private static readonly USER_LOCK_TTL_SECONDS = 30;
  /** Race-level anti-stampede lock TTL (max poll wall time). */
  private static readonly RACE_LOCK_TTL_SECONDS = 60;
  /** Default leaderboard limit (paginated 1..50). */
  private static readonly DEFAULT_LEADERBOARD_LIMIT = 10;
  private static readonly MAX_LEADERBOARD_LIMIT = 50;

  constructor(
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(TimingAlert.name)
    private readonly alertModel: Model<TimingAlertDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly pollService: TimingAlertPollService,
  ) {}

  /**
   * Public API — top N leaderboard for 1 course. Used by both:
   * - `GET /timing-alert/leaderboard/:courseId` controller endpoint
   * - `aggregateLeaderboardForAllCourses` (snapshot embed)
   */
  async getLiveLeaderboard(
    raceId: string,
    courseId: string,
    limit: number = CommandCenterService.DEFAULT_LEADERBOARD_LIMIT,
  ): Promise<LiveLeaderboardCourseDto> {
    const safeLimit = Math.min(
      CommandCenterService.MAX_LEADERBOARD_LIMIT,
      Math.max(1, Math.floor(limit) || CommandCenterService.DEFAULT_LEADERBOARD_LIMIT),
    );

    const cacheKey = `master:cc-leaderboard:${raceId}:${courseId}:${safeLimit}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as LiveLeaderboardCourseDto;
      }
    } catch (err) {
      this.logger.warn(
        `[getLiveLeaderboard] cache read fail race=${raceId} course=${courseId}: ${(err as Error).message}`,
      );
    }

    const race = await this.raceModel
      .findById(raceId)
      .lean<RaceDocument>()
      .exec();
    if (!race) {
      throw new NotFoundException(`Race ${raceId} not found`);
    }

    const course = (race.courses ?? []).find(
      (c): c is NonNullable<typeof c> => c?.courseId === courseId,
    );
    if (!course) {
      throw new NotFoundException(
        `Course ${courseId} not found in race ${raceId}`,
      );
    }

    // Race chưa start → trả empty (BR-CC-01 — KHÔNG 4xx)
    if (race.status === 'draft' || race.status === 'pre_race') {
      const empty: LiveLeaderboardCourseDto = {
        courseId,
        courseName: course.name,
        distanceKm:
          typeof course.distanceKm === 'number' ? course.distanceKm : null,
        entries: [],
      };
      return empty;
    }

    const entries = await this.aggregateCourseLeaderboard(
      raceId,
      courseId,
      course.checkpoints ?? [],
      safeLimit,
    );

    const result: LiveLeaderboardCourseDto = {
      courseId,
      courseName: course.name,
      distanceKm:
        typeof course.distanceKm === 'number' ? course.distanceKm : null,
      entries,
    };

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        CommandCenterService.LEADERBOARD_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `[getLiveLeaderboard] cache write fail: ${(err as Error).message}`,
      );
    }

    return result;
  }

  /**
   * Aggregate leaderboard cho TẤT CẢ courses của race (embed vào snapshot).
   * Race ở status draft/pre_race → empty array.
   */
  async aggregateLeaderboardForAllCourses(
    raceId: string,
    race: RaceDocument,
    limit: number = CommandCenterService.DEFAULT_LEADERBOARD_LIMIT,
  ): Promise<LiveLeaderboardCourseDto[]> {
    if (race.status === 'draft' || race.status === 'pre_race') {
      return [];
    }
    const courses = race.courses ?? [];
    if (courses.length === 0) return [];

    const safeLimit = Math.min(
      CommandCenterService.MAX_LEADERBOARD_LIMIT,
      Math.max(1, Math.floor(limit) || CommandCenterService.DEFAULT_LEADERBOARD_LIMIT),
    );

    return Promise.all(
      courses.map(async (c) => {
        const entries = await this.aggregateCourseLeaderboard(
          raceId,
          c.courseId,
          c.checkpoints ?? [],
          safeLimit,
        );
        return {
          courseId: c.courseId,
          courseName: c.name,
          distanceKm: typeof c.distanceKm === 'number' ? c.distanceKm : null,
          entries,
        };
      }),
    );
  }

  /**
   * Race-level summary cards. Race draft/pre_race → all zeros.
   */
  async getSummaryCards(
    raceId: string,
    race: RaceDocument,
    raceStats: { started: number; finished: number; suspectOpen: number },
  ): Promise<SummaryCardsDto> {
    if (race.status === 'draft' || race.status === 'pre_race') {
      return {
        totalRegistered: 0,
        racekitPickedUp: 0,
        started: 0,
        finished: 0,
        dns: 0,
        missCount: 0,
        missRate: 0,
      };
    }

    // Total registered = countDocuments(race_results) — proxy cho registered.
    // TD: nếu race-master-data wired → swap sang RaceAthleteLookupService.statsByRaceId
    const totalRegistered = await this.resultModel
      .countDocuments({ raceId })
      .exec();

    const dns = Math.max(0, totalRegistered - raceStats.started);
    const missRate =
      raceStats.started > 0
        ? Math.round((raceStats.suspectOpen / raceStats.started) * 1000) / 10
        : 0;

    return {
      totalRegistered,
      // TD: chip_verifications cần mysql_race_id — F-005 chưa wire mapping.
      // Caller sẽ thấy 0 cho tới khi feature integration sau approved.
      racekitPickedUp: 0,
      started: raceStats.started,
      finished: raceStats.finished,
      dns,
      missCount: raceStats.suspectOpen,
      missRate: Math.min(100, Math.max(0, missRate)),
    };
  }

  /**
   * Force Refresh — 2-layer rate-limit per BR-CC-10.
   *
   * Returns:
   * - `'TRIGGERED'` nếu đã trigger fresh poll
   * - `'STAMPEDE_WAIT'` nếu race lock held (poll khác đang chạy) — caller
   *   sẽ return cached snapshot
   *
   * Throws:
   * - `ConflictException` 409 nếu user spam (user lock held)
   * - `NotFoundException` nếu race không tồn tại
   */
  async forceRefresh(
    raceId: string,
    userId: string,
  ): Promise<'TRIGGERED' | 'STAMPEDE_WAIT'> {
    const race = await this.raceModel
      .findById(raceId)
      .lean<RaceDocument>()
      .exec();
    if (!race) {
      throw new NotFoundException(`Race ${raceId} not found`);
    }

    // Layer 1 — per-user UX guard. SETNX TTL 30s, KHÔNG release sớm.
    const userLockKey = `master:cc-refresh-lock-user:${raceId}:${userId}`;
    const userAcquired = await this.redis.set(
      userLockKey,
      '1',
      'EX',
      CommandCenterService.USER_LOCK_TTL_SECONDS,
      'NX',
    );
    if (userAcquired !== 'OK') {
      throw new ConflictException(
        'Force Refresh đang chạy hoặc bạn vừa gọi — đợi 30s rồi thử lại.',
      );
    }

    // Layer 2 — anti-stampede per race × course (REUSE F-001 lock pattern).
    // Nếu poll vendor đang chạy → return STAMPEDE_WAIT (cached snapshot OK).
    let allCoursesLocked = true;
    const courses = race.courses ?? [];
    for (const c of courses) {
      const raceLockKey = `master:discover-lock:${raceId}:${c.courseId}`;
      // Try acquire — nếu thành công means không có poll đang chạy
      const acquired = await this.redis.set(
        raceLockKey,
        `cc-refresh:${userId}`,
        'EX',
        CommandCenterService.RACE_LOCK_TTL_SECONDS,
        'NX',
      );
      if (acquired === 'OK') {
        allCoursesLocked = false;
        // Release ngay — actual polling sẽ re-acquire qua pollService
        await this.redis.del(raceLockKey).catch(() => undefined);
      }
    }

    if (allCoursesLocked && courses.length > 0) {
      // Tất cả courses đang được poll khác chiếm → wait + return cached
      this.logger.log(
        `[forceRefresh] race=${raceId} stampede-wait — all courses locked`,
      );
      return 'STAMPEDE_WAIT';
    }

    // Trigger fresh poll qua TimingAlertPollService.pollRace
    try {
      await this.pollService.pollRace(raceId, `cc-refresh:${userId}`);
    } catch (err) {
      this.logger.warn(
        `[forceRefresh] pollRace fail race=${raceId}: ${(err as Error).message}`,
      );
      // Vẫn invalidate cache snapshot — caller có thể re-fetch fresh data
    }

    // Invalidate snapshot cache + leaderboard cache cho race
    await this.invalidateSnapshotCache(raceId);

    return 'TRIGGERED';
  }

  /**
   * Invalidate `master:rr-snapshot:` + `master:cc-leaderboard:` keys cho race.
   */
  async invalidateSnapshotCache(raceId: string): Promise<void> {
    try {
      await this.redis.del(`master:rr-snapshot:${raceId}`);
      const pattern = `master:cc-leaderboard:${raceId}:*`;
      const stream = this.redis.scanStream({ match: pattern, count: 100 });
      const keysToDelete: string[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => keysToDelete.push(...keys));
        stream.on('end', () => resolve());
        stream.on('error', (err) => reject(err));
      });
      if (keysToDelete.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const k of keysToDelete) pipeline.del(k);
        await pipeline.exec();
      }
    } catch (err) {
      this.logger.warn(
        `[invalidateSnapshotCache] race=${raceId}: ${(err as Error).message}`,
      );
    }
  }

  // ─────────── private aggregation helpers ───────────

  private async aggregateCourseLeaderboard(
    raceId: string,
    courseId: string,
    checkpoints: ReadonlyArray<{
      key: string;
      name?: string;
      distanceKm?: number | null;
    }>,
    limit: number,
  ): Promise<LiveLeaderboardEntryDto[]> {
    type Row = {
      bib: string;
      name: string | null;
      gender: string | null;
      category: string | null;
      chiptimes: string | null;
      chipTime: string | null;
    };

    // Project chỉ field cần — giảm BSON transfer
    const rows = await this.resultModel
      .aggregate<Row>([
        { $match: { raceId, courseId } },
        { $sort: { _id: 1 } },
        {
          $group: {
            _id: '$bib',
            name: { $first: '$name' },
            gender: { $first: '$gender' },
            category: { $first: '$category' },
            chiptimes: { $first: '$chiptimes' },
            chipTime: { $first: '$chipTime' },
          },
        },
        {
          $project: {
            _id: 0,
            bib: '$_id',
            name: 1,
            gender: 1,
            category: 1,
            chiptimes: 1,
            chipTime: 1,
          },
        },
      ])
      .exec();

    if (rows.length === 0) return [];

    type Computed = {
      row: Row;
      finishSeconds: number | null;
      finishTime: string | null;
      lastCheckpointKey: string;
      lastCheckpointTime: string;
      lastCheckpointOrder: number;
      hasMissingFinish: boolean;
    };

    const computed: Computed[] = rows.map((row) => {
      const map = parseChiptimesSafe(row.chiptimes);
      const finishTime = findTimeCi(map, 'finish') ?? row.chipTime ?? null;
      const finishSeconds = finishTime ? parseTimeToSeconds(finishTime) : null;

      // Find last checkpoint passed (highest orderIndex with non-empty time)
      let lastCheckpointKey = '';
      let lastCheckpointTime = '';
      let lastCheckpointOrder = -1;

      if (checkpoints.length > 0) {
        for (let i = checkpoints.length - 1; i >= 0; i -= 1) {
          const cp = checkpoints[i];
          const t = findTimeCi(map, cp.key);
          if (t) {
            lastCheckpointKey = cp.name || cp.key;
            lastCheckpointTime = t;
            lastCheckpointOrder = i;
            break;
          }
        }
      }

      // Fallback: nếu không có checkpoints config → dùng key đầu tiên có time
      if (lastCheckpointOrder === -1) {
        for (const [k, v] of Object.entries(map)) {
          if (typeof v === 'string' && v.trim().length > 0) {
            lastCheckpointKey = k;
            lastCheckpointTime = v;
            lastCheckpointOrder = 0;
            break;
          }
        }
      }

      // hasMissingFinish: có ít nhất 1 intermediate time, KHÔNG có Finish
      const hasIntermediate = lastCheckpointOrder >= 0;
      const hasFinish = finishSeconds !== null && finishSeconds > 0;
      const hasMissingFinish = hasIntermediate && !hasFinish;

      return {
        row,
        finishSeconds: hasFinish ? finishSeconds : null,
        finishTime: hasFinish ? finishTime : null,
        lastCheckpointKey,
        lastCheckpointTime,
        lastCheckpointOrder,
        hasMissingFinish,
      };
    });

    // Sort: hasFinish DESC (true first), finishSeconds ASC, lastCheckpointOrder DESC
    computed.sort((a, b) => {
      const aHas = a.finishSeconds !== null ? 1 : 0;
      const bHas = b.finishSeconds !== null ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (aHas === 1 && bHas === 1) {
        return (a.finishSeconds ?? 0) - (b.finishSeconds ?? 0);
      }
      // Both pending → DESC by lastCheckpointOrder
      return b.lastCheckpointOrder - a.lastCheckpointOrder;
    });

    const top = computed.slice(0, limit);

    // Compute leader finish seconds for gap calculation
    const leaderFinish =
      top.length > 0 && top[0].finishSeconds !== null
        ? top[0].finishSeconds
        : null;

    return top.map((c, idx) => {
      const gap =
        leaderFinish !== null && c.finishSeconds !== null && idx > 0
          ? formatSeconds(c.finishSeconds - leaderFinish)
          : null;

      const entry: LiveLeaderboardEntryDto = {
        rank: idx + 1,
        bib: c.row.bib,
        athleteName: c.row.name?.trim() || `BIB ${c.row.bib}`,
        lastCheckpoint: c.lastCheckpointKey || '—',
        lastCheckpointTime: c.lastCheckpointTime || '',
        finishTime: c.finishTime,
        gap,
        hasMissingFinish: c.hasMissingFinish,
        gender: c.row.gender ?? null,
        ageGroup: c.row.category ?? null,
      };
      return entry;
    });
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

function findTimeCi(
  map: Record<string, string>,
  matchKey: string,
): string | null {
  const lower = matchKey.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) {
      const trimmed = (v ?? '').trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }
  return null;
}

function parseTimeToSeconds(time: string): number | null {
  if (!time) return null;
  const parts = time.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

function formatSeconds(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  if (hh > 0) {
    return `+${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `+${mm}:${String(ss).padStart(2, '0')}`;
}
