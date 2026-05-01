import {
  ConflictException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RaceAthlete,
  RaceAthleteDocument,
} from '../schemas/race-athlete.schema';
import {
  RaceMasterSyncLog,
  RaceMasterSyncLogDocument,
} from '../schemas/race-master-sync-log.schema';
import { RaceAthletePublicDto } from '../dto/race-athlete-public.dto';
import { RaceAthleteAdminDto } from '../dto/race-athlete-admin.dto';
import { toAdminView, toPublicView } from '../utils/athlete-mapper';
import { RaceMasterCacheService } from './race-master-cache.service';
import { RaceAthleteSyncService } from './race-athlete-sync.service';
import {
  ListAthletesQueryDto,
  ListAthletesResponseDto,
} from '../dto/list-athletes.dto';
import { RaceAthleteStatsDto } from '../dto/stats.dto';
import {
  RACE_MASTER_STATS_TTL_SECONDS,
} from '../utils/redis-keys';

/**
 * PUBLIC DI service. Consumer modules (chip-verify v1.3, checkpoint-capture)
 * inject this. Single source of truth cho athlete lookup.
 *
 * 3-tier cache:
 *   1. Redis HGET — < 5ms
 *   2. MongoDB findOne — < 30ms
 *   3. MySQL on-demand fallback (write-through) — < 80ms
 *
 * PII boundary: 2 method tách biệt — `lookupByBib` (public) vs
 * `lookupByBibAdmin` (PII). Type system enforce qua return type.
 */
@Injectable()
export class RaceAthleteLookupService {
  private readonly logger = new Logger(RaceAthleteLookupService.name);

  constructor(
    @InjectModel(RaceAthlete.name)
    private readonly raceAthleteModel: Model<RaceAthleteDocument>,
    @InjectModel(RaceMasterSyncLog.name)
    private readonly syncLogModel: Model<RaceMasterSyncLogDocument>,
    private readonly cache: RaceMasterCacheService,
    private readonly syncService: RaceAthleteSyncService,
  ) {}

  // ─────────── PUBLIC LOOKUP (no PII) ───────────

  async lookupByBib(
    raceId: number,
    bibNumber: string,
  ): Promise<RaceAthletePublicDto | null> {
    const bib = bibNumber.trim();
    if (!bib) return null;

    // Tier 1: Redis
    const cached = await this.cache.getByBib(raceId, bib);
    if (cached) return cached;

    // Tier 2: Mongo (write-through to Redis)
    const doc = await this.raceAthleteModel
      .findOne({ mysql_race_id: raceId, bib_number: bib })
      .lean<RaceAthlete>()
      .exec();
    if (doc) {
      const view = toPublicView(doc);
      await this.cache.setByBib(raceId, bib, view);
      return view;
    }

    // Tier 3: MySQL on-demand fallback (anti-stampede via lookup-lock)
    return this.fallbackByBib(raceId, bib);
  }

  /**
   * Bulk lookup. Consumer pattern: leaderboard, OCR match. Stays Redis-fast.
   * Mongo fallback only for misses; KHÔNG chạy MySQL fallback bulk
   * (avoid hammering replica). Caller phải triggerSync trước nếu cần data
   * complete.
   */
  async lookupBibs(
    raceId: number,
    bibs: string[],
  ): Promise<Map<string, RaceAthletePublicDto>> {
    // QC Security #6 — cap input. Prevents memory blow + Redis HMGET storm.
    const MAX_BULK_BIBS = 1000;
    if (bibs.length > MAX_BULK_BIBS) {
      throw new PayloadTooLargeException(
        `lookupBibs: max ${MAX_BULK_BIBS} bibs per call (got ${bibs.length})`,
      );
    }
    const cleanBibs = Array.from(new Set(bibs.map((b) => b.trim()).filter(Boolean)));
    if (cleanBibs.length === 0) return new Map();

    const result = await this.cache.getManyByBibs(raceId, cleanBibs);
    const missing = cleanBibs.filter((b) => !result.has(b));
    if (missing.length === 0) return result;

    const docs = await this.raceAthleteModel
      .find({
        mysql_race_id: raceId,
        bib_number: { $in: missing },
      })
      .lean<RaceAthlete[]>()
      .exec();
    for (const d of docs) {
      if (!d.bib_number) continue;
      const view = toPublicView(d);
      result.set(d.bib_number, view);
      // Best-effort write-through; fire-and-forget to avoid blocking caller.
      this.cache.setByBib(raceId, d.bib_number, view).catch(() => undefined);
    }
    return result;
  }

  // ─────────── ADMIN LOOKUP (with PII) ───────────

  async lookupByBibAdmin(
    raceId: number,
    bibNumber: string,
  ): Promise<RaceAthleteAdminDto | null> {
    const bib = bibNumber.trim();
    if (!bib) return null;

    // PII fields cần explicit `select('+...')` — schema marked select:false.
    const doc = await this.raceAthleteModel
      .findOne({ mysql_race_id: raceId, bib_number: bib })
      .select('+email +contact_phone +id_number')
      .lean<RaceAthlete>()
      .exec();
    if (doc) return toAdminView(doc);

    // Mongo miss → run on-demand fallback (will populate Mongo) then re-read.
    const view = await this.fallbackByBib(raceId, bib);
    if (!view) return null;
    const refreshed = await this.raceAthleteModel
      .findOne({ mysql_race_id: raceId, bib_number: bib })
      .select('+email +contact_phone +id_number')
      .lean<RaceAthlete>()
      .exec();
    return refreshed ? toAdminView(refreshed) : null;
  }

  // ─────────── LIST (admin) ───────────

  async list(
    raceId: number,
    query: ListAthletesQueryDto,
  ): Promise<ListAthletesResponseDto> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 200);

    const filter: Record<string, unknown> = { mysql_race_id: raceId };
    if (query.course_id) filter.course_id = query.course_id;
    if (query.gender) filter.gender = query.gender;
    if (query.last_status) filter.last_status = query.last_status;
    if (query.search) {
      const s = query.search.trim();
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { bib_number: { $regex: `^${escaped}` } },
        { display_name: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.raceAthleteModel
        .find(filter)
        .select('+email +contact_phone +id_number')
        .sort({ bib_number: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<RaceAthlete[]>()
        .exec(),
      this.raceAthleteModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map(toAdminView),
      total,
      page,
      pageSize,
    };
  }

  // ─────────── STATS ───────────

  async getStats(raceId: number): Promise<RaceAthleteStatsDto> {
    const cached = await this.cache.getStats(raceId);
    if (cached) return cached as RaceAthleteStatsDto;

    const [total, withBib, byCourseAgg, byStatusAgg, lastSyncAgg] =
      await Promise.all([
        this.raceAthleteModel.countDocuments({ mysql_race_id: raceId }).exec(),
        this.raceAthleteModel
          .countDocuments({
            mysql_race_id: raceId,
            bib_number: { $type: 'string' },
          })
          .exec(),
        this.raceAthleteModel
          .aggregate<{ _id: string | null; count: number }>([
            { $match: { mysql_race_id: raceId } },
            {
              $group: {
                _id: { $ifNull: ['$course_name', 'unknown'] },
                count: { $sum: 1 },
              },
            },
          ])
          .exec(),
        this.raceAthleteModel
          .aggregate<{ _id: string | null; count: number }>([
            { $match: { mysql_race_id: raceId } },
            {
              $group: {
                _id: { $ifNull: ['$last_status', 'unknown'] },
                count: { $sum: 1 },
              },
            },
          ])
          .exec(),
        this.raceAthleteModel
          .aggregate<{ lastSyncedAt: Date | null }>([
            { $match: { mysql_race_id: raceId } },
            {
              $group: {
                _id: null,
                lastSyncedAt: { $max: '$synced_at' },
              },
            },
          ])
          .exec(),
      ]);

    const byCourse: Record<string, number> = {};
    for (const c of byCourseAgg) {
      byCourse[c._id ?? 'unknown'] = c.count;
    }
    const byStatus: Record<string, number> = {};
    for (const s of byStatusAgg) {
      byStatus[s._id ?? 'unknown'] = s.count;
    }

    const stats: RaceAthleteStatsDto = {
      total,
      withBib,
      byCourse,
      byStatus,
      lastSyncedAt: lastSyncAgg[0]?.lastSyncedAt ?? null,
    };
    await this.cache.setStats(raceId, stats, RACE_MASTER_STATS_TTL_SECONDS);
    return stats;
  }

  // ─────────── SYNC TRIGGER (entry point cho consumer modules + admin) ───────────

  /**
   * Trigger sync. Consumer modules call this khi enable feature (lazy init).
   * Admin endpoint cũng gọi. Idempotent — sync-lock per race.
   *
   * QC FIX #3 — Lock contention: throw 409 ConflictException với context của
   * sync đang chạy. UI tự re-fetch sync-logs để xem progress. Trước đây
   * pattern "wait 200ms + return latest log" trả sai entry (log của lần
   * trước đã hoàn thành), gây admin nhầm tưởng sync mới đã xong.
   */
  async triggerSync(
    raceId: number,
    opts: {
      syncType?: 'ATHLETE_FULL' | 'ATHLETE_DELTA';
      triggeredBy: string;
    },
  ): Promise<RaceMasterSyncLogDocument> {
    const syncType = opts.syncType ?? 'ATHLETE_FULL';

    const acquired = await this.cache.tryAcquireSyncLock(raceId);
    if (!acquired) {
      const running = await this.syncLogModel
        .findOne({ mysql_race_id: raceId, status: 'RUNNING' })
        .sort({ started_at: -1 })
        .exec();
      throw new ConflictException(
        running
          ? `Sync đang chạy bởi ${running.triggered_by} (started ${running.started_at.toISOString()}). Vui lòng chờ.`
          : 'Sync lock đang giữ bởi process khác. Thử lại sau 60s.',
      );
    }

    try {
      if (syncType === 'ATHLETE_FULL') {
        return await this.syncService.fullSyncRace(raceId, opts.triggeredBy);
      }
      return await this.syncService.deltaSyncRace(raceId, opts.triggeredBy);
    } finally {
      await this.cache.releaseSyncLock(raceId);
    }
  }

  // ─────────── SYNC LOG list ───────────

  async listSyncLogs(
    raceId: number,
    limit = 50,
  ): Promise<RaceMasterSyncLogDocument[]> {
    return this.syncLogModel
      .find({ mysql_race_id: raceId })
      .sort({ started_at: -1 })
      .limit(Math.min(Math.max(1, limit), 200))
      .exec();
  }

  // ─────────── HELPERS ───────────

  private async fallbackByBib(
    raceId: number,
    bib: string,
  ): Promise<RaceAthletePublicDto | null> {
    const acquired = await this.cache.tryAcquireLookupLock(raceId, bib);
    if (!acquired) {
      // Another caller resolving — wait then re-check Mongo.
      await new Promise((r) => setTimeout(r, 100));
      const cachedAfter = await this.cache.getByBib(raceId, bib);
      if (cachedAfter) return cachedAfter;
      const docAfter = await this.raceAthleteModel
        .findOne({ mysql_race_id: raceId, bib_number: bib })
        .lean<RaceAthlete>()
        .exec();
      if (docAfter) {
        const v = toPublicView(docAfter);
        await this.cache.setByBib(raceId, bib, v);
        return v;
      }
      // Last resort — fall through and run ourselves.
    }

    try {
      const result = await this.syncService.onDemandByBib(raceId, bib);
      if (!result) return null;
      await this.cache.setByBib(raceId, bib, result.view);
      return result.view;
    } finally {
      if (acquired) await this.cache.releaseLookupLock(raceId, bib);
    }
  }
}
