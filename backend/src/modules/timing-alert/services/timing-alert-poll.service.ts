import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import {
  TimingAlert,
  TimingAlertDocument,
  TimingAlertSeverity,
} from '../schemas/timing-alert.schema';
import {
  TimingAlertPoll,
  TimingAlertPollDocument,
  TimingAlertPollStatus,
} from '../schemas/timing-alert-poll.schema';
import {
  TimingAlertConfig,
  TimingAlertConfigDocument,
} from '../schemas/timing-alert-config.schema';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import { TimingAlertConfigService } from './timing-alert-config.service';
import { RaceResultApiService } from '../../race-result/services/race-result-api.service';
import { MissDetectorService, DetectionResult } from './miss-detector.service';
import { ProjectedRankService } from './projected-rank.service';
import {
  parseRaceResultAthlete,
  ParsedAthlete,
} from '../utils/parsed-athlete';
import { CourseCheckpoint } from '../utils/parsed-athlete';
import { TimingAlertSseService } from './timing-alert-sse.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

/**
 * Parse "5K", "5KM", "42.195KM", "10km", "42 KM" → number km.
 * Fallback null nếu không parse được.
 */
function parseDistanceStr(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Phase 1B — orchestrate 1 poll cycle cho 1 race × 1 course.
 *
 * Flow per cycle:
 * 1. Acquire Redis SETNX `timing-alert:polling:{raceId}:{course}` — anti-overlap
 * 2. Decrypt RR API key cho course
 * 3. Build URL + fetch RR API qua `RaceResultApiService` (Phase 0 shared)
 * 4. Parse mỗi athlete → MissDetector.detect()
 * 5. Nếu phantom: compute projected rank → classifySeverity →
 *    upsert alert (atomic increment detection_count nếu đã OPEN)
 * 6. Auto-resolve OPEN alerts có time đã xuất hiện
 * 7. Insert poll log + emit SSE event + dispatch Telegram CRITICAL
 *
 * **Concurrency safety:**
 * - SETNX lock per (race, course) TTL = poll_interval_seconds
 * - Atomic upsert dùng `findOneAndUpdate` với compound filter `(race, bib, status:OPEN)`
 *
 * **Error handling:**
 * - RR API timeout → log poll FAILED, KHÔNG fail-open (no fake alerts)
 * - Mongo write fail → poll PARTIAL, log error, return partial counts
 */
@Injectable()
export class TimingAlertPollService {
  private readonly logger = new Logger(TimingAlertPollService.name);

  constructor(
    @InjectModel(TimingAlert.name)
    private readonly alertModel: Model<TimingAlertDocument>,
    @InjectModel(TimingAlertPoll.name)
    private readonly pollModel: Model<TimingAlertPollDocument>,
    @InjectModel(TimingAlertConfig.name)
    private readonly configModel: Model<TimingAlertConfigDocument>,
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: TimingAlertConfigService,
    private readonly apiService: RaceResultApiService,
    private readonly missDetector: MissDetectorService,
    private readonly projectedRankService: ProjectedRankService,
    private readonly sse: TimingAlertSseService,
    private readonly notification: NotificationDispatcherService,
  ) {}

  /**
   * Poll 1 race tất cả course. Caller (cron / admin force-poll) gọi method này.
   *
   * Returns aggregate counts cho admin response. Per-course detail lưu poll_logs.
   */
  async pollRace(raceId: string, triggeredBy: string): Promise<{
    courses: Array<{ course: string; status: TimingAlertPollStatus; alerts_created: number; alerts_resolved: number; error?: string }>;
  }> {
    const config = await this.configModel.findOne({ race_id: raceId }).lean<TimingAlertConfigDocument>().exec();
    if (!config) {
      throw new Error(`No timing-alert config for race=${raceId}`);
    }
    if (!config.enabled) {
      this.logger.log(`[pollRace] race=${raceId} disabled — skip`);
      return { courses: [] };
    }

    // Load Race document — single source of truth cho course config (apiUrl,
    // checkpoints, cutoff). Manager review 03/05/2026 confirmed drop dup
    // schema fields (rr_event_id, rr_api_keys, course_checkpoints, cutoff_times).
    const race = await this.raceModel.findById(raceId).lean<RaceDocument>().exec();
    if (!race) {
      throw new Error(`Race document not found for race=${raceId}`);
    }

    // Filter courses có apiUrl (race-result module pattern — chỉ poll course
    // được wire RR API key)
    const eligibleCourses = (race.courses ?? []).filter((c) => c.apiUrl?.trim());
    if (eligibleCourses.length === 0) {
      this.logger.warn(
        `[pollRace] race=${raceId} không có course nào có apiUrl — skip`,
      );
      return { courses: [] };
    }

    const results: Array<{
      course: string;
      status: TimingAlertPollStatus;
      alerts_created: number;
      alerts_resolved: number;
      error?: string;
    }> = [];

    for (const course of eligibleCourses) {
      const result = await this.pollCourse(raceId, course, config, triggeredBy);
      results.push({ course: course.name, ...result });
    }

    await this.configService.updateLastPolled(raceId);
    return { courses: results };
  }

  /**
   * Poll 1 race × 1 course. Lock-protected.
   *
   * Manager refactor 03/05/2026: course param giờ là `RaceCourse` document
   * subobject từ Race document (KHÔNG phải course.name string). Service đọc
   * `apiUrl, checkpoints, cutOffTime, courseId` thẳng từ subobject.
   */
  async pollCourse(
    raceId: string,
    course: {
      courseId: string;
      name: string;
      apiUrl?: string;
      cutOffTime?: string;
      checkpoints?: Array<{ key: string; name: string; distance?: string; distanceKm?: number }>;
    },
    config: TimingAlertConfigDocument,
    triggeredBy: string,
  ): Promise<{ status: TimingAlertPollStatus; alerts_created: number; alerts_resolved: number; error?: string }> {
    const courseId = course.courseId;
    const lockKey = `timing-alert:polling:${raceId}:${courseId}`;
    const ttl = Math.min(config.poll_interval_seconds ?? 90, 300);
    const acquired = await this.redis.set(lockKey, '1', 'EX', ttl, 'NX');
    if (acquired !== 'OK') {
      this.logger.warn(
        `[pollCourse] race=${raceId} course=${courseId} lock held — skip`,
      );
      return { status: 'PARTIAL', alerts_created: 0, alerts_resolved: 0, error: 'lock-held' };
    }

    const t0 = Date.now();
    const pollLog = await this.pollModel.create({
      race_id: raceId,
      course_name: course.name,
      status: 'SUCCESS' as TimingAlertPollStatus, // optimistic, finalize cuối
      athletes_fetched: 0,
      alerts_created: 0,
      alerts_resolved: 0,
      alerts_unchanged: 0,
      duration_ms: 0,
    });

    try {
      // 1. Validate apiUrl from race document (single source of truth)
      const apiUrl = course.apiUrl?.trim();
      if (!apiUrl) {
        throw new Error(
          `Course "${course.name}" thiếu apiUrl trong race document — sửa qua /admin/races/${raceId}/edit`,
        );
      }

      // 2. Fetch RR API (Phase 0 shared service)
      const rawAthletes = await this.apiService.fetchRaceResults(apiUrl);

      // 3. Map race.courses[].checkpoints → internal CourseCheckpoint shape
      // Fallback: parse `distance` string ("5K") nếu `distanceKm` missing
      // (legacy data — admin hasn't migrated yet).
      const rawCheckpoints = course.checkpoints ?? [];
      if (rawCheckpoints.length === 0) {
        throw new Error(
          `Course "${course.name}" thiếu checkpoints trong race document — sửa qua /admin/races/${raceId}/edit`,
        );
      }
      const checkpoints: CourseCheckpoint[] = rawCheckpoints
        .map((cp) => ({
          key: cp.key,
          distance_km:
            typeof cp.distanceKm === 'number'
              ? cp.distanceKm
              : (parseDistanceStr(cp.distance) ?? 0),
        }))
        .filter((cp) => cp.distance_km >= 0);

      const parsed: ParsedAthlete[] = rawAthletes
        .map((a) => parseRaceResultAthlete(a, checkpoints))
        .filter((a) => a.bib && a.bib !== '0');

      // 4. Detect phantoms + upsert alerts
      let alertsCreated = 0;
      let alertsUnchanged = 0;
      const detectedBibs = new Set<string>();

      // TA-11: cutoff time từ race document
      const cutoffTime = course.cutOffTime?.trim() || null;

      for (const athlete of parsed) {
        const detection = this.missDetector.detect(
          athlete,
          checkpoints,
          config.overdue_threshold_minutes ?? 30,
          { cutoffTime },
        );
        if (!detection) continue;

        // TA-12: FALSE_ALARM 3-day cooldown — skip flag nếu BIB đã được
        // mark FALSE_ALARM trong 3 ngày qua (DNF confirmed). Tránh re-detect
        // gây noise sau khi BTC đã verify.
        if (await this.isInFalseAlarmCooldown(raceId, athlete.bib)) {
          continue;
        }

        detectedBibs.add(athlete.bib);

        // Compute projected rank — race_id Mongo string + courseId từ race
        // document (Manager refactor 03/05: drop dual-ID + course_name → courseId)
        const projectedRank = await this.projectedRankService.calculate(
          raceId,
          courseId,
          athlete.ageGroup,
          detection.projectedFinishSeconds,
        );

        const severityResult = this.missDetector.classifySeverity(
          detection,
          projectedRank,
          config.top_n_alert ?? 3,
        );

        const upsertResult = await this.upsertAlert(
          raceId,
          athlete,
          detection,
          severityResult.severity,
          severityResult.reason,
          projectedRank,
        );

        if (upsertResult.isNew) {
          alertsCreated += 1;
          this.sse.emit('alert.created', raceId, this.alertSummary(upsertResult.doc));

          if (severityResult.severity === 'CRITICAL') {
            // Fire-and-forget Telegram dispatch — KHÔNG block poll cycle
            this.notification.dispatchCritical(upsertResult.doc).catch((err: Error) => {
              this.logger.warn(`[Telegram] dispatch fail: ${err.message}`);
            });
          }
        } else {
          alertsUnchanged += 1;
          this.sse.emit('alert.updated', raceId, this.alertSummary(upsertResult.doc));
        }
      }

      // 5. Auto-resolve: check OPEN alerts có time at missing_point đã xuất hiện
      const alertsResolved = await this.autoResolveOpen(raceId, parsed);

      // 6. Finalize poll log
      const duration = Date.now() - t0;
      await this.pollModel.updateOne(
        { _id: pollLog._id },
        {
          $set: {
            status: 'SUCCESS',
            athletes_fetched: parsed.length,
            alerts_created: alertsCreated,
            alerts_resolved: alertsResolved,
            alerts_unchanged: alertsUnchanged,
            duration_ms: duration,
            completed_at: new Date(),
          },
        },
      );

      this.sse.emit('poll.completed', raceId, {
        course: course.name,
        athletes_fetched: parsed.length,
        alerts_created: alertsCreated,
        alerts_resolved: alertsResolved,
        duration_ms: duration,
      });

      this.logger.log(
        `[pollCourse] race=${raceId} course=${course.name} fetched=${parsed.length} created=${alertsCreated} resolved=${alertsResolved} ms=${duration}`,
      );

      return {
        status: 'SUCCESS',
        alerts_created: alertsCreated,
        alerts_resolved: alertsResolved,
      };
    } catch (err) {
      const message = (err as Error).message;
      const duration = Date.now() - t0;
      await this.pollModel.updateOne(
        { _id: pollLog._id },
        {
          $set: {
            status: 'FAILED',
            duration_ms: duration,
            completed_at: new Date(),
            error_message: message.slice(0, 1000),
          },
        },
      );
      this.sse.emit('poll.failed', raceId, { course: course.name, error: message });
      this.logger.error(
        `[pollCourse] race=${raceId} course=${course.name} FAILED: ${message}`,
      );
      return { status: 'FAILED', alerts_created: 0, alerts_resolved: 0, error: message };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * Atomic upsert alert. Findone với filter `(race, bib, status: OPEN)`:
   * - Nếu đã OPEN → increment `detection_count` + push audit log
   * - Nếu chưa → create new
   *
   * Returns `{ doc, isNew }`.
   */
  private async upsertAlert(
    raceId: string,
    athlete: ParsedAthlete,
    detection: DetectionResult,
    severity: TimingAlertSeverity,
    reason: string,
    projectedRank: { overallRank: number | null; ageGroupRank: number | null; confidence: number; totalFinishers: number } | null,
  ): Promise<{ doc: TimingAlertDocument; isNew: boolean }> {
    // Try findOneAndUpdate existing OPEN — increment detection_count, không tạo mới
    const existing = await this.alertModel.findOneAndUpdate(
      { race_id: raceId, bib_number: athlete.bib, status: 'OPEN' },
      {
        $inc: { detection_count: 1 },
        $set: {
          severity,
          reason,
          last_seen_point: detection.lastSeenPoint,
          last_seen_time: detection.lastSeenTime,
          overdue_minutes: detection.overdueMinutes,
          projected_finish_time: detection.projectedFinishTime,
          projected_overall_rank: projectedRank?.overallRank ?? null,
          projected_age_group_rank: projectedRank?.ageGroupRank ?? null,
          projected_confidence: projectedRank?.confidence ?? null,
        },
        $push: {
          audit_log: {
            action: 'RE_DETECT',
            by: 'system',
            at: new Date(),
            note: `detection_count increment, severity=${severity}`,
          },
        },
      },
      { new: true },
    ).exec();

    if (existing) {
      return { doc: existing, isNew: false };
    }

    // Create new
    const created = await this.alertModel.create({
      race_id: raceId,
      bib_number: athlete.bib,
      athlete_name: athlete.fullName,
      contest: athlete.contest,
      age_group: athlete.ageGroup,
      gender: athlete.gender,
      last_seen_point: detection.lastSeenPoint,
      last_seen_time: detection.lastSeenTime,
      missing_point: detection.missingPoint,
      projected_finish_time: detection.projectedFinishTime,
      projected_overall_rank: projectedRank?.overallRank ?? null,
      projected_age_group_rank: projectedRank?.ageGroupRank ?? null,
      projected_confidence: projectedRank?.confidence ?? null,
      overdue_minutes: detection.overdueMinutes,
      severity,
      reason,
      status: 'OPEN',
      detection_count: 1,
      audit_log: [
        { action: 'CREATE', by: 'system', at: new Date(), note: `Initial detect — ${reason}` },
      ],
      rr_api_snapshot: { Bib: athlete.raw.Bib, Chiptimes: athlete.raw.Chiptimes, TimingPoint: athlete.raw.TimingPoint, Category: athlete.raw.Category },
    });

    return { doc: created, isNew: true };
  }

  /**
   * TA-12: Check FALSE_ALARM cooldown 3 ngày. Tránh re-flag athlete đã
   * được BTC confirm DNF.
   *
   * Logic: tìm alert gần nhất (race, bib) status=FALSE_ALARM, resolved_at
   * trong 3 ngày qua → skip flag.
   *
   * Per-call query — Phase 2 có thể cache Redis SET `false-alarm:{race}` nếu
   * scale yêu cầu.
   */
  private async isInFalseAlarmCooldown(
    raceId: string,
    bib: string,
  ): Promise<boolean> {
    const cooldownMs = 3 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - cooldownMs);
    const recent = await this.alertModel
      .findOne({
        race_id: raceId,
        bib_number: bib,
        status: 'FALSE_ALARM',
        resolved_at: { $gte: cutoff },
      })
      .select({ _id: 1 })
      .lean()
      .exec();
    return recent !== null;
  }

  /**
   * Auto-resolve OPEN alerts: nếu athlete đã có time tại `missing_point` →
   * mark RESOLVED.
   *
   * Match poll cycle scope — chỉ resolve alerts mà BIB xuất hiện trong RR
   * response lần này. KHÔNG resolve alerts của BIB không có trong response
   * (RR API chưa update — giữ status OPEN).
   */
  private async autoResolveOpen(
    raceId: string,
    parsedAthletes: ParsedAthlete[],
  ): Promise<number> {
    const byBib = new Map(parsedAthletes.map((a) => [a.bib, a]));
    const openAlerts = await this.alertModel
      .find({ race_id: raceId, status: 'OPEN' })
      .lean<TimingAlertDocument[]>()
      .exec();

    let resolved = 0;
    for (const alert of openAlerts) {
      const athlete = byBib.get(alert.bib_number);
      if (!athlete) continue;
      const time = athlete.checkpointTimes[alert.missing_point];
      if (!time || time.trim().length === 0) continue;

      // Mark RESOLVED
      const updated = await this.alertModel.findOneAndUpdate(
        { _id: alert._id, status: 'OPEN' },
        {
          $set: {
            status: 'RESOLVED',
            resolved_by: 'auto',
            resolved_at: new Date(),
            resolution_note: `Auto-resolved: ${alert.missing_point} time appeared = ${time}`,
          },
          $push: {
            audit_log: {
              action: 'AUTO_RESOLVE',
              by: 'system',
              at: new Date(),
              note: `Time appeared at ${alert.missing_point}: ${time}`,
            },
          },
        },
        { new: true },
      ).exec();
      if (updated) {
        resolved += 1;
        this.sse.emit('alert.resolved', raceId, this.alertSummary(updated));
      }
    }
    return resolved;
  }

  /**
   * Subset cho SSE event payload — KHÔNG gửi full audit_log + rr_api_snapshot
   * (admin tab không cần realtime, fetch full khi click row).
   */
  private alertSummary(alert: TimingAlertDocument): Record<string, unknown> {
    return {
      id: String(alert._id),
      bib_number: alert.bib_number,
      athlete_name: alert.athlete_name,
      contest: alert.contest,
      age_group: alert.age_group,
      severity: alert.severity,
      status: alert.status,
      last_seen_point: alert.last_seen_point,
      last_seen_time: alert.last_seen_time,
      missing_point: alert.missing_point,
      projected_finish_time: alert.projected_finish_time,
      projected_age_group_rank: alert.projected_age_group_rank,
      projected_overall_rank: alert.projected_overall_rank,
      projected_confidence: alert.projected_confidence,
      overdue_minutes: alert.overdue_minutes,
      first_detected_at: alert.first_detected_at,
      detection_count: alert.detection_count,
    };
  }

  // ─────────── Admin actions ───────────

  /**
   * Manual resolve hoặc mark FALSE_ALARM. Idempotent — chỉ transitions từ OPEN.
   *
   * **IDOR fix:** filter compound `(_id, race_id)` ngăn admin Race A patch
   * alert của Race B (URL alertId guess + Mongo ObjectId 24-hex enumerable
   * trên race day với 10K alerts).
   */
  async resolveAlert(
    alertId: string,
    action: 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN',
    note: string,
    userId: string,
    raceId: string,
  ): Promise<TimingAlertDocument> {
    let update: Record<string, unknown>;
    let auditAction: string;

    if (action === 'REOPEN') {
      auditAction = 'REOPEN';
      update = {
        $set: {
          status: 'OPEN',
          resolved_by: null,
          resolved_at: null,
          resolution_note: null,
        },
      };
    } else {
      auditAction = action;
      update = {
        $set: {
          status: action === 'RESOLVE' ? 'RESOLVED' : 'FALSE_ALARM',
          resolved_by: `admin:${userId}`,
          resolved_at: new Date(),
          resolution_note: note,
        },
      };
    }

    // Compound filter `(_id, race_id)` chống IDOR cross-race.
    const updated = await this.alertModel.findOneAndUpdate(
      { _id: alertId, race_id: raceId },
      {
        ...update,
        $push: {
          audit_log: {
            action: auditAction,
            by: `admin:${userId}`,
            at: new Date(),
            note,
          },
        },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new Error(
        `Alert ${alertId} not found in race ${raceId} (or wrong race scope)`,
      );
    }
    this.sse.emit(
      action === 'REOPEN' ? 'alert.updated' : 'alert.resolved',
      updated.race_id,
      this.alertSummary(updated),
    );
    return updated;
  }

  /**
   * Admin list alerts với filter. Pagination + stats.
   */
  async listAlerts(
    raceId: string,
    filters: {
      severity?: TimingAlertSeverity;
      status?: 'OPEN' | 'RESOLVED' | 'FALSE_ALARM';
      course?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{
    items: TimingAlertDocument[];
    total: number;
    page: number;
    pageSize: number;
    stats: {
      by_severity: Record<TimingAlertSeverity, number>;
      open_count: number;
      total_count: number;
    };
  }> {
    const filter: Record<string, unknown> = { race_id: raceId };
    if (filters.severity) filter.severity = filters.severity;
    if (filters.status) filter.status = filters.status;
    if (filters.course) filter.contest = filters.course;

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, filters.pageSize ?? 50);

    const [items, total, statsAgg, openCount] = await Promise.all([
      this.alertModel
        .find(filter)
        .sort({ first_detected_at: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<TimingAlertDocument[]>()
        .exec(),
      this.alertModel.countDocuments(filter).exec(),
      // QC fix: stats by_severity PHẢI align với current filter (đặc biệt
      // status). Trước đây aggregate `{race_id}` only → UI hiển thị tổng
      // CRITICAL gồm cả RESOLVED/FALSE_ALARM → sai khi admin filter "OPEN"
      // chỉ cần CRITICAL OPEN count.
      this.alertModel
        .aggregate<{ _id: TimingAlertSeverity; count: number }>([
          { $match: filter },
          { $group: { _id: '$severity', count: { $sum: 1 } } },
        ])
        .exec(),
      this.alertModel.countDocuments({ race_id: raceId, status: 'OPEN' }).exec(),
    ]);

    const by_severity: Record<TimingAlertSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      WARNING: 0,
      INFO: 0,
    };
    for (const s of statsAgg) by_severity[s._id] = s.count;

    return {
      items,
      total,
      page,
      pageSize,
      stats: {
        by_severity,
        open_count: openCount,
        total_count: total,
      },
    };
  }

  async listPollLogs(raceId: string, limit = 50): Promise<TimingAlertPollDocument[]> {
    return this.pollModel
      .find({ race_id: raceId })
      .sort({ started_at: -1 })
      .limit(Math.min(200, Math.max(1, limit)))
      .lean<TimingAlertPollDocument[]>()
      .exec();
  }
}
