/**
 * F-076 — core reconcile service.
 *
 * Workflow scan():
 *   1. Query MySQL platform `order_metadata` filter BR-01 (race + paid +
 *      categories) → DB rows
 *   2. Layer 2: query MISA `/invoice/paging` cho date range (today-1 → today)
 *      với graceful degradation (BR-16/17)
 *   3. Classify via pure function reconcile-classifier
 *   4. Compute diff vs previous snapshot
 *   5. Cache report JSON Redis `invoice-reconcile:last-run:<date>`
 *   6. Cache snapshot for next hourly recap
 *   7. Daily counters increment
 *
 * Public methods:
 *   - scan(date, mode) — run reconcile + cache + return report
 *   - getCachedReport(date) — fast UI load
 *   - tryAcquireLock() / releaseLock() — SETNX cron + manual trigger
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { env } from 'src/config';
import { OrderMetadataReadonly } from '../entities/order-metadata-readonly.entity';
import {
  MisaMeinvoiceClient,
  MisaAuthFailError,
  MisaUnavailableError,
} from './misa-meinvoice.client';
import {
  classify,
  ClassifierThresholds,
  MisaInvoiceLite,
  RawDbOrder,
  isB2cRefId,
} from './reconcile-classifier';
import { InvoiceAlertService } from './invoice-alert.service';
import { computeDiff, DiffSnapshot } from './diff-computer';
import { DailyCountersService } from './daily-counters.service';
import { AthleteIdentityClusteringService } from '../../race-master-data/services/athlete-identity-clustering.service';
import {
  ReconcileReportDto,
  Layer2Status,
} from '../dto/reconcile-report.dto';
import { MissingInvoiceRowDto } from '../dto/missing-invoice-row.dto';

const LOCK_KEY = 'invoice-reconcile:lock';
const LOCK_TTL_SECONDS = 240; // 4 phút (< 5 phút scan cron interval)
const REPORT_CACHE_PREFIX = 'invoice-reconcile:last-run:';
const HOURLY_SNAPSHOT_PREFIX = 'invoice-reconcile:hourly-snapshot:';
const SNAPSHOT_TTL_SECONDS = 24 * 3600;
const REPORT_TTL_SECONDS = 24 * 3600;

@Injectable()
export class InvoiceReconcileService {
  private readonly logger = new Logger(InvoiceReconcileService.name);
  private lastScanTickAt: Date | null = null;

  constructor(
    @InjectRepository(OrderMetadataReadonly, 'platform')
    private readonly orderRepo: Repository<OrderMetadataReadonly>,
    private readonly misa: MisaMeinvoiceClient,
    private readonly alert: InvoiceAlertService,
    private readonly counters: DailyCountersService,
    @Optional() @InjectRedis() private readonly redis?: Redis,
    // F-079 BR-79-21 — reuse F-049 race-title resolver. APPENDED to end of
    // constructor để backward compat positional calls F-076 spec (5 args).
    // Optional: tests / boot without RaceMasterDataModule don't break — composer
    // falls back `Race {raceId}` per BR-79-23.
    @Optional()
    private readonly raceTitleResolver?: AthleteIdentityClusteringService,
  ) {}

  /** Public: thresholds (for health endpoint). */
  getThresholds(): ClassifierThresholds {
    return {
      warnHours: env.invoiceReconcile.ageWarnHours,
      criticalHours: env.invoiceReconcile.ageCriticalHours,
      breachedHours: env.invoiceReconcile.ageBreachedHours,
    };
  }

  /** Public: enabled race IDs (for health + scan). */
  getEnabledRaceIds(): number[] {
    return [...env.invoiceReconcile.enabledRaceIds];
  }

  getLastScanTickAt(): Date | null {
    return this.lastScanTickAt;
  }

  async tryAcquireLock(): Promise<boolean> {
    if (!this.redis) return true;
    try {
      const res = await this.redis.set(
        LOCK_KEY,
        String(Date.now()),
        'EX',
        LOCK_TTL_SECONDS,
        'NX',
      );
      return res === 'OK';
    } catch (e) {
      this.logger.warn(`[reconcile] lock acquire fail: ${(e as Error).message}`);
      return false;
    }
  }

  async releaseLock(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(LOCK_KEY);
    } catch (e) {
      this.logger.warn(`[reconcile] lock release fail: ${(e as Error).message}`);
    }
  }

  /**
   * Main entrypoint: run scan + classify + cache + emit URGENT alerts.
   * Caller is responsible for lock management.
   *
   * @param date — yyyy-MM-dd ICT (default today)
   * @param mode — 'cron' | 'manual'
   */
  async scan(
    date: string,
    mode: 'cron' | 'manual' = 'cron',
  ): Promise<ReconcileReportDto> {
    const runAt = new Date();
    this.lastScanTickAt = runAt;

    const enabledRaceIds = this.getEnabledRaceIds();
    if (enabledRaceIds.length === 0) {
      // Empty config — return empty report (UI surfaces banner)
      return this.emptyReport(date, runAt, mode, []);
    }

    // Step 1: query DB
    const dbOrders = await this.queryDbOrders(date, enabledRaceIds);

    // Step 2: query MISA Layer 2 with graceful degradation
    let misaInvoices: MisaInvoiceLite[] = [];
    let layer2Status: Layer2Status = 'OK';
    if (this.misa.isConfigured()) {
      const dateRange = this.computeMisaDateRange(date);
      try {
        misaInvoices = await this.misa.listInvoicesByDateRange(
          dateRange.from,
          dateRange.to,
        );
        const last = this.misa.getLastStatus();
        layer2Status = (last as Layer2Status) ?? 'OK';
      } catch (e) {
        if (e instanceof MisaAuthFailError) {
          layer2Status = 'UNAVAILABLE';
          await this.counters.increment(date, 'misa-fail');
          // Auth fail → alert (no dedup logic here, alert service dedups)
          await this.alert.sendMisaAuthFail(date, e.errorBody);
        } else if (e instanceof MisaUnavailableError) {
          layer2Status = 'UNAVAILABLE';
          await this.counters.increment(date, 'misa-fail');
          await this.alert.sendMisaUnavailable(date, e.lastError);
        } else {
          layer2Status = 'UNAVAILABLE';
          await this.counters.increment(date, 'misa-fail');
          this.logger.error(
            `[reconcile] MISA unexpected: ${(e as Error).message}`,
          );
        }
      }
      if (layer2Status === 'OK') {
        await this.counters.increment(date, 'misa-ok');
      } else if (layer2Status === 'DEGRADED') {
        await this.counters.increment(date, 'misa-degraded');
      }
    } else {
      this.logger.warn('[reconcile] MISA not configured — Layer 2 skipped');
      layer2Status = 'UNAVAILABLE';
    }

    // Step 3: classify
    const classified = classify({
      dbOrders,
      misaInvoices,
      now: runAt,
      thresholds: this.getThresholds(),
    });

    // Step 4: assemble report
    const report: ReconcileReportDto = {
      date,
      runAt: runAt.toISOString(),
      mode,
      raceIdsScanned: enabledRaceIds,
      expectedCount: classified.expectedCount,
      issuedCount: classified.issuedCount,
      // F-079 BR-79-12 — wire skippedCount from classifier output
      skippedCount: classified.skippedCount,
      missingCount: classified.missing.filter(
        (m) => m.bucket === 'UNISSUED' || m.bucket === 'SYNC_LAG',
      ).length,
      atRiskCount: classified.atRiskCount,
      duplicateCount: classified.duplicateCount,
      breachedCount: classified.breachedCount,
      missing: classified.missing,
      misaOrphan: classified.orphan,
      layer2Status,
      maxSeverity: classified.maxSeverity,
      alertSent: false, // updated below
    };

    // Step 5: cache report Redis
    await this.cacheReport(date, report);

    // Step 6: emit URGENT alerts + update alertSent flag (skip on manual? per
    // BR-12 manual KHÔNG bypass dedup — same logic as cron)
    if (mode !== 'manual' || mode === 'manual') {
      // Same code path — alerts dedup naturally
      const { sent } = await this.alert.emitUrgentAlerts(date, report, []);
      report.alertSent = sent > 0;
    }

    // Step 7: increment scan-ticks
    await this.counters.increment(date, 'scan-ticks');

    return report;
  }

  /** Hourly recap: read snapshot, compose recap via composer, no rescan. */
  async runHourlyRecap(date: string): Promise<{
    sent: boolean;
    report: ReconcileReportDto | null;
  }> {
    // Skip if EOD recap already fired today (BR-31 — skip Hourly 21:00)
    if (this.redis) {
      try {
        const eodSent = await this.redis.get(
          `invoice-reconcile:eod-alert-sent:${date}`,
        );
        if (eodSent === '1') {
          return { sent: false, report: null };
        }
      } catch {
        // fall-through
      }
    }
    const current = await this.getCachedReport(date);
    if (!current) {
      return { sent: false, report: null };
    }
    const previous = await this.getHourlySnapshot(date);
    const diffEvents = computeDiff(
      { missing: current.missing, issuedCount: current.issuedCount },
      previous ?? undefined,
    );

    // F-079 BR-79-21 — resolve race titles via F-049 cache pattern.
    // Defensive: if resolver KHÔNG wired (test/boot) → empty Map → composer
    // fallback `Race {raceId}` per BR-79-23. KHÔNG block alert flow.
    const raceTitlesByid = await this.resolveRaceTitlesSafe(
      current.raceIdsScanned,
    );

    const sent = await this.alert.sendHourlyRecap(
      current,
      diffEvents,
      raceTitlesByid,
    );

    // Cache snapshot for next-hour diff
    await this.saveHourlySnapshot(date, {
      missing: current.missing,
      issuedCount: current.issuedCount,
    });

    return { sent, report: current };
  }

  /** EOD recap: read latest report + daily counters → send Loại 7. */
  async runEodRecap(date: string): Promise<{
    sent: boolean;
    report: ReconcileReportDto | null;
  }> {
    const report = await this.getCachedReport(date);
    if (!report) {
      // No scan today? Just send empty EOD anyway with whatever we have
      const empty = this.emptyReport(
        date,
        new Date(),
        'eod-recap',
        this.getEnabledRaceIds(),
      );
      const sent = await this.alert.sendEodRecap(date, empty);
      return { sent, report: empty };
    }
    const sent = await this.alert.sendEodRecap(date, report);
    return { sent, report };
  }

  /** Public: get cached report (admin GET /today fast load). */
  async getCachedReport(date: string): Promise<ReconcileReportDto | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(REPORT_CACHE_PREFIX + date);
      if (!raw) return null;
      return JSON.parse(raw) as ReconcileReportDto;
    } catch (e) {
      this.logger.warn(
        `[reconcile] read cache fail: ${(e as Error).message}`,
      );
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * BR-01 — query order_metadata theo race + paid + categories.
   *
   * SELECT scope: today midnight ICT - 1 day → today midnight + 1 day
   * (cover edge case payment_on UTC vs ICT boundary).
   */
  private async queryDbOrders(
    date: string,
    raceIds: number[],
  ): Promise<RawDbOrder[]> {
    // F-079 hotfix4 TZ-BOUNDARY-FIX — Pull 3-day UTC window (date-1 → date+1)
    // để cover ICT day fully. ICT = UTC+7 → ICT 00:00 = UTC-7 of date prev day.
    // PROD bug: order 200029493 paid `2026-06-08 21:14:31 UTC` = `ICT 04:14 June 9`
    // (cross midnight) bị exclude do filter `payment_on >= '2026-06-09 00:00:00'`
    // → MISA invoice 00000025 marked orphan. Fix expand window back 1 day UTC.
    const dt = new Date(date + 'T00:00:00Z');
    const fromDate = new Date(dt.getTime() - 24 * 3600 * 1000); // -1 day UTC
    const toDate = new Date(dt.getTime() + 24 * 3600 * 1000); // +1 day UTC
    const fromUtc = fromDate.toISOString().slice(0, 10) + ' 00:00:00';
    const toUtc = toDate.toISOString().slice(0, 10) + ' 23:59:59';

    // Defensive: race IDs come from env Number().filter() — guaranteed int > 0
    // Raw SQL pattern F-016/F-028: `?` placeholder + params array (NO interpolation).
    const sql = `
      SELECT
        o.id AS id,
        o.race_id AS raceId,
        o.name AS name,
        o.email AS email,
        o.first_name AS firstName,
        o.last_name AS lastName,
        o.financial_status AS financialStatus,
        o.internal_status AS internalStatus,
        o.order_category AS orderCategory,
        o.payment_on AS paymentOn,
        o.total_price AS totalPrice,
        o.vat_ref AS vatRef
      FROM order_metadata o
      WHERE o.race_id IN (?)
        AND o.internal_status = 'COMPLETE'
        AND o.financial_status = 'paid'
        AND o.deleted = 0
        AND o.order_category NOT IN ('INSURANCE', 'MANUAL')
        AND o.payment_on >= ?
        AND o.payment_on <= ?
      ORDER BY o.payment_on ASC
    `;
    const rows: Record<string, unknown>[] = await this.orderRepo.manager.query(
      sql,
      [raceIds, fromUtc, toUtc],
    );
    return rows.map((r) => this.mapDbRow(r));
  }

  private mapDbRow(r: Record<string, unknown>): RawDbOrder {
    const id = Number(r.id);
    const raceId = Number(r.raceId);
    const name = (r.name as string | null) ?? null;
    const firstName = (r.firstName as string | null) ?? null;
    const lastName = (r.lastName as string | null) ?? null;
    const buyerName =
      [firstName, lastName].filter(Boolean).join(' ').trim() || null;
    const paymentOn =
      r.paymentOn instanceof Date
        ? r.paymentOn
        : r.paymentOn
        ? new Date(String(r.paymentOn))
        : new Date(0);
    const totalPriceRaw = r.totalPrice;
    const totalPrice =
      typeof totalPriceRaw === 'number'
        ? totalPriceRaw
        : Number(totalPriceRaw ?? 0) || 0;
    return {
      id,
      raceId,
      name,
      email: (r.email as string | null) ?? null,
      buyerName,
      totalPrice,
      paymentOn,
      orderCategory: (r.orderCategory as string) || 'UNKNOWN',
      vatRef: (r.vatRef as string | null) ?? null,
    };
  }

  /** Compute MISA date range string (yyyy-MM-dd) cho /invoice/paging. */
  private computeMisaDateRange(date: string): { from: string; to: string } {
    // today-1 → today (BR-15)
    const dt = new Date(date + 'T00:00:00Z');
    const yesterday = new Date(dt.getTime() - 24 * 3600 * 1000);
    return {
      from: yesterday.toISOString().slice(0, 10),
      to: date,
    };
  }

  private async cacheReport(
    date: string,
    report: ReconcileReportDto,
  ): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(
        REPORT_CACHE_PREFIX + date,
        JSON.stringify(report),
        'EX',
        REPORT_TTL_SECONDS,
      );
    } catch (e) {
      this.logger.warn(`[reconcile] cache report fail: ${(e as Error).message}`);
    }
  }

  private async saveHourlySnapshot(
    date: string,
    snap: DiffSnapshot,
  ): Promise<void> {
    if (!this.redis) return;
    const now = new Date();
    const hourKey = String(
      (now.getUTCHours() + 7) % 24,
    ).padStart(2, '0'); // ICT hour
    try {
      await this.redis.set(
        `${HOURLY_SNAPSHOT_PREFIX}${date}-${hourKey}`,
        JSON.stringify(snap),
        'EX',
        SNAPSHOT_TTL_SECONDS,
      );
    } catch (e) {
      this.logger.warn(
        `[reconcile] save snapshot fail: ${(e as Error).message}`,
      );
    }
  }

  private async getHourlySnapshot(
    date: string,
  ): Promise<DiffSnapshot | null> {
    if (!this.redis) return null;
    const now = new Date();
    const prevHour = ((now.getUTCHours() + 7) % 24) - 1;
    if (prevHour < 0) return null;
    const hourKey = String(prevHour).padStart(2, '0');
    try {
      const raw = await this.redis.get(
        `${HOURLY_SNAPSHOT_PREFIX}${date}-${hourKey}`,
      );
      if (!raw) return null;
      return JSON.parse(raw) as DiffSnapshot;
    } catch {
      return null;
    }
  }

  private emptyReport(
    date: string,
    runAt: Date,
    mode: 'cron' | 'manual' | 'hourly-recap' | 'eod-recap',
    raceIdsScanned: number[],
  ): ReconcileReportDto {
    return {
      date,
      runAt: runAt.toISOString(),
      mode,
      raceIdsScanned,
      expectedCount: 0,
      issuedCount: 0,
      skippedCount: 0,
      missingCount: 0,
      atRiskCount: 0,
      duplicateCount: 0,
      breachedCount: 0,
      missing: [],
      misaOrphan: [],
      layer2Status: this.misa.isConfigured() ? 'OK' : 'UNAVAILABLE',
      maxSeverity: 'INFO',
      alertSent: false,
    };
  }

  /**
   * F-079 BR-79-21 + BR-79-23 — defensive race title resolver wrapper.
   *
   * Reuse F-049 `AthleteIdentityClusteringService.getRaceTitlesByMysqlIds()`
   * (Redis cache `races:title:byMysqlId:<id>` TTL 3600s + MongoDB `race`
   * collection fallback + graceful Redis fail handling).
   *
   * Defensive:
   *   - If resolver KHÔNG wired (Optional inject undefined) → return empty Map
   *   - If F-049 method throws → log warn + return empty Map
   *   - Composer falls back `Race {raceId}` per BR-79-23 — heartbeat KHÔNG block
   */
  private async resolveRaceTitlesSafe(
    raceIds: number[],
  ): Promise<Map<number, string>> {
    if (raceIds.length === 0) return new Map<number, string>();

    // Phase A — Layer 1+2: F-049 resolver (Redis cache → MongoDB races).
    let result = new Map<number, string>();
    if (this.raceTitleResolver) {
      try {
        result = await this.raceTitleResolver.getRaceTitlesByMysqlIds(raceIds);
      } catch (err) {
        this.logger.warn(
          `[F-079 race title resolve fail] ${(err as Error).message} — try MySQL fallback`,
        );
      }
    }

    // Phase B — F-080 Layer 3: MySQL platform fallback cho missing IDs
    // (BR-80-01/05 — chỉ chạy khi miss; PROD gap: races 140/220 chưa sync MongoDB).
    const missing = raceIds.filter((id) => !result.has(id));
    if (missing.length > 0) {
      const fromMysql = await this.queryRaceTitlesMysql(missing);
      for (const [id, title] of fromMysql) result.set(id, title);
    }
    return result;
  }

  /**
   * F-080 BR-80-01..04 — Layer 3 MySQL platform race title lookup.
   *
   * READ-ONLY `SELECT race_id, title FROM races` connection 'platform'
   * (`?` placeholder pattern F-016/F-028 — ZERO interpolation).
   * Warm-back Redis F-049 key `races:title:byMysqlId:<id>` TTL 3600s
   * (best-effort — Redis fail KHÔNG block, BR-80-02).
   * Title rỗng → skip (BR-80-03, composer fallback `Race {id}`).
   * Query throw → catch + warn + return empty (BR-80-04 — heartbeat MUST NOT block).
   */
  private async queryRaceTitlesMysql(
    raceIds: number[],
  ): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    try {
      const rows: Array<{ raceId: unknown; title: unknown }> =
        await this.orderRepo.manager.query(
          `SELECT race_id AS raceId, title FROM races WHERE race_id IN (?)`,
          [raceIds],
        );
      for (const r of rows) {
        const id = Number(r.raceId);
        const title = typeof r.title === 'string' ? r.title.trim() : '';
        if (!Number.isInteger(id) || !title) continue; // BR-80-03 skip empty
        out.set(id, title);
        // Warm-back F-049 Redis key — next tick Layer 1 hits (BR-80-02).
        if (this.redis) {
          await this.redis
            .setex(`races:title:byMysqlId:${id}`, 3600, title)
            .catch((err: Error) =>
              this.logger.warn(
                `[F-080 redis warm fail] id=${id}: ${err.message}`,
              ),
            );
        }
      }
    } catch (err) {
      this.logger.warn(
        `[F-080 mysql race title fail] ${(err as Error).message} — composer fallback Race {id}`,
      );
    }
    return out;
  }

  /** Helper for unused import warning. */
  private _unused = isB2cRefId;
}
