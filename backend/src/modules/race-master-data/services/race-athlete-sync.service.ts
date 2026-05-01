import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model, Types } from 'mongoose';
import { MoreThan, Repository } from 'typeorm';
import { AthleteReadonly } from '../entities/athlete-readonly.entity';
import {
  RaceAthlete,
  RaceAthleteDocument,
} from '../schemas/race-athlete.schema';
import {
  RaceMasterSyncLog,
  RaceMasterSyncLogDocument,
  SyncType,
} from '../schemas/race-master-sync-log.schema';
import { mapMysqlAthleteToSchema, toPublicView } from '../utils/athlete-mapper';
import { RaceMasterCacheService } from './race-master-cache.service';
import { RACE_MASTER_DELTA_OVERLAP_SECONDS } from '../utils/redis-keys';

/**
 * Tier 2 (Mongo) + Tier 3 (MySQL) sync orchestration.
 *
 * Patterns:
 *   - FULL: bulk SELECT JOIN MySQL → bulkWrite upsert Mongo → bulk warmup Redis.
 *           Idempotent — re-run does not duplicate. Audit log immutable.
 *   - DELTA: query `modified_on > NOW() - overlap` → patch upsert. Tolerant
 *            of clock skew via overlap window.
 *   - ON-DEMAND: single row by bib → upsert Mongo → write-through Redis.
 *
 * MUST-DO: query MySQL `'platform'` connection — read-only. KHÔNG ghi.
 */
@Injectable()
export class RaceAthleteSyncService {
  private readonly logger = new Logger(RaceAthleteSyncService.name);

  constructor(
    @InjectRepository(AthleteReadonly, 'platform')
    private readonly athleteRepo: Repository<AthleteReadonly>,
    @InjectModel(RaceAthlete.name)
    private readonly raceAthleteModel: Model<RaceAthleteDocument>,
    @InjectModel(RaceMasterSyncLog.name)
    private readonly syncLogModel: Model<RaceMasterSyncLogDocument>,
    private readonly cache: RaceMasterCacheService,
  ) {}

  // ─────────── FULL SYNC ───────────

  /**
   * Bulk pull all athletes for race. Idempotent — bulkWrite upsert by
   * (mysql_race_id, athletes_id). Caller may want to wrap in syncLock to
   * prevent two concurrent FULL syncs racing.
   */
  async fullSyncRace(
    raceId: number,
    triggeredBy: string,
  ): Promise<RaceMasterSyncLogDocument> {
    const log = await this.syncLogModel.create({
      mysql_race_id: raceId,
      sync_type: 'ATHLETE_FULL',
      status: 'RUNNING',
      started_at: new Date(),
      triggered_by: triggeredBy,
    });
    const t0 = Date.now();

    const FULL_SYNC_CAP = 20000;
    try {
      const rows = await this.athleteRepo.find({
        where: { race_id: raceId, deleted: false },
        relations: {
          subinfo: { orderLineItem: { ticketType: { raceCourse: true } } },
          code: { raceCourse: true },
        },
        take: FULL_SYNC_CAP,
      });

      if (rows.length === 0) {
        await this.markCompleted(log._id, {
          rows_fetched: 0,
          rows_inserted: 0,
          rows_updated: 0,
          rows_skipped: 0,
          duration_ms: Date.now() - t0,
        });
        // Best-effort: clear stale cache for this race.
        await this.cache.clearRace(raceId);
        return (await this.syncLogModel.findById(log._id))!;
      }

      // QC EC-6 fix — warn khi cap hit, log status PARTIAL.
      const truncated = rows.length === FULL_SYNC_CAP;
      if (truncated) {
        this.logger.warn(
          `[FULL] race=${raceId} hit safety cap ${FULL_SYNC_CAP} — possible truncation. Investigate athlete count.`,
        );
      }

      const mapped = rows.map((r) => mapMysqlAthleteToSchema(raceId, r));

      // QC FIX #1 — 2-phase BIB swap collision protection.
      // Pre-clear bib_number for any existing doc whose athletes_id is in this
      // sync AND whose current bib differs from new mapping. Without this,
      // bulkWrite ordered:false hits partial unique violations on the
      // `(mysql_race_id, bib_number)` index when BTC swaps two athletes' BIBs.
      const swapResult = await this.preClearSwappedBibs(raceId, mapped);

      const ops = mapped.map((m) => ({
        updateOne: {
          filter: { mysql_race_id: raceId, athletes_id: m.athletes_id },
          update: {
            $set: m,
            $inc: { sync_version: 1 },
          },
          upsert: true,
        },
      }));

      let writeResult;
      let writeErrorCount = 0;
      try {
        writeResult = await this.raceAthleteModel.bulkWrite(ops, {
          ordered: false,
        });
      } catch (err) {
        // bulkWrite throws MongoBulkWriteError when any op fails. Capture
        // partial success — rows already written stay; we mark log PARTIAL.
        const e = err as {
          message?: string;
          result?: {
            upsertedCount?: number;
            modifiedCount?: number;
            getWriteErrors?: () => Array<{ errmsg: string }>;
          };
        };
        writeResult = {
          upsertedCount: e.result?.upsertedCount ?? 0,
          modifiedCount: e.result?.modifiedCount ?? 0,
        };
        writeErrorCount = e.result?.getWriteErrors?.()?.length ?? 0;
        this.logger.error(
          `[FULL] race=${raceId} bulkWrite partial: ${writeErrorCount} errors — first: ${e.result?.getWriteErrors?.()?.[0]?.errmsg ?? 'n/a'}`,
        );
      }

      // Reload all docs to feed Redis warmup + emit consistent public views.
      const docs = await this.raceAthleteModel
        .find({ mysql_race_id: raceId })
        .lean<RaceAthlete[]>()
        .exec();
      const payloads = docs.map(toPublicView);
      await this.cache.bulkWarmup(raceId, payloads);
      await this.cache.invalidateStats(raceId);

      const duration = Date.now() - t0;
      const isPartial = truncated || writeErrorCount > 0;

      await this.syncLogModel.updateOne(
        { _id: log._id },
        {
          $set: {
            status: isPartial ? 'PARTIAL' : 'SUCCESS',
            completed_at: new Date(),
            rows_fetched: rows.length,
            rows_inserted: writeResult.upsertedCount ?? 0,
            rows_updated: writeResult.modifiedCount ?? 0,
            rows_skipped: Math.max(
              0,
              rows.length -
                (writeResult.upsertedCount ?? 0) -
                (writeResult.modifiedCount ?? 0),
            ),
            duration_ms: duration,
            error_message: isPartial
              ? truncated
                ? `Hit cap ${FULL_SYNC_CAP} — race may have more athletes`
                : `${writeErrorCount} bulkWrite errors (likely duplicate bib_number in source data)`
              : null,
          },
        },
      );
      this.logger.log(
        `[FULL] race=${raceId} rows=${rows.length} upserted=${writeResult.upsertedCount} modified=${writeResult.modifiedCount} swapped=${swapResult.cleared} ms=${duration}${isPartial ? ' (PARTIAL)' : ''}`,
      );
      return (await this.syncLogModel.findById(log._id))!;
    } catch (err) {
      const message = (err as Error).message;
      await this.markFailed(log._id, message, Date.now() - t0);
      this.logger.error(
        `[FULL] race=${raceId} FAILED: ${message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  // ─────────── DELTA SYNC ───────────

  /**
   * Query MySQL với filter `modified_on > since` cho 1 race. Caller wrap
   * trong cron-lock per race.
   */
  async deltaSyncRace(
    raceId: number,
    triggeredBy: string,
  ): Promise<RaceMasterSyncLogDocument> {
    const log = await this.syncLogModel.create({
      mysql_race_id: raceId,
      sync_type: 'ATHLETE_DELTA',
      status: 'RUNNING',
      started_at: new Date(),
      triggered_by: triggeredBy,
    });
    const t0 = Date.now();

    try {
      // Find checkpoint: max legacy_modified_on we already have for this race.
      const checkpointDoc = await this.raceAthleteModel
        .findOne({ mysql_race_id: raceId })
        .sort({ legacy_modified_on: -1 })
        .select({ legacy_modified_on: 1 })
        .lean<{ legacy_modified_on: Date | null }>()
        .exec();

      const checkpoint = checkpointDoc?.legacy_modified_on ?? null;
      const since = checkpoint
        ? new Date(
            checkpoint.getTime() - RACE_MASTER_DELTA_OVERLAP_SECONDS * 1000,
          )
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // first time: last 24h

      const rows = await this.athleteRepo.find({
        where: {
          race_id: raceId,
          modified_on: MoreThan(since),
          deleted: false,
        },
        relations: {
          subinfo: { orderLineItem: { ticketType: { raceCourse: true } } },
          code: { raceCourse: true },
        },
        take: 2000, // safety cap per cycle
      });

      if (rows.length === 0) {
        await this.markCompleted(log._id, {
          rows_fetched: 0,
          rows_inserted: 0,
          rows_updated: 0,
          rows_skipped: 0,
          duration_ms: Date.now() - t0,
        });
        return (await this.syncLogModel.findById(log._id))!;
      }

      // Detect bib changes BEFORE upsert — for cache invalidation.
      const oldBibByAthleteId = new Map<number, string | null>();
      const oldDocs = await this.raceAthleteModel
        .find({
          mysql_race_id: raceId,
          athletes_id: { $in: rows.map((r) => Number(r.athletes_id)) },
        })
        .select({ athletes_id: 1, bib_number: 1 })
        .lean<{ athletes_id: number; bib_number: string | null }[]>()
        .exec();
      for (const d of oldDocs) {
        oldBibByAthleteId.set(d.athletes_id, d.bib_number);
      }

      const mapped = rows.map((r) => mapMysqlAthleteToSchema(raceId, r));

      // QC FIX #1 — 2-phase BIB swap collision protection (also for delta).
      const swapResult = await this.preClearSwappedBibs(raceId, mapped);

      const ops = mapped.map((m) => ({
        updateOne: {
          filter: { mysql_race_id: raceId, athletes_id: m.athletes_id },
          update: {
            $set: m,
            $inc: { sync_version: 1 },
          },
          upsert: true,
        },
      }));
      let result;
      let writeErrorCount = 0;
      try {
        result = await this.raceAthleteModel.bulkWrite(ops, { ordered: false });
      } catch (err) {
        const e = err as {
          result?: {
            upsertedCount?: number;
            modifiedCount?: number;
            getWriteErrors?: () => Array<{ errmsg: string }>;
          };
        };
        result = {
          upsertedCount: e.result?.upsertedCount ?? 0,
          modifiedCount: e.result?.modifiedCount ?? 0,
        };
        writeErrorCount = e.result?.getWriteErrors?.()?.length ?? 0;
        this.logger.warn(
          `[DELTA] race=${raceId} bulkWrite partial: ${writeErrorCount} errors`,
        );
      }

      // Patch Redis. For bib changes, invalidate old bib first.
      const stalePayloads: Array<{ raceId: number; oldBib: string }> = [];
      for (const m of mapped) {
        const oldBib = oldBibByAthleteId.get(m.athletes_id);
        if (oldBib && oldBib !== m.bib_number) {
          stalePayloads.push({ raceId, oldBib });
        }
      }
      for (const s of stalePayloads) {
        await this.cache.invalidateBib(s.raceId, s.oldBib);
      }

      const newDocs = await this.raceAthleteModel
        .find({
          mysql_race_id: raceId,
          athletes_id: { $in: mapped.map((m) => m.athletes_id) },
        })
        .lean<RaceAthlete[]>()
        .exec();
      await this.cache.patchMany(raceId, newDocs.map(toPublicView));
      await this.cache.invalidateStats(raceId);

      const duration = Date.now() - t0;
      const isPartial = writeErrorCount > 0;
      await this.syncLogModel.updateOne(
        { _id: log._id },
        {
          $set: {
            status: isPartial ? 'PARTIAL' : 'SUCCESS',
            completed_at: new Date(),
            rows_fetched: rows.length,
            rows_inserted: result.upsertedCount ?? 0,
            rows_updated: result.modifiedCount ?? 0,
            rows_skipped: Math.max(
              0,
              rows.length -
                (result.upsertedCount ?? 0) -
                (result.modifiedCount ?? 0),
            ),
            duration_ms: duration,
            error_message: isPartial
              ? `${writeErrorCount} bulkWrite errors (likely bib_number duplicate in source)`
              : null,
          },
        },
      );
      if (rows.length > 0) {
        this.logger.log(
          `[DELTA] race=${raceId} rows=${rows.length} swapped=${swapResult.cleared} since=${since.toISOString()} ms=${duration}${isPartial ? ' (PARTIAL)' : ''}`,
        );
      }
      return (await this.syncLogModel.findById(log._id))!;
    } catch (err) {
      const message = (err as Error).message;
      await this.markFailed(log._id, message, Date.now() - t0);
      this.logger.error(
        `[DELTA] race=${raceId} FAILED: ${message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  // ─────────── ON-DEMAND FALLBACK ───────────

  /**
   * Single-row pull by bib. Used by lookup service when Redis + Mongo both
   * miss. Caller MUST hold lookup-lock (anti-stampede).
   */
  async onDemandByBib(
    raceId: number,
    bibNumber: string,
  ): Promise<RaceAthletePublicViewWithDoc | null> {
    const a = await this.athleteRepo.findOne({
      where: {
        race_id: raceId,
        bib_number: bibNumber,
        deleted: false,
      },
      relations: {
        subinfo: { orderLineItem: { ticketType: { raceCourse: true } } },
        code: { raceCourse: true },
      },
    });
    if (!a) return null;

    const mapped = mapMysqlAthleteToSchema(raceId, a);
    await this.raceAthleteModel.updateOne(
      { mysql_race_id: raceId, athletes_id: mapped.athletes_id },
      {
        $set: mapped,
        $inc: { sync_version: 1 },
      },
      { upsert: true },
    );

    // Best-effort lazy delta sync in background — don't await.
    this.syncLogModel
      .create({
        mysql_race_id: raceId,
        sync_type: 'MANUAL',
        status: 'SUCCESS',
        started_at: new Date(),
        completed_at: new Date(),
        rows_fetched: 1,
        rows_inserted: 0,
        rows_updated: 1,
        rows_skipped: 0,
        duration_ms: 0,
        triggered_by: 'lazy:on-demand',
      })
      .catch((err: Error) =>
        this.logger.warn(`[on-demand] log insert failed: ${err.message}`),
      );

    const fresh = await this.raceAthleteModel
      .findOne({ mysql_race_id: raceId, athletes_id: mapped.athletes_id })
      .lean<RaceAthlete>()
      .exec();
    if (!fresh) return null;
    const view = toPublicView(fresh);
    return { view, doc: fresh };
  }

  // ─────────── HELPERS ───────────

  private async markCompleted(
    logId: Types.ObjectId,
    stats: {
      rows_fetched: number;
      rows_inserted: number;
      rows_updated: number;
      rows_skipped: number;
      duration_ms: number;
    },
  ): Promise<void> {
    await this.syncLogModel.updateOne(
      { _id: logId },
      {
        $set: {
          status: 'SUCCESS',
          completed_at: new Date(),
          ...stats,
        },
      },
    );
  }

  private async markFailed(
    logId: Types.ObjectId,
    errorMessage: string,
    duration_ms: number,
  ): Promise<void> {
    await this.syncLogModel.updateOne(
      { _id: logId },
      {
        $set: {
          status: 'FAILED',
          completed_at: new Date(),
          error_message: errorMessage.slice(0, 1000),
          duration_ms,
        },
      },
    );
  }

  /**
   * QC FIX #2 — Active races for cron delta sync.
   *
   * "Active" = race có data trong `race_athletes` AND latest `synced_at`
   * (Mongo write timestamp) trong 7 ngày gần nhất. Dùng `synced_at` thay
   * `legacy_modified_on` vì:
   *   - `legacy_modified_on` là MySQL value, có thể rất cũ ngay sau lần
   *      seed đầu tiên (race cũ vừa enable chip-verify).
   *   - `synced_at` reset mỗi lần upsert → đo "module có còn quan tâm race
   *      này không" chính xác hơn.
   *
   * Race lifecycle:
   *   - Mới seed (trigger FULL): synced_at = now → active.
   *   - Cron tick lại sync delta → synced_at refresh → active tiếp.
   *   - Sau 7 ngày không sync (admin disable hoặc race ended) → fall out
   *     khỏi cron. Vẫn có thể manual trigger.
   */
  async listActiveRaces(): Promise<number[]> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.raceAthleteModel
      .aggregate<{ _id: number }>([
        {
          $group: {
            _id: '$mysql_race_id',
            lastSynced: { $max: '$synced_at' },
          },
        },
        { $match: { lastSynced: { $gte: cutoff } } },
        { $project: { _id: 1 } },
      ])
      .exec();
    return result.map((r) => r._id);
  }

  /**
   * QC FIX #1 — 2-phase BIB swap collision protection.
   *
   * Why: partial unique index `(mysql_race_id, bib_number)` causes ordered:false
   * bulkWrite to fail when athletes A and B swap bibs (A: 100→200, B: 200→100).
   * Both upserts try to write conflicting bibs while the other still holds it.
   *
   * Fix: pre-clear bib_number=null for any existing doc whose bib is being
   * REMOVED or REASSIGNED in this batch. Done in single updateMany — fast.
   *
   * Returns count of cleared docs (for logging).
   */
  private async preClearSwappedBibs(
    raceId: number,
    mapped: Array<{ athletes_id: number; bib_number?: string | null }>,
  ): Promise<{ cleared: number }> {
    // Build set of (athletes_id, new_bib) for change detection
    const newBibByAthleteId = new Map<number, string | null>();
    for (const m of mapped) {
      newBibByAthleteId.set(m.athletes_id, m.bib_number ?? null);
    }

    // Load current bibs for these athletes (one query)
    const existing = await this.raceAthleteModel
      .find({
        mysql_race_id: raceId,
        athletes_id: { $in: Array.from(newBibByAthleteId.keys()) },
        bib_number: { $type: 'string' },
      })
      .select({ athletes_id: 1, bib_number: 1 })
      .lean<{ athletes_id: number; bib_number: string }[]>()
      .exec();

    // Find athletes whose bib changes (different value or removed)
    const athletesToClear: number[] = [];
    for (const e of existing) {
      const newBib = newBibByAthleteId.get(e.athletes_id);
      if (newBib !== e.bib_number) {
        athletesToClear.push(e.athletes_id);
      }
    }

    if (athletesToClear.length === 0) return { cleared: 0 };

    await this.raceAthleteModel.updateMany(
      {
        mysql_race_id: raceId,
        athletes_id: { $in: athletesToClear },
      },
      { $set: { bib_number: null } },
    );

    return { cleared: athletesToClear.length };
  }
}

export interface RaceAthletePublicViewWithDoc {
  view: ReturnType<typeof toPublicView>;
  doc: RaceAthlete;
}
