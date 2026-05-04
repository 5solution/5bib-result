import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  TimingAlertPoll,
  TimingAlertPollDocument,
} from '../schemas/timing-alert-poll.schema';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import {
  DashboardSnapshotResponseDto,
  RaceStatsDto,
  CourseStatsDto,
  CheckpointProgressionDto,
  CheckpointPointDto,
  RecentActivityItemDto,
} from '../dto/dashboard-snapshot.dto';

/**
 * Phase 2.2 — Race Timing Operation Dashboard backend.
 *
 * **Goals:**
 * - Race-level KPI: Started / Finished / On-course / Suspect / AvgPace
 * - Per-course breakdown grid
 * - Checkpoint progression (passedCount per checkpoint cho bar chart)
 * - Recent activity timeline (alerts + poll completes)
 *
 * **Data sources:**
 * - `race_results` collection — synced từ RaceSyncCron (5K records/race typical)
 * - `timing_alerts` — open alerts count
 * - `timing_alert_polls` — recent poll logs cho activity feed
 *
 * **Performance:**
 * - Aggregation pipelines on indexed `(raceId, courseId, timingPoint)` field
 * - Redis cache 15s TTL — race day có ~50-100 admin tab open, cache giảm DB pressure
 * - 1 endpoint gộp thay vì 4 round-trip cho admin
 *
 * **Edge cases:**
 * - Race chưa sync race_results → counts = 0, banner "đợi sync đầu tiên"
 * - Course không có checkpoints config → progression rỗng, hint discover-checkpoints
 * - Race ended (status='ended') → progress=1.0, on-course=0
 */
@Injectable()
export class DashboardSnapshotService {
  private readonly logger = new Logger(DashboardSnapshotService.name);

  /** Redis cache TTL — short để snapshot fresh nhưng đủ giảm DB pressure. */
  private static readonly CACHE_TTL_SECONDS = 15;

  /**
   * Mat failure detection threshold — passedRatio drop > 30% so với
   * checkpoint trước → fire anomaly Telegram. Cap dưới (5%) tránh false
   * positive khi race đầu giờ chỉ vài athletes qua mỗi checkpoint.
   */
  private static readonly MAT_FAILURE_DROP_THRESHOLD = 0.3;
  /** Min expected athletes để consider checkpoint significant cho anomaly check. */
  private static readonly MAT_FAILURE_MIN_EXPECTED = 20;

  constructor(
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(TimingAlert.name)
    private readonly alertModel: Model<TimingAlertDocument>,
    @InjectModel(TimingAlertPoll.name)
    private readonly pollModel: Model<TimingAlertPollDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly notification: NotificationDispatcherService,
  ) {}

  /**
   * Main entry — orchestrate 4 sub-queries song song + assemble snapshot.
   *
   * Cache key: `dashboard-snapshot:{raceId}` TTL 15s.
   */
  async getSnapshot(raceId: string): Promise<DashboardSnapshotResponseDto> {
    const cacheKey = `dashboard-snapshot:${raceId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as DashboardSnapshotResponseDto;
      } catch {
        // fall through to recompute
      }
    }

    const race = await this.raceModel.findById(raceId).lean<RaceDocument>().exec();
    if (!race) {
      throw new NotFoundException(`Race ${raceId} not found`);
    }

    // 4 song song để tối thiểu wall time
    const [courseStats, alertStats, pollLogs] = await Promise.all([
      this.computePerCourseStats(raceId, race),
      this.computeAlertStats(raceId),
      this.fetchRecentActivity(raceId),
    ]);

    // Race-level rollup
    const raceStats = this.rollupRaceStats(courseStats, alertStats);

    // Checkpoint progression (1 query aggregation cho all courses)
    const progression = await this.computeCheckpointProgression(raceId, race);

    // Mat failure detection — fire-and-forget Telegram anomaly per checkpoint
    // có drop > threshold. Rate limited 10min/(race,course,checkpoint).
    this.detectAndDispatchMatFailures(race, progression).catch((err: Error) => {
      this.logger.warn(`[mat-failure-detect] err=${err.message}`);
    });

    const startedAtInfo = computeRaceStartedAt(race);
    const snapshot: DashboardSnapshotResponseDto = {
      race: {
        id: String(race._id),
        title: race.title,
        status: race.status,
        startDate: race.startDate ? race.startDate.toISOString() : null,
        endDate: race.endDate ? race.endDate.toISOString() : null,
        startedAt: startedAtInfo.startedAt,
        startedAtSource: startedAtInfo.source,
      },
      raceStats,
      courses: courseStats,
      checkpointProgression: progression,
      recentActivity: pollLogs,
      generatedAt: new Date().toISOString(),
    };

    await this.redis.set(
      cacheKey,
      JSON.stringify(snapshot),
      'EX',
      DashboardSnapshotService.CACHE_TTL_SECONDS,
    );

    return snapshot;
  }

  /**
   * Per-course stats — Phase 3 fix: đọc Redis cache `live-athletes:{race}:{course}`
   * trước (timing-alert poll cập nhật mỗi 30s). Fallback sang race_results
   * collection nếu cache miss (RaceSyncCron 10 phút/cycle).
   *
   * **Count logic correct:**
   * - `started` = bibs có time tại Start checkpoint (parse chiptimes JSON)
   * - `finished` = bibs có time tại Finish checkpoint
   * - `onCourse` = started - finished
   * - `leadingChipTime` = min Finish time (sort ASC)
   *
   * Trước đây count theo `timingPoint` field của race_results document — sai
   * vì timingPoint = CURRENT state (athlete finish thì timingPoint=Finish,
   * KHÔNG còn 'Start' nữa) → started count luôn ≈ 0.
   */
  private async computePerCourseStats(
    raceId: string,
    race: RaceDocument,
  ): Promise<CourseStatsDto[]> {
    const courses = race.courses ?? [];
    if (courses.length === 0) return [];

    return Promise.all(
      courses.map(async (c) => {
        const stats = await this.computeOneCourseStats(raceId, c.courseId);
        return {
          courseId: c.courseId,
          name: c.name,
          distanceKm: typeof c.distanceKm === 'number' ? c.distanceKm : null,
          cutOffTime: c.cutOffTime ?? null,
          apiUrl: c.apiUrl ?? null,
          hasCheckpoints: (c.checkpoints?.length ?? 0) > 0,
          started: stats.started,
          finished: stats.finished,
          onCourse: Math.max(0, stats.started - stats.finished),
          suspectCount: 0, // filled in later
          leadingChipTime: stats.leadingChipTime,
        };
      }),
    );
  }

  /**
   * Compute 1 course stats — try cache first, fallback DB.
   */
  private async computeOneCourseStats(
    raceId: string,
    courseId: string,
  ): Promise<{
    started: number;
    finished: number;
    leadingChipTime: string | null;
  }> {
    // Try Redis cache first (live, 5min TTL)
    const cacheKey = `timing-alert:live-athletes:${raceId}:${courseId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as {
          athletes: Array<{
            bib: string;
            checkpointTimes: Record<string, string>;
          }>;
        };
        let started = 0;
        let finished = 0;
        let leadingFinishSeconds: number | null = null;
        let leadingFinishStr: string | null = null;
        for (const a of data.athletes) {
          const startTime = findTimeCi(a.checkpointTimes, 'start');
          const finishTime = findTimeCi(a.checkpointTimes, 'finish');
          if (startTime) started += 1;
          if (finishTime) {
            finished += 1;
            const sec = parseTimeToSecondsLocal(finishTime);
            if (sec !== null && sec > 0 && (leadingFinishSeconds === null || sec < leadingFinishSeconds)) {
              leadingFinishSeconds = sec;
              leadingFinishStr = finishTime;
            }
          }
        }
        return {
          started,
          finished,
          leadingChipTime: leadingFinishStr,
        };
      }
    } catch (err) {
      this.logger.warn(
        `[computeOneCourseStats] cache read fail race=${raceId} course=${courseId}: ${(err as Error).message}`,
      );
    }

    // Fallback: race_results DB (RaceSyncCron, có thể stale 10 phút)
    type AggRow = {
      _id: { timingPoint: string };
      bibCount: number;
      leadingChipTime: string | null;
    };
    const rows = await this.resultModel
      .aggregate<AggRow>([
        { $match: { raceId, courseId } },
        {
          $group: {
            _id: { timingPoint: '$timingPoint' },
            bibCount: { $addToSet: '$bib' },
            leadingChipTime: { $min: '$chipTime' },
          },
        },
        {
          $project: {
            _id: 1,
            bibCount: { $size: '$bibCount' },
            leadingChipTime: 1,
          },
        },
      ])
      .exec();

    // Total docs = total athletes có ít nhất 1 timing point (= started)
    const totalDocs = await this.resultModel
      .countDocuments({ raceId, courseId })
      .exec();

    let finished = 0;
    let leadingChipTime: string | null = null;
    for (const row of rows) {
      const tp = (row._id.timingPoint || '').toLowerCase();
      if (tp === 'finish') {
        finished = row.bibCount;
        leadingChipTime = row.leadingChipTime;
      }
    }

    return {
      started: totalDocs,
      finished,
      leadingChipTime,
    };
  }

  /**
   * Alert stats per course (open count) cho course-card suspect badge.
   */
  private async computeAlertStats(raceId: string): Promise<{
    totalOpen: number;
    perCourse: Map<string, number>;
    perSeverityOpen: Record<'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO', number>;
  }> {
    type AggRow = { _id: { contest: string | null; severity: string }; count: number };
    const rows = await this.alertModel
      .aggregate<AggRow>([
        { $match: { race_id: raceId, status: 'OPEN' } },
        {
          $group: {
            _id: { contest: '$contest', severity: '$severity' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    let totalOpen = 0;
    const perCourse = new Map<string, number>();
    const perSeverityOpen: Record<'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO', number> = {
      CRITICAL: 0,
      HIGH: 0,
      WARNING: 0,
      INFO: 0,
    };

    for (const r of rows) {
      totalOpen += r.count;
      const sev = r._id.severity as keyof typeof perSeverityOpen;
      if (sev in perSeverityOpen) perSeverityOpen[sev] += r.count;
      const contestKey = r._id.contest ?? '__null__';
      perCourse.set(contestKey, (perCourse.get(contestKey) ?? 0) + r.count);
    }

    return { totalOpen, perCourse, perSeverityOpen };
  }

  /**
   * Roll up courses → race-level KPI. Compute avgPace từ finishers.
   */
  private rollupRaceStats(
    courses: CourseStatsDto[],
    alertStats: {
      totalOpen: number;
      perCourse: Map<string, number>;
      perSeverityOpen: Record<'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO', number>;
    },
  ): RaceStatsDto {
    let totalStarted = 0;
    let totalFinished = 0;
    let totalOnCourse = 0;

    for (const c of courses) {
      totalStarted += c.started;
      totalFinished += c.finished;
      totalOnCourse += c.onCourse;
      // Inject suspect count per course từ alert stats (match by course name)
      // RR API sets `Contest` = course name string typically
      c.suspectCount = alertStats.perCourse.get(c.name) ?? 0;
    }

    // Progress = finished / started (cap 1.0). Nếu chưa ai start → 0.
    const progress =
      totalStarted > 0 ? Math.min(1, totalFinished / totalStarted) : 0;

    return {
      started: totalStarted,
      finished: totalFinished,
      onCourse: totalOnCourse,
      suspectOpen: alertStats.totalOpen,
      criticalOpen: alertStats.perSeverityOpen.CRITICAL,
      progress: Math.round(progress * 1000) / 1000,
    };
  }

  /**
   * Checkpoint progression cho bar chart. Per course × per checkpoint key →
   * count distinct bib có time tại key đó.
   *
   * Source: race_results.chiptimes JSON string (legacy field). Parse trong
   * memory cho mỗi BIB (typically 100-5000/course → OK, không phân trang).
   *
   * Algorithm:
   * 1. Load Start/Finish records để biết started count làm denominator
   * 2. Load 1 record per BIB (lấy cái có chiptimes JSON string)
   * 3. Parse JSON → count keys
   *
   * Optimization: chỉ tính courses có checkpoints config (BTC đã apply).
   */
  private async computeCheckpointProgression(
    raceId: string,
    race: RaceDocument,
  ): Promise<CheckpointProgressionDto[]> {
    const courses = race.courses ?? [];
    const result: CheckpointProgressionDto[] = [];

    for (const course of courses) {
      const checkpoints = course.checkpoints ?? [];
      if (checkpoints.length === 0) {
        // Skip — UI sẽ hiển thị placeholder "Chưa discover checkpoints"
        result.push({
          courseId: course.courseId,
          courseName: course.name,
          distanceKm: typeof course.distanceKm === 'number' ? course.distanceKm : null,
          startedCount: 0,
          points: [],
        });
        continue;
      }

      // Phase 3 fix — Try Redis live cache first (timing-alert poll 30s),
      // fallback DB (RaceSyncCron 10 phút).
      const keyCounts = new Map<string, number>();
      let totalAthletes = 0;
      const cacheKey = `timing-alert:live-athletes:${raceId}:${course.courseId}`;
      let usedCache = false;
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const data = JSON.parse(cached) as {
            athletes: Array<{
              bib: string;
              checkpointTimes: Record<string, string>;
            }>;
          };
          totalAthletes = data.athletes.length;
          for (const a of data.athletes) {
            for (const [key, time] of Object.entries(a.checkpointTimes)) {
              if (time && typeof time === 'string' && time.trim().length > 0) {
                keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
              }
            }
          }
          usedCache = true;
        }
      } catch {
        // fall through to DB
      }

      if (!usedCache) {
        // Fallback DB
        type Row = { bib: string; chiptimes: string };
        const rows = await this.resultModel
          .aggregate<Row>([
            { $match: { raceId, courseId: course.courseId } },
            { $sort: { _id: 1 } },
            {
              $group: {
                _id: '$bib',
                chiptimes: { $first: '$chiptimes' },
              },
            },
            { $project: { _id: 0, bib: '$_id', chiptimes: 1 } },
          ])
          .exec();
        totalAthletes = rows.length;
        for (const row of rows) {
          const map = parseChiptimesSafe(row.chiptimes);
          for (const [key, time] of Object.entries(map)) {
            if (time && typeof time === 'string' && time.trim().length > 0) {
              keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
            }
          }
        }
      }

      // Started = athletes có time tại Start HOẶC nếu Start không count được
      // (vendor không emit Start), dùng max keyCounts
      const firstKey = checkpoints[0]?.key;
      const startedCount =
        firstKey && keyCounts.has(firstKey)
          ? keyCounts.get(firstKey)!
          : Math.max(0, ...Array.from(keyCounts.values()), totalAthletes);

      const points: CheckpointPointDto[] = checkpoints.map((cp, idx) => {
        const passed = keyCounts.get(cp.key) ?? 0;
        const ratio = startedCount > 0 ? passed / startedCount : 0;
        return {
          key: cp.key,
          name: cp.name || cp.key,
          distanceKm: typeof cp.distanceKm === 'number' ? cp.distanceKm : null,
          orderIndex: idx,
          passedCount: passed,
          expectedCount: startedCount,
          passedRatio: Math.round(ratio * 1000) / 1000,
        };
      });

      result.push({
        courseId: course.courseId,
        courseName: course.name,
        distanceKm: typeof course.distanceKm === 'number' ? course.distanceKm : null,
        startedCount,
        points,
      });
    }

    return result;
  }

  /**
   * Recent activity timeline — gộp poll completes + alerts mới nhất.
   *
   * Limit 30 items mới nhất, descending. UI render scrollable feed.
   */
  private async fetchRecentActivity(raceId: string): Promise<RecentActivityItemDto[]> {
    const [recentAlerts, recentPolls] = await Promise.all([
      this.alertModel
        .find({ race_id: raceId })
        .sort({ first_detected_at: -1 })
        .limit(20)
        .select({
          _id: 1,
          bib_number: 1,
          athlete_name: 1,
          contest: 1,
          severity: 1,
          status: 1,
          missing_point: 1,
          first_detected_at: 1,
          resolved_at: 1,
        })
        .lean<TimingAlertDocument[]>()
        .exec(),
      this.pollModel
        .find({ race_id: raceId, status: { $in: ['SUCCESS', 'PARTIAL'] } })
        .sort({ completed_at: -1 })
        .limit(15)
        .select({
          course_name: 1,
          status: 1,
          athletes_fetched: 1,
          alerts_created: 1,
          alerts_resolved: 1,
          completed_at: 1,
        })
        .lean<TimingAlertPollDocument[]>()
        .exec(),
    ]);

    const items: RecentActivityItemDto[] = [];

    for (const a of recentAlerts) {
      items.push({
        type: a.status === 'OPEN' ? 'alert.created' : 'alert.resolved',
        at: (a.resolved_at ?? a.first_detected_at).toISOString(),
        payload: {
          alertId: String(a._id),
          bib: a.bib_number,
          name: a.athlete_name,
          contest: a.contest,
          severity: a.severity,
          missingPoint: a.missing_point,
        },
      });
    }

    for (const p of recentPolls) {
      if (!p.completed_at) continue;
      items.push({
        type: 'poll.completed',
        at: p.completed_at.toISOString(),
        payload: {
          course: p.course_name,
          status: p.status,
          athletesFetched: p.athletes_fetched,
          alertsCreated: p.alerts_created,
          alertsResolved: p.alerts_resolved,
        },
      });
    }

    items.sort((a, b) => (a.at > b.at ? -1 : 1));
    return items.slice(0, 30);
  }

  /**
   * Detect mat failures qua checkpoint progression. Anomaly = passedRatio
   * drop > 30% giữa 2 checkpoint liên tiếp (chronological).
   *
   * Skip false positive cases:
   * - expectedCount < 20 (race đầu giờ, sample size nhỏ)
   * - First checkpoint (Start) — luôn 100% nên không có "drop"
   * - Last checkpoint (Finish) — drop là expected vì on-course athletes chưa finish
   *
   * Fire-and-forget — KHÔNG block snapshot return.
   */
  private async detectAndDispatchMatFailures(
    race: RaceDocument,
    progression: CheckpointProgressionDto[],
  ): Promise<void> {
    for (const courseProg of progression) {
      const points = courseProg.points;
      const inspectable = points.slice(0, -1);

      for (let i = 1; i < inspectable.length; i++) {
        const prev = inspectable[i - 1];
        const curr = inspectable[i];

        if (curr.expectedCount < DashboardSnapshotService.MAT_FAILURE_MIN_EXPECTED) {
          continue;
        }
        const drop = prev.passedRatio - curr.passedRatio;
        if (drop < DashboardSnapshotService.MAT_FAILURE_DROP_THRESHOLD) continue;

        await this.notification.dispatchAnomaly({
          raceId: String(race._id),
          raceTitle: race.title,
          courseName: courseProg.courseName,
          checkpointKey: curr.key,
          checkpointName: curr.name,
          expectedCount: curr.expectedCount,
          passedCount: curr.passedCount,
          previousPassedRatio: prev.passedRatio,
          currentPassedRatio: curr.passedRatio,
          dropPercentage: drop * 100,
        });
      }
    }
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

/** Find time string trong checkpointTimes map case-insensitive theo key. */
function findTimeCi(
  map: Record<string, string>,
  matchKey: string,
): string | null {
  const lower = matchKey.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) {
      const trimmed = (v || '').trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }
  return null;
}

/** Local copy parseTimeToSeconds — tránh re-import từ utils gây circular. */
function parseTimeToSecondsLocal(time: string): number | null {
  const parts = time.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/**
 * Compute race official start timestamp + source. Frontend dùng để hiển thị
 * elapsed clock trên Cockpit (ticker client-side).
 *
 * Source priority (most accurate first):
 * 1. **statusHistory** — last entry where `to === 'live'` → admin manual transition
 *    là ground truth nhất (race actually went live at that moment).
 * 2. **course startTime + race.startDate** — combine ngày race + giờ start sớm
 *    nhất trong các course (multi-course race start theo wave).
 * 3. **null** — race chưa start (status = draft/pre_race)
 *
 * For status='ended' với statusHistory missing 'live' entry → vẫn fallback
 * source 2 (BTC có thể đã skip status update giữa chừng).
 */
function computeRaceStartedAt(race: RaceDocument): {
  startedAt: string | null;
  source: 'status_history' | 'course_start_time' | 'recent_history' | null;
} {
  // Skip nếu race chưa start
  if (race.status === 'draft' || race.status === 'pre_race') {
    return { startedAt: null, source: null };
  }

  // Tier 1: statusHistory — find LAST entry transitioning TO 'live'
  const liveEntry = (race.statusHistory ?? [])
    .filter((e) => e.to === 'live' && e.changedAt)
    .sort(
      (a, b) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    )[0];
  if (liveEntry?.changedAt) {
    return {
      startedAt: new Date(liveEntry.changedAt).toISOString(),
      source: 'status_history',
    };
  }

  // Tier 2: combine race.startDate (date) + earliest course.startTime ("HH:MM")
  if (race.startDate) {
    const startTimes = (race.courses ?? [])
      .map((c) => c.startTime?.trim())
      .filter((t): t is string => !!t && /^\d{1,2}:\d{2}/.test(t))
      .sort(); // ASC string sort works for "HH:MM" 0-padded
    const earliest = startTimes[0];
    if (earliest) {
      const baseDate = new Date(race.startDate);
      const [hh, mm, ss] = earliest.split(':').map((p) => Number(p));
      baseDate.setHours(hh ?? 0, mm ?? 0, ss ?? 0, 0);
      return {
        startedAt: baseDate.toISOString(),
        source: 'course_start_time',
      };
    }
    // startDate có nhưng không có course startTime → vẫn dùng startDate at 00:00
    return {
      startedAt: new Date(race.startDate).toISOString(),
      source: 'course_start_time',
    };
  }

  // Tier 3 fallback: race=live nhưng không có data nào tốt hơn → dùng changedAt
  // entry MỚI NHẤT trong statusHistory (whatever transition). Lý do: BTC có
  // thể đã transition status nhiều lần, entry mới nhất xấp xỉ "khi đổi gần
  // nhất". Better than nothing — frontend sẽ label rõ là estimate.
  const recentEntry = (race.statusHistory ?? [])
    .filter((e) => e.changedAt)
    .sort(
      (a, b) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    )[0];
  if (recentEntry?.changedAt) {
    return {
      startedAt: new Date(recentEntry.changedAt).toISOString(),
      source: 'recent_history',
    };
  }

  // Hoàn toàn không có data → null. Frontend hiển thị message hướng dẫn config.
  return { startedAt: null, source: null };
}

