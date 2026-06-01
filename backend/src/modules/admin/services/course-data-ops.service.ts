import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import {
  RaceResult,
  RaceResultDocument,
} from '../../race-result/schemas/race-result.schema';
import {
  SyncLog,
  SyncLogDocument,
} from '../../race-result/schemas/sync-log.schema';
import { RaceResultService } from '../../race-result/services/race-result.service';
import { RaceSyncCron } from '../../race-result/services/race-sync.cron';
import { RacesService } from '../../races/races.service';
import { AuditLogService } from '../../audit/services/audit-log.service';
import {
  ClearApiUrlDto,
  ClearApiUrlResponseDto,
  CourseDataStatsResponseDto,
  DisableAndResetDto,
  DisableAndResetResponseDto,
  ResetDataDto,
  ResetDataResponseDto,
} from '../dto/course-data-ops.dto';

/**
 * F-068 — Course Data Operations service.
 *
 * Owns 4 admin operations:
 *  - GET data-stats (BR-68-01..06, BR-68-12) — read-only poll with 5s Redis cache
 *  - PATCH clear-api-url (BR-68-07, BR-68-13..14) — explicit auto-sync disable
 *  - POST disable-and-reset (BR-68-08) — atomic combo (clear → wait cron → delete)
 *  - POST reset-data EXTEND (BR-68-09) — adds nextCronAt/hasApiUrl/durationMs to legacy response
 *
 * Concurrency control (Danny chốt H 2026-05-31): Redis SETNX lock pattern
 * `reset-lock:<raceId>:<courseId>` TTL 30s — ports F-018 medical / F-019 awards.
 * Only mutating endpoints (reset-data + disable-and-reset) take the lock; the
 * clear-apiUrl path is not destructive on row data so no lock needed there.
 *
 * Audit trail: inline emit via `AuditLogService` (F-023 pattern). 3 actions:
 *  - `course.data_reset`
 *  - `course.apiUrl.cleared`
 *  - `course.disabled_and_reset`
 *
 * Actor attribution Phase 1: hardcode `'admin'` per TD-CONTRACTS-ACTOR-001
 * carry-forward (Danny chốt G defer F-069). Future fix: extract from JWT.
 */
@Injectable()
export class CourseDataOpsService {
  private readonly logger = new Logger(CourseDataOpsService.name);

  // F-068 BR-68-12: Redis cache TTL for data-stats endpoint (5s).
  private readonly STATS_CACHE_TTL_SECONDS = 5;

  // F-068 Danny chốt H: Redis SETNX lock TTL 30s.
  private readonly RESET_LOCK_TTL_SECONDS = 30;

  // F-068 BR-68-08: timeout waiting for in-flight cron iteration to finish.
  private readonly CRON_WAIT_TIMEOUT_MS = 5000;

  // F-068 BR-68-05: apiUrl mask threshold per Danny chốt C.
  // URL < this length is returned raw (mask would overlap and look silly).
  private readonly APIURL_MASK_MIN_LENGTH = 16;

  // F-068 BR-68-14: hardcoded actor until JWT extraction lands in F-069.
  private readonly ACTOR_PHASE_1 = 'admin';

  constructor(
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(SyncLog.name)
    private readonly syncLogModel: Model<SyncLogDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly racesService: RacesService,
    private readonly raceResultService: RaceResultService,
    private readonly raceSyncCron: RaceSyncCron,
    // F-067 pattern — AuditLogService optional so positional-ctor specs don't break
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────

  private statsCacheKey(raceId: string, courseId: string): string {
    return `admin:course-stats:${raceId}:${courseId}`;
  }

  private resetLockKey(raceId: string, courseId: string): string {
    return `reset-lock:${raceId}:${courseId}`;
  }

  /**
   * BR-68-05 + Danny chốt C: mask URL "head8…tail8". URL <16 chars return raw.
   */
  private maskApiUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.length < this.APIURL_MASK_MIN_LENGTH) return trimmed;
    return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
  }

  /**
   * Throws NotFoundException with consistent VN message if race or course missing.
   * Returns the course sub-document for downstream use.
   *
   * `isPrivileged=true` because every caller here is admin — we must see
   * `apiUrl` even when stripRacePrivateFields would otherwise scrub it.
   */
  private async loadRaceAndCourse(
    raceId: string,
    courseId: string,
  ): Promise<{ race: any; course: any }> {
    let race: any;
    try {
      const result = await this.racesService.getRaceById(raceId, true);
      race = result?.data;
    } catch (err) {
      // RacesService throws NotFoundException with EN message — re-throw VN for consistency
      throw new NotFoundException('Race not found');
    }
    if (!race) throw new NotFoundException('Race not found');
    const course = race.courses?.find((c: any) => c.courseId === courseId);
    if (!course) throw new NotFoundException('Course not found in race');
    return { race, course };
  }

  /**
   * BR-68-13: race=live mutations require explicit confirmedLive=true.
   * Throws 409 with `code: 'RACE_IS_LIVE_CONFIRM_REQUIRED'`.
   */
  private assertLiveConfirmation(race: any, confirmedLive?: boolean): void {
    if (race.status === 'live' && confirmedLive !== true) {
      throw new ConflictException({
        statusCode: 409,
        code: 'RACE_IS_LIVE_CONFIRM_REQUIRED',
        message: 'Race đang LIVE — gửi confirmedLive=true để xác nhận',
      });
    }
  }

  /**
   * Danny chốt H: SETNX lock to serialize concurrent mutation. Returns the lock
   * release function (caller MUST call in finally). Throws 409 if already held.
   */
  private async acquireResetLock(
    raceId: string,
    courseId: string,
  ): Promise<() => Promise<void>> {
    const key = this.resetLockKey(raceId, courseId);
    const acquired = await this.redis.set(
      key,
      '1',
      'EX',
      this.RESET_LOCK_TTL_SECONDS,
      'NX',
    );
    if (acquired !== 'OK') {
      throw new ConflictException({
        statusCode: 409,
        code: 'RESET_IN_PROGRESS',
        message: 'Đang có người khác xóa, chờ vài giây',
      });
    }
    return async () => {
      try {
        await this.redis.del(key);
      } catch (err: any) {
        this.logger.warn(`Failed to release reset-lock ${key}: ${err.message}`);
      }
    };
  }

  /**
   * BR-68-08 step 2: poll `RaceSyncCron.isCurrentlySync()` until clear or
   * 5s timeout. Continues anyway on timeout (logs warn) so admins are never
   * blocked by a runaway cron.
   */
  private async waitForCronIdle(): Promise<void> {
    const start = Date.now();
    while (this.raceSyncCron.isCurrentlySync()) {
      if (Date.now() - start > this.CRON_WAIT_TIMEOUT_MS) {
        this.logger.warn(
          `[F-068] cron wait timeout exceeded after ${this.CRON_WAIT_TIMEOUT_MS}ms — continuing reset anyway`,
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  /**
   * Best-effort audit emit. Swallow errors so audit failure never rolls back
   * business mutation (matches F-023 + F-067 wrapper convention).
   */
  private async emitAudit(
    action: string,
    raceId: string,
    courseId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    if (!this.auditLog) {
      this.logger.warn(
        `[F-068] AuditLogService not bound — skip emit action=${action} race=${raceId} course=${courseId}`,
      );
      return;
    }
    try {
      await this.auditLog.emit({
        actor: { userId: this.ACTOR_PHASE_1, displayName: 'Admin' },
        action,
        entity: { type: 'course', id: `${raceId}:${courseId}` },
        metadata,
      });
    } catch (err: any) {
      this.logger.warn(
        `[F-068] AuditLog emit failed (best-effort) action=${action}: ${err.message}`,
      );
    }
  }

  /**
   * BR-68-06 cronStatus derivation:
   *  - `disabled` → no apiUrl
   *  - `in_progress` → RaceSyncCron currently running
   *  - `scheduled` → has apiUrl + idle cron
   */
  private deriveCronStatus(hasApiUrl: boolean): {
    status: 'scheduled' | 'in_progress' | 'disabled';
    nextCronAt: Date | null;
  } {
    if (!hasApiUrl) return { status: 'disabled', nextCronAt: null };
    if (this.raceSyncCron.isCurrentlySync()) {
      return { status: 'in_progress', nextCronAt: null };
    }
    return {
      status: 'scheduled',
      nextCronAt: this.raceSyncCron.getNextScheduledRunAt(),
    };
  }

  // ─── BR-68-01..06: GET data-stats ─────────────────────────────

  async getStats(
    raceId: string,
    courseId: string,
  ): Promise<CourseDataStatsResponseDto> {
    // 5s Redis cache wrap (BR-68-12) — but always re-verify race/course exist
    // so we never serve cached stats for a deleted resource.
    const cacheKey = this.statsCacheKey(raceId, courseId);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as CourseDataStatsResponseDto;
      }
    } catch (err: any) {
      this.logger.warn(`Redis GET stats cache failed: ${err.message}`);
    }

    const { course } = await this.loadRaceAndCourse(raceId, courseId);

    // Parallel fetch row count + latest sync log
    const [rowCount, lastLog] = await Promise.all([
      this.resultModel.countDocuments({ raceId, courseId }).exec(),
      this.syncLogModel
        .findOne({ raceId, courseId })
        .sort({ created_at: -1 })
        .lean()
        .exec(),
    ]);

    const apiUrlRaw = typeof course.apiUrl === 'string' ? course.apiUrl : '';
    const hasApiUrl = apiUrlRaw.trim().length > 0;
    const cronInfo = this.deriveCronStatus(hasApiUrl);

    const dto: CourseDataStatsResponseDto = {
      rowCount,
      lastSyncedAt: lastLog?.created_at
        ? (lastLog.created_at as Date).toISOString()
        : null,
      lastSyncStatus: lastLog
        ? ((lastLog as any).status as 'success' | 'failed')
        : null,
      lastSyncDurationMs:
        typeof (lastLog as any)?.durationMs === 'number'
          ? (lastLog as any).durationMs
          : null,
      hasApiUrl,
      apiUrlMasked: hasApiUrl ? this.maskApiUrl(apiUrlRaw) : null,
      nextCronAt: cronInfo.nextCronAt ? cronInfo.nextCronAt.toISOString() : null,
      cronStatus: cronInfo.status,
    };

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(dto),
        'EX',
        this.STATS_CACHE_TTL_SECONDS,
      );
    } catch (err: any) {
      this.logger.warn(`Redis SET stats cache failed: ${err.message}`);
    }

    return dto;
  }

  private async invalidateStatsCache(
    raceId: string,
    courseId: string,
  ): Promise<void> {
    try {
      await this.redis.del(this.statsCacheKey(raceId, courseId));
    } catch (err: any) {
      this.logger.warn(`Redis DEL stats cache failed: ${err.message}`);
    }
  }

  // ─── BR-68-07, 13..14: PATCH clear-api-url ────────────────────

  async clearApiUrl(
    raceId: string,
    courseId: string,
    dto: ClearApiUrlDto = {},
  ): Promise<ClearApiUrlResponseDto> {
    const { race, course } = await this.loadRaceAndCourse(raceId, courseId);
    this.assertLiveConfirmation(race, dto.confirmedLive);

    const prevApiUrl: string | null =
      typeof course.apiUrl === 'string' && course.apiUrl.trim().length > 0
        ? course.apiUrl
        : null;

    // updateCourse() uses $unset when value is undefined (line 297-310)
    await this.racesService.updateCourse(raceId, courseId, {
      apiUrl: undefined,
    } as any);

    await this.invalidateStatsCache(raceId, courseId);

    await this.emitAudit('course.apiUrl.cleared', raceId, courseId, {
      raceId,
      courseId,
      prevApiUrl, // raw in audit metadata — internal collection, admin-only read
      raceWasLive: race.status === 'live',
    });

    return {
      message: `Đã tắt auto-sync course ${course.name || courseId}`,
      success: true,
      prevApiUrlMasked: this.maskApiUrl(prevApiUrl),
    };
  }

  // ─── BR-68-08: POST disable-and-reset ─────────────────────────

  async disableAndReset(
    raceId: string,
    courseId: string,
    dto: DisableAndResetDto = {},
  ): Promise<DisableAndResetResponseDto> {
    const start = Date.now();
    const { race, course } = await this.loadRaceAndCourse(raceId, courseId);
    this.assertLiveConfirmation(race, dto.confirmedLive);

    const release = await this.acquireResetLock(raceId, courseId);
    try {
      const prevApiUrl: string | null =
        typeof course.apiUrl === 'string' && course.apiUrl.trim().length > 0
          ? course.apiUrl
          : null;

      // Step 1: clear apiUrl FIRST so cron doesn't re-fetch mid-delete
      if (prevApiUrl) {
        await this.racesService.updateCourse(raceId, courseId, {
          apiUrl: undefined,
        } as any);
      }

      // Step 2: wait for any in-flight cron iteration to finish
      await this.waitForCronIdle();

      // Step 3: delete results with raceId-scoped filter (BR-68-10)
      const deletedCount = await this.raceResultService.deleteResultsByCourse(
        raceId,
        courseId,
      );

      // Step 4: invalidate stats cache (deleteResultsByCourse already purged
      // the result/athlete/badge keys via purgeCache hook).
      await this.invalidateStatsCache(raceId, courseId);

      // Step 5: audit log
      const durationMs = Date.now() - start;
      await this.emitAudit('course.disabled_and_reset', raceId, courseId, {
        raceId,
        courseId,
        prevApiUrl,
        deletedCount,
        durationMs,
        raceWasLive: race.status === 'live',
      });

      return {
        message: `Đã tắt auto-sync + xóa ${deletedCount} kết quả — course ${
          course.name || courseId
        }`,
        deletedCount,
        success: true,
        prevApiUrlMasked: this.maskApiUrl(prevApiUrl),
        durationMs,
        hasApiUrl: false,
        nextCronAt: null,
      };
    } finally {
      await release();
    }
  }

  // ─── BR-68-09: POST reset-data EXTEND ─────────────────────────

  async resetData(
    raceId: string,
    courseId: string,
    dto: ResetDataDto = {},
  ): Promise<ResetDataResponseDto> {
    const start = Date.now();
    const { race, course } = await this.loadRaceAndCourse(raceId, courseId);
    this.assertLiveConfirmation(race, dto.confirmedLive);

    const release = await this.acquireResetLock(raceId, courseId);
    try {
      const deletedCount = await this.raceResultService.deleteResultsByCourse(
        raceId,
        courseId,
      );
      await this.invalidateStatsCache(raceId, courseId);

      const hasApiUrl =
        typeof course.apiUrl === 'string' && course.apiUrl.trim().length > 0;
      const cronInfo = this.deriveCronStatus(hasApiUrl);
      const durationMs = Date.now() - start;

      await this.emitAudit('course.data_reset', raceId, courseId, {
        raceId,
        courseId,
        deletedCount,
        durationMs,
        raceWasLive: race.status === 'live',
      });

      return {
        message: `Deleted ${deletedCount} results for course ${courseId}`,
        deletedCount,
        success: true,
        nextCronAt: cronInfo.nextCronAt
          ? cronInfo.nextCronAt.toISOString()
          : null,
        hasApiUrl,
        durationMs,
      };
    } finally {
      await release();
    }
  }
}
