import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Model } from 'mongoose';
import { Repository } from 'typeorm';
import { OrderReadonly } from '../entities/order-readonly.entity';
import { Tenant } from '../../merchant/entities/tenant.entity';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../../merchant/schemas/merchant-config.schema';
import {
  ReconciliationQueryService,
  ReconciledFeeSlice,
  F040_PRE_F016_CUTOFF,
} from '../../reconciliation/services/reconciliation-query.service';
import {
  RaceSearchResultDto,
  TenantSearchResultDto,
} from '../dto/mysql-lookup.dto';
import {
  FeeBreakdownDto,
  FeeSource,
  ReconciledFeeSliceDto,
  SelfComputeSliceDto,
} from '../dto/pnl-response.dto';
import type { ContractDocument } from '../../contracts/schemas/contract.schema';
// F-058 — Analytics aggregate fee DTO + interface
import type {
  AnalyticsFeeAggregateResultDto,
  AppliedOverrideEntryDto,
  FeeSourceBreakdownEntryDto,
  OrderForFeeAggregate,
} from '../dto/fee-aggregate.dto';

/**
 * F-028 BR-PNL-04 + BR-PNL-22 — cross-DB MySQL platform pull cho TICKET_SALES.
 * FEATURE-040 — semantic shift: compute fee 5BIB thật (KHÔNG gross GMV).
 *
 * Source priority (BR-40-02):
 *   1. RECONCILIATION: ≥1 recon doc status∈{signed,reviewed,completed,sent}
 *      AND overlap with contract period AND covers full period
 *   2. SELF_COMPUTE: NO recon overlap → MySQL pull × rate
 *   3. MIXED: partial recon cover → SUM(recon parts) + self-compute(gap)
 *   4. ESTIMATED: no tenant/race link OR cross-DB unreachable → fallback
 *      `contract.totalAmount`
 *
 * Self-compute formula (BR-40-05..07):
 *   - 5BIB-eligible (ORDINARY/PERSONAL_GROUP/CHANGE_COURSE/GROUP_BUY/
 *     GROUP_BUY_FIXED/CODE_TRANSFER): fee = SUM(o.total_price) × rate / 100
 *   - MANUAL: fee = SUM(oli.quantity) × manual_fee_per_ticket
 *   - Total = fee_5bib + fee_manual
 *
 * Rate cascade (BR-40-08):
 *   1. merchant_configs.service_fee_rate (primary)
 *   2. contract.revenueShare.feePercentage (secondary, log WARN)
 *   3. hardcoded 5.5% (tertiary, log WARN)
 *
 * Cache keys (BR-40-11):
 *   - `pnl:ticket-sales-fee:<contractId>:tenant=<tenantId>` (Embed tenantId in key)
 *   - `pnl:fee-source:<contractId>:tenant=<tenantId>`
 *   - `pnl:gross-gmv:<contractId>:tenant=<tenantId>`
 *   - `pnl:fee-breakdown:<contractId>:tenant=<tenantId>`
 *   TTL 3600s (60 min). Invalidation: MerchantConfig update + Reconciliation
 *   status change (handled in respective services).
 */
@Injectable()
export class FeeService {
  private readonly logger = new Logger(FeeService.name);

  private static readonly FIVE_BIB_CATEGORIES = [
    'ORDINARY',
    'PERSONAL_GROUP',
    'CHANGE_COURSE',
    'GROUP_BUY',
    'GROUP_BUY_FIXED',
    'CODE_TRANSFER',
  ];

  /** F-040 cache TTL (BR-40-11). */
  private static readonly F040_CACHE_TTL = 3600;

  /** F-040 rate-limit: log INFO at most 1 legacy recon notice per (raceId,tenantId)
   * per request. Reset on each call via local Set passed through. */

  constructor(
    @Optional()
    @InjectRepository(OrderReadonly, 'platform')
    private readonly orderRepo: Repository<OrderReadonly> | null,
    @Optional() @InjectRedis() private readonly redis?: Redis,
    @Optional()
    @InjectRepository(Tenant, 'platform')
    private readonly tenantRepo?: Repository<Tenant> | null,
    @Optional()
    @InjectModel(MerchantConfig.name)
    private readonly merchantConfigModel?: Model<MerchantConfigDocument> | null,
    @Optional()
    private readonly reconciliationQuery?: ReconciliationQueryService | null,
  ) {}

  // ────────────────────────────────────────────────────────────────────
  // F-028 — MySQL Tenant + Race picker (admin UI link TICKET_SALES → MySQL)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Search MySQL `tenant` table by name or tax_id (col `vat`). Max 20 rows.
   * Empty query → 20 most-recent tenants (UX: show defaults instead of empty).
   * Redis cache 60s (`mysql-lookup:tenant:<q>`).
   */
  async searchTenants(q: string | undefined): Promise<TenantSearchResultDto[]> {
    if (!this.tenantRepo) return [];
    const query = (q ?? '').trim();
    const cacheKey = `mysql-lookup:tenant:${query.toLowerCase()}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as TenantSearchResultDto[];
      } catch (e) {
        this.logger.warn(
          `[finance] redis get ${cacheKey} fail: ${(e as Error).message}`,
        );
      }
    }

    try {
      const qb = this.tenantRepo
        .createQueryBuilder('t')
        .select(['t.id AS id', 't.name AS name', 't.vat AS vat'])
        .where('t.deleted = 0 OR t.deleted IS NULL');
      if (query.length > 0) {
        const like = `%${query}%`;
        qb.andWhere('(t.name LIKE :like OR t.vat LIKE :like)', { like });
      }
      qb.orderBy('t.name', 'ASC').limit(20);

      const rows: Array<{ id: number; name: string; vat: string | null }> =
        await qb.getRawMany();
      const result: TenantSearchResultDto[] = rows.map((r) => ({
        id: Number(r.id),
        name: r.name ?? '',
        taxId: r.vat ?? null,
      }));

      if (this.redis) {
        try {
          await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
        } catch (e) {
          this.logger.warn(
            `[finance] redis set ${cacheKey} fail: ${(e as Error).message}`,
          );
        }
      }
      return result;
    } catch (err) {
      this.logger.warn(
        `[finance] searchTenants fail q="${query}": ${(err as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Search MySQL `races` table cho 1 tenant. Optional substring filter trên
   * title. Max 30 rows ORDER BY created_on DESC (most-recent first).
   * Redis cache 60s (`mysql-lookup:races:<tenantId>:<q>`).
   *
   * @throws BadRequestException khi tenantId invalid (<= 0)
   */
  async searchRaces(
    tenantId: number,
    q?: string,
  ): Promise<RaceSearchResultDto[]> {
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new BadRequestException('tenantId không hợp lệ');
    }
    if (!this.tenantRepo) return [];
    const query = (q ?? '').trim();
    const cacheKey = `mysql-lookup:races:${tenantId}:${query.toLowerCase()}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as RaceSearchResultDto[];
      } catch (e) {
        this.logger.warn(
          `[finance] redis get ${cacheKey} fail: ${(e as Error).message}`,
        );
      }
    }

    try {
      let sql = `
        SELECT r.race_id AS raceId, r.title AS title, r.created_on AS createdOn
        FROM races r
        WHERE r.tenant_id = ?
      `;
      const params: unknown[] = [tenantId];
      if (query.length > 0) {
        sql += ' AND r.title LIKE ?';
        params.push(`%${query}%`);
      }
      sql += ' ORDER BY r.created_on DESC LIMIT 30';

      const rows: Array<{
        raceId: number;
        title: string;
        createdOn: Date | null;
      }> = await this.tenantRepo.manager.query(sql, params);

      const result: RaceSearchResultDto[] = rows.map((r) => ({
        raceId: Number(r.raceId),
        title: r.title ?? '',
        createdOn:
          r.createdOn instanceof Date
            ? r.createdOn.toISOString()
            : r.createdOn ?? null,
      }));

      if (this.redis) {
        try {
          await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
        } catch (e) {
          this.logger.warn(
            `[finance] redis set ${cacheKey} fail: ${(e as Error).message}`,
          );
        }
      }
      return result;
    } catch (err) {
      this.logger.warn(
        `[finance] searchRaces tenant=${tenantId} q="${query}" fail: ${
          (err as Error).message
        }`,
      );
      return [];
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // FEATURE-040 — Fee compute (replaces gross GMV with real 5BIB fee)
  // ────────────────────────────────────────────────────────────────────

  /**
   * F-040 BR-40-02 — compute real fee 5BIB cho 1 TICKET_SALES contract với
   * source priority: RECONCILIATION → SELF_COMPUTE → MIXED → ESTIMATED.
   */
  async getFeeForContract(contract: ContractDocument): Promise<{
    fee: number;
    source: FeeSource;
    grossGMV: number;
    breakdown: FeeBreakdownDto;
    warnings: string[];
  }> {
    const contractId = String(contract._id);
    const c = contract as unknown as {
      linkedTenantId?: number;
      linkedMysqlRaceId?: number;
      templateOverrides?: Record<string, string>;
      effectiveDate?: Date | string;
      signDate?: Date | string;
      endDate?: Date | string;
      totalAmount?: number;
      revenueShare?: { feePercentage?: number };
    };

    // Resolve linkage (linkedTenantId/linkedMysqlRaceId or legacy
    // templateOverrides fallback per PnLService.extractPlatformLinkage).
    let tenantId: number | null =
      typeof c.linkedTenantId === 'number' ? c.linkedTenantId : null;
    let mysqlRaceId: number | null =
      typeof c.linkedMysqlRaceId === 'number' ? c.linkedMysqlRaceId : null;
    if (tenantId === null || mysqlRaceId === null) {
      const overrides = c.templateOverrides ?? {};
      if (tenantId === null && overrides.__platformTenantId) {
        const v = Number(overrides.__platformTenantId);
        tenantId = Number.isFinite(v) ? v : null;
      }
      if (mysqlRaceId === null && overrides.__platformMysqlRaceId) {
        const v = Number(overrides.__platformMysqlRaceId);
        mysqlRaceId = Number.isFinite(v) ? v : null;
      }
    }

    const warnings: string[] = [];
    const computedAt = new Date().toISOString();

    // BR-40-02 tier 4 — ESTIMATED fallback (no tenant/race link)
    if (tenantId === null || mysqlRaceId === null) {
      const fallbackFee = Number(c.totalAmount ?? 0);
      warnings.push(
        'Hợp đồng chưa liên kết tenantId/mysqlRaceId — dùng totalAmount ước tính',
      );
      const breakdown: FeeBreakdownDto = {
        contractId,
        feeSource: 'ESTIMATED',
        totalFee: fallbackFee,
        grossGMV: 0,
        reconciliations: [],
        computedAt,
        warnings: [...warnings],
      };
      return {
        fee: fallbackFee,
        source: 'ESTIMATED',
        grossGMV: 0,
        breakdown,
        warnings,
      };
    }

    // Cache check — composite read of all 4 companion keys
    const cacheKeys = this.feeCacheKeys(contractId, tenantId);
    if (this.redis) {
      try {
        const [feeStr, sourceStr, grossStr, breakdownStr] = await this.redis.mget(
          cacheKeys.fee,
          cacheKeys.source,
          cacheKeys.grossGMV,
          cacheKeys.breakdown,
        );
        if (feeStr !== null && sourceStr !== null && breakdownStr !== null) {
          const cachedFee = Number(feeStr);
          const cachedSource = sourceStr as FeeSource;
          const cachedGMV = grossStr !== null ? Number(grossStr) : 0;
          const cachedBreakdown = JSON.parse(breakdownStr) as FeeBreakdownDto;
          return {
            fee: cachedFee,
            source: cachedSource,
            grossGMV: cachedGMV,
            breakdown: cachedBreakdown,
            warnings: cachedBreakdown.warnings ?? [],
          };
        }
      } catch (e) {
        this.logger.warn(
          `[F-040] cache mget fail contract=${contractId} tenant=${tenantId}: ${(e as Error).message}`,
        );
      }
    }

    // Resolve contract period for overlap query
    const contractStart = this.toDate(c.effectiveDate ?? c.signDate);
    const contractEnd = this.toDate(c.endDate) ?? new Date('2099-12-31');
    const effectiveStart = contractStart ?? new Date('1970-01-01');

    // 1. Query reconciliations (BR-40-02 tier 1)
    let reconciliations: ReconciledFeeSlice[] = [];
    if (this.reconciliationQuery) {
      try {
        reconciliations = await this.reconciliationQuery.getReconciledFeeForContract(
          mysqlRaceId,
          tenantId,
          effectiveStart,
          contractEnd,
        );
      } catch (e) {
        this.logger.warn(
          `[F-040] recon query fail contract=${contractId}: ${(e as Error).message}`,
        );
      }
    }

    // BR-40-12 — rate-limit log: at most 1 INFO per (raceId,tenantId) per request
    if (reconciliations.some((r) => r.legacyWarning)) {
      this.logger.log(
        `[F-040] consuming legacy recon doc(s) for (raceId=${mysqlRaceId}, tenantId=${tenantId}, contractId=${contractId}) — pre-2026-05-08, fee_amount may underestimate GROUP_BUY/CODE_TRANSFER drop (TD-F016-FINANCE-01)`,
      );
    }

    // 2. Self-compute (always run — needed for grossGMV transparency + potential gap)
    let selfCompute: (SelfComputeSliceDto & { grossGMV: number }) | null = null;
    let crossDbDown = false;
    try {
      selfCompute = await this.computeSelfFee(
        mysqlRaceId,
        tenantId,
        contract,
      );
    } catch (e) {
      crossDbDown = true;
      warnings.push(
        `MySQL platform unreachable — fee 5BIB compute fallback to ESTIMATED: ${(e as Error).message}`,
      );
      this.logger.warn(
        `[F-040] self-compute cross-DB fail contract=${contractId}: ${(e as Error).message}`,
      );
    }

    // 3. Source decision
    let source: FeeSource;
    let totalFee: number;
    let gapSelfCompute: (SelfComputeSliceDto & { grossGMV: number }) | undefined;

    if (crossDbDown && reconciliations.length === 0) {
      // BR-40-14 cross-DB graceful degrade → ESTIMATED
      source = 'ESTIMATED';
      totalFee = Number(c.totalAmount ?? 0);
      const breakdown: FeeBreakdownDto = {
        contractId,
        feeSource: 'ESTIMATED',
        totalFee,
        grossGMV: 0,
        reconciliations: [],
        computedAt,
        warnings: [...warnings],
      };
      // Fail-open: skip cache set on degraded path
      return { fee: totalFee, source, grossGMV: 0, breakdown, warnings };
    }

    if (reconciliations.length === 0) {
      // SELF_COMPUTE
      source = 'SELF_COMPUTE';
      const sc = selfCompute!;
      totalFee = sc.fee5BIB + sc.feeManual;
    } else {
      // Reconciliation has coverage — determine MIXED vs RECONCILIATION
      const reconFee = reconciliations.reduce(
        (s, r) => s + r.feeAmount + r.manualFeeAmount,
        0,
      );
      const coverage = this.computePeriodCoverage(
        reconciliations,
        effectiveStart,
        contractEnd,
      );

      if (coverage.gapMonths.length === 0) {
        source = 'RECONCILIATION';
        totalFee = reconFee;
      } else {
        source = 'MIXED';
        // Self-compute for gap window only
        if (this.orderRepo && !crossDbDown) {
          try {
            gapSelfCompute = await this.computeSelfFee(
              mysqlRaceId,
              tenantId,
              contract,
              { periodFrom: coverage.gapStart, periodTo: coverage.gapEnd },
            );
          } catch (e) {
            warnings.push(
              `Self-compute gap fail: ${(e as Error).message} — chỉ dùng phần BBNT`,
            );
          }
        }
        totalFee = reconFee + (gapSelfCompute?.fee5BIB ?? 0) + (gapSelfCompute?.feeManual ?? 0);
      }
    }

    const grossGMV = selfCompute?.grossGMV ?? 0;

    // Build breakdown payload — strip private fields from recon slices
    const reconSlicesDto: ReconciledFeeSliceDto[] = reconciliations.map((r) => ({
      reconciliationId: r.reconciliationId,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      status: r.status,
      feeAmount: r.feeAmount,
      manualFeeAmount: r.manualFeeAmount,
      finalizedAt: r.finalizedAt,
      legacyWarning: r.legacyWarning,
    }));

    const breakdown: FeeBreakdownDto = {
      contractId,
      feeSource: source,
      totalFee,
      grossGMV,
      reconciliations: reconSlicesDto,
      selfCompute:
        source === 'SELF_COMPUTE'
          ? this.stripGrossGMV(selfCompute!)
          : source === 'MIXED' && gapSelfCompute
            ? this.stripGrossGMV(gapSelfCompute)
            : undefined,
      computedAt,
      warnings: warnings.length > 0 ? [...warnings] : undefined,
    };

    // Cache write
    if (this.redis) {
      try {
        const pipe = this.redis.pipeline();
        pipe.set(cacheKeys.fee, String(totalFee), 'EX', FeeService.F040_CACHE_TTL);
        pipe.set(cacheKeys.source, source, 'EX', FeeService.F040_CACHE_TTL);
        pipe.set(
          cacheKeys.grossGMV,
          String(grossGMV),
          'EX',
          FeeService.F040_CACHE_TTL,
        );
        pipe.set(
          cacheKeys.breakdown,
          JSON.stringify(breakdown),
          'EX',
          FeeService.F040_CACHE_TTL,
        );
        await pipe.exec();
      } catch (e) {
        this.logger.warn(
          `[F-040] cache write fail contract=${contractId}: ${(e as Error).message}`,
        );
      }
    }

    return { fee: totalFee, source, grossGMV, breakdown, warnings };
  }

  /**
   * F-040 — Bulk variant cho dashboard batch path. Process N contracts với
   * concurrency cap = 5 (avoid MySQL overload). Each contract still goes
   * through cache check → mget hits hot data immediately.
   */
  async getFeeForContractsBulk(
    contracts: ContractDocument[],
    options?: { concurrency?: number },
  ): Promise<
    Map<
      string,
      {
        fee: number;
        source: FeeSource;
        grossGMV: number;
        breakdown: FeeBreakdownDto;
        warnings: string[];
      }
    >
  > {
    const concurrency = options?.concurrency ?? 5;
    const result = new Map<
      string,
      {
        fee: number;
        source: FeeSource;
        grossGMV: number;
        breakdown: FeeBreakdownDto;
        warnings: string[];
      }
    >();

    // Process in batches of `concurrency`
    for (let i = 0; i < contracts.length; i += concurrency) {
      const batch = contracts.slice(i, i + concurrency);
      const settled = await Promise.allSettled(
        batch.map((c) => this.getFeeForContract(c)),
      );
      for (let j = 0; j < settled.length; j += 1) {
        const s = settled[j];
        const contractId = String(batch[j]._id);
        if (s.status === 'fulfilled') {
          result.set(contractId, s.value);
        } else {
          this.logger.warn(
            `[F-040] bulk fee compute fail contract=${contractId}: ${(s.reason as Error).message}`,
          );
          // Fail-open: insert ESTIMATED fallback so caller can still render row
          const fallback = Number(
            (batch[j] as unknown as { totalAmount?: number }).totalAmount ?? 0,
          );
          result.set(contractId, {
            fee: fallback,
            source: 'ESTIMATED',
            grossGMV: 0,
            breakdown: {
              contractId,
              feeSource: 'ESTIMATED',
              totalFee: fallback,
              grossGMV: 0,
              reconciliations: [],
              computedAt: new Date().toISOString(),
              warnings: ['Bulk compute failed — fallback ESTIMATED'],
            },
            warnings: ['Bulk compute failed'],
          });
        }
      }
    }
    return result;
  }

  /**
   * F-040 self-compute — Option A: 1 SQL query with CASE statement.
   * Returns SelfComputeSliceDto + grossGMV.
   *
   * Inline duplicate (D3 decision) — fee formula NOT extracted from
   * reconciliation-calc.service.ts to preserve TD-F016 stability +
   * 102 reconciliation tests untouched.
   */
  private async computeSelfFee(
    mysqlRaceId: number,
    tenantId: number,
    contract: ContractDocument,
    periodFilter?: { periodFrom: Date | string; periodTo: Date | string },
  ): Promise<SelfComputeSliceDto & { grossGMV: number }> {
    if (!this.orderRepo) {
      throw new Error('Platform DB chưa cấu hình (orderRepo null)');
    }

    // F-043 Rate cascade extended 4-tier (BR-43-05):
    //   TIER 0: event_fee_overrides[raceId] AND effective_from <= periodFrom
    //   TIER 1: MerchantConfig.service_fee_rate (merchant default)
    //   TIER 2: contract.revenueShare.feePercentage (contract fallback)
    //   TIER 3: hardcoded 5.5% (platform default)
    let serviceFeeRate: number;
    let rateFallbackWarning: string | undefined;
    let feeSource:
      | 'event_override'
      | 'merchant_default'
      | 'contract_fallback'
      | 'platform_default';
    const config = this.merchantConfigModel
      ? await this.merchantConfigModel.findOne({ tenantId }).lean().exec()
      : null;

    // F-043 TIER 0 lookup — event override match raceId AND effective_from <= periodFrom
    // (BR-43-07 versioning theo ngày).
    // periodFrom format YYYY-MM-DD string compare lexicographically with effective_from string.
    const periodFromCheck = periodFilter?.periodFrom
      ? this.toIsoDate(periodFilter.periodFrom)
      : null;
    const override = config?.event_fee_overrides?.find(
      (o) =>
        o.raceId === mysqlRaceId &&
        // Effective check: nếu chưa có periodFrom (vd: fee-breakdown endpoint không truyền period),
        // áp override unconditionally. Nếu có periodFrom, override apply khi effective_from <= periodFrom.
        (!periodFromCheck || o.effective_from <= periodFromCheck),
    );

    const c = contract as unknown as { revenueShare?: { feePercentage?: number } };
    if (override?.service_fee_rate != null) {
      // TIER 0 — event override
      serviceFeeRate = Number(override.service_fee_rate);
      feeSource = 'event_override';
    } else if (config?.service_fee_rate != null) {
      // TIER 1 — merchant default
      serviceFeeRate = Number(config.service_fee_rate);
      feeSource = 'merchant_default';
    } else if (
      c.revenueShare?.feePercentage != null &&
      Number.isFinite(c.revenueShare.feePercentage)
    ) {
      // TIER 2 — contract fallback
      serviceFeeRate = Number(c.revenueShare.feePercentage);
      feeSource = 'contract_fallback';
      rateFallbackWarning =
        'MerchantConfig.service_fee_rate null — dùng contract.revenueShare.feePercentage';
    } else {
      // TIER 3 — platform default
      serviceFeeRate = 5.5;
      feeSource = 'platform_default';
      rateFallbackWarning =
        'MerchantConfig + contract feePercentage cả 2 null - dùng default 5.5%';
      this.logger.warn(
        `[F-040] rate fallback default 5.5% triggered for contract=${String(contract._id)} tenantId=${tenantId}`,
      );
    }

    // F-043 BR-43-06 — manual_fee_per_ticket cascade 3-tier independent (no contract fallback)
    const manualFeePerTicket =
      override?.manual_fee_per_ticket ?? config?.manual_fee_per_ticket ?? 5000;

    // Period filter — clip to YYYY-MM-DD strings for MySQL
    const periodFromStr = periodFilter?.periodFrom
      ? this.toIsoDate(periodFilter.periodFrom)
      : null;
    const periodToStr = periodFilter?.periodTo
      ? this.toIsoDate(periodFilter.periodTo)
      : null;

    // D1 Option A — 1 query with CASE statement (raw SQL via manager.query)
    const fiveBibCatsJoined = FeeService.FIVE_BIB_CATEGORIES.map(
      (c2) => `'${c2}'`,
    ).join(',');
    const periodClause =
      periodFromStr && periodToStr
        ? ' AND o.processed_on >= ? AND o.processed_on <= ?'
        : '';

    const sql = `
      SELECT
        COALESCE(SUM(CASE
          WHEN o.order_category IN (${fiveBibCatsJoined})
          THEN o.total_price * (? / 100.0)
          ELSE 0
        END), 0) AS fee_5bib,
        COALESCE(SUM(CASE
          WHEN o.order_category IN (${fiveBibCatsJoined})
          THEN o.total_price
          ELSE 0
        END), 0) AS gross_5bib,
        SUM(CASE
          WHEN o.order_category IN (${fiveBibCatsJoined})
          THEN 1
          ELSE 0
        END) AS count_5bib,
        SUM(CASE
          WHEN o.order_category = 'MANUAL'
          THEN 1
          ELSE 0
        END) AS count_manual,
        COALESCE(SUM(CASE
          WHEN o.order_category = 'MANUAL'
          THEN (
            SELECT COALESCE(SUM(oli2.quantity), 0)
            FROM order_line_item oli2
            WHERE oli2.order_id = o.id
          )
          ELSE 0
        END), 0) AS manual_ticket_count,
        COALESCE(SUM(o.total_price), 0) AS gross_gmv_all
      FROM order_metadata o
      WHERE o.internal_status = 'COMPLETE'
        AND o.deleted = 0
        AND o.id IN (
          SELECT DISTINCT oli.order_id
          FROM order_line_item oli
          INNER JOIN ticket_type tt ON tt.id = oli.ticket_type_id
          INNER JOIN race_course rc ON rc.id = tt.race_course_id
          WHERE rc.race_id = ?
        )${periodClause}
    `;

    const params: Array<string | number> = [serviceFeeRate, mysqlRaceId];
    if (periodFromStr && periodToStr) {
      params.push(`${periodFromStr} 00:00:00`);
      params.push(`${periodToStr} 23:59:59`);
    }

    const rows: Array<{
      fee_5bib: string | number | null;
      gross_5bib: string | number | null;
      count_5bib: string | number | null;
      count_manual: string | number | null;
      manual_ticket_count: string | number | null;
      gross_gmv_all: string | number | null;
    }> = await this.orderRepo.manager.query(sql, params);

    const row = rows[0] ?? {
      fee_5bib: 0,
      gross_5bib: 0,
      count_5bib: 0,
      count_manual: 0,
      manual_ticket_count: 0,
      gross_gmv_all: 0,
    };

    const count5BIB = Number(row.count_5bib ?? 0);
    const gross5BIB = Number(row.gross_5bib ?? 0);
    const fee5BIB = Math.round(Number(row.fee_5bib ?? 0));
    const countManual = Number(row.count_manual ?? 0);
    const manualTicketCount = Number(row.manual_ticket_count ?? 0);
    const feeManual = manualTicketCount * manualFeePerTicket;
    const grossGMV = Number(row.gross_gmv_all ?? 0);

    const slice: SelfComputeSliceDto & { grossGMV: number } = {
      count5BIB,
      gross5BIB,
      feeRatePercent: serviceFeeRate,
      fee5BIB,
      countManual,
      manualTicketCount,
      manualFeePerTicket,
      feeManual,
      grossGMV,
      rateFallbackWarning,
      // F-043 BR-43-16 — expose feeSource cho reconciliation preview UI badge
      feeSource,
    };

    if (periodFromStr) slice.periodGapStart = periodFromStr;
    if (periodToStr) slice.periodGapEnd = periodToStr;

    return slice;
  }

  /**
   * F-040 BR-40-04 — compute coverage of recon slices vs contract period.
   * Returns gapMonths (months not covered) + gapStart/gapEnd.
   * Atomic month-level — splits at YYYY-MM boundaries.
   */
  private computePeriodCoverage(
    reconciliations: ReconciledFeeSlice[],
    contractStart: Date,
    contractEnd: Date,
  ): {
    gapMonths: string[];
    gapStart: Date;
    gapEnd: Date;
  } {
    // Enumerate months in [contractStart, contractEnd]
    const allMonths = new Set<string>();
    const start = new Date(
      Date.UTC(contractStart.getUTCFullYear(), contractStart.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(contractEnd.getUTCFullYear(), contractEnd.getUTCMonth(), 1),
    );
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const m = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
      allMonths.add(m);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    // Subtract covered months from recon slices
    for (const r of reconciliations) {
      const rs = this.parseIsoYmd(r.periodStart);
      const re = this.parseIsoYmd(r.periodEnd);
      if (!rs || !re) continue;
      const rcursor = new Date(Date.UTC(rs.getUTCFullYear(), rs.getUTCMonth(), 1));
      const rend = new Date(Date.UTC(re.getUTCFullYear(), re.getUTCMonth(), 1));
      while (rcursor.getTime() <= rend.getTime()) {
        const m = `${rcursor.getUTCFullYear()}-${String(rcursor.getUTCMonth() + 1).padStart(2, '0')}`;
        allMonths.delete(m);
        rcursor.setUTCMonth(rcursor.getUTCMonth() + 1);
      }
    }

    const gapMonths = Array.from(allMonths).sort();
    if (gapMonths.length === 0) {
      return { gapMonths: [], gapStart: contractStart, gapEnd: contractEnd };
    }

    // Build gapStart from earliest gap month, gapEnd from latest
    const firstGap = gapMonths[0];
    const lastGap = gapMonths[gapMonths.length - 1];
    const [fy, fm] = firstGap.split('-').map(Number);
    const [ly, lm] = lastGap.split('-').map(Number);
    const gapStart = new Date(Date.UTC(fy, fm - 1, 1));
    const gapEnd = new Date(Date.UTC(ly, lm, 0)); // last day of last gap month
    return { gapMonths, gapStart, gapEnd };
  }

  private feeCacheKeys(contractId: string, tenantId: number): {
    fee: string;
    source: string;
    grossGMV: string;
    breakdown: string;
  } {
    const suffix = `${contractId}:tenant=${tenantId}`;
    return {
      fee: `pnl:ticket-sales-fee:${suffix}`,
      source: `pnl:fee-source:${suffix}`,
      grossGMV: `pnl:gross-gmv:${suffix}`,
      breakdown: `pnl:fee-breakdown:${suffix}`,
    };
  }

  private stripGrossGMV(
    slice: SelfComputeSliceDto & { grossGMV: number },
  ): SelfComputeSliceDto {
    const { grossGMV: _gross, ...rest } = slice;
    void _gross;
    return rest;
  }

  private toDate(input: Date | string | undefined): Date | null {
    if (input === undefined || input === null) return null;
    if (input instanceof Date) return input;
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private toIsoDate(input: Date | string): string {
    if (typeof input === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
      return new Date(input).toISOString().slice(0, 10);
    }
    return input.toISOString().slice(0, 10);
  }

  private parseIsoYmd(s: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  // ────────────────────────────────────────────────────────────────────
  // F-028 LEGACY — kept for backward compat (used nowhere after F-040 wiring,
  // but exported externally + as deprecated to ease consumer migration).
  // ────────────────────────────────────────────────────────────────────

  /**
   * @deprecated F-040 — use `getFeeForContract(contract)` instead. Kept for
   * backward compat with any external caller; PnLService no longer uses this
   * for TICKET_SALES branch.
   */
  async getActualRevenueForRace(
    tenantId: number | null | undefined,
    mysqlRaceId: number | null | undefined,
    contractId: string,
  ): Promise<{ revenue: number | null; warning?: string }> {
    if (!tenantId || !mysqlRaceId) {
      return {
        revenue: null,
        warning:
          'Hợp đồng chưa liên kết tenantId / mysqlRaceId — không pull được doanh thu thực, dùng ước tính',
      };
    }

    if (!this.orderRepo) {
      return {
        revenue: null,
        warning:
          'Platform DB chưa cấu hình (PLATFORM_DB_HOST unset) — dùng ước tính',
      };
    }

    const cacheKey = `pnl:ticket-sales-fee:${contractId}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const parsed = Number(cached);
          if (!Number.isNaN(parsed)) return { revenue: parsed };
        }
      } catch (e) {
        this.logger.warn(
          `[finance] redis get fail ${cacheKey}: ${(e as Error).message}`,
        );
      }
    }

    try {
      const orderRow = await this.orderRepo
        .createQueryBuilder('o')
        .select('SUM(o.total_price)', 'total')
        .where("o.internal_status = 'COMPLETE'")
        .andWhere('o.deleted = 0')
        .andWhere('o.order_category IN (:...cats)', {
          cats: FeeService.FIVE_BIB_CATEGORIES,
        })
        .andWhere(
          `o.id IN (
            SELECT DISTINCT oli2.order_id
            FROM order_line_item oli2
            INNER JOIN ticket_type tt2 ON tt2.id = oli2.ticket_type_id
            INNER JOIN race_course rc2 ON rc2.id = tt2.race_course_id
            WHERE rc2.race_id = :raceId2
          )`,
          { raceId2: mysqlRaceId },
        )
        .getRawOne<{ total: string | null }>();

      const revenue = Number(orderRow?.total ?? 0);

      if (this.redis) {
        try {
          await this.redis.set(cacheKey, String(revenue), 'EX', 300);
        } catch (e) {
          this.logger.warn(
            `[finance] redis set fail ${cacheKey}: ${(e as Error).message}`,
          );
        }
      }

      return { revenue };
    } catch (err) {
      this.logger.warn(
        `[finance] MySQL pull fail tenant=${tenantId} race=${mysqlRaceId}: ${
          (err as Error).message
        }`,
      );
      return {
        revenue: null,
        warning:
          'Không truy vấn được doanh thu thực từ platform DB — dùng ước tính. Liên hệ kỹ thuật nếu lặp lại.',
      };
    }
  }

  /**
   * @deprecated F-040 — use `getFeeForContractsBulk(contracts)` instead.
   * Kept for backward compat; F-029 HIGH-PERF-01 bulk path replaced by
   * concurrency-limited Promise.allSettled over per-contract `getFeeForContract`
   * (each goes through composite mget cache hot-path).
   */
  async getActualRevenueForRaces(
    raceIds: number[],
    options?: { chunkSize?: number },
  ): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (raceIds.length === 0) return result;

    if (!this.orderRepo) {
      this.logger.warn(
        `[finance] getActualRevenueForRaces skipped (platform DB unset) — ${raceIds.length} races requested`,
      );
      return result;
    }

    const uniqueRaceIds = Array.from(new Set(raceIds.filter((id) => id > 0)));
    const chunkSize = options?.chunkSize ?? 100;

    for (let i = 0; i < uniqueRaceIds.length; i += chunkSize) {
      const chunk = uniqueRaceIds.slice(i, i + chunkSize);
      try {
        const rows: Array<{ raceId: number | string; total: string | null }> =
          await this.orderRepo
            .createQueryBuilder('o')
            .select('rc.race_id', 'raceId')
            .addSelect('SUM(o.total_price)', 'total')
            .innerJoin('order_line_item', 'oli', 'oli.order_id = o.id')
            .innerJoin('ticket_type', 'tt', 'tt.id = oli.ticket_type_id')
            .innerJoin('race_course', 'rc', 'rc.id = tt.race_course_id')
            .where("o.internal_status = 'COMPLETE'")
            .andWhere('o.deleted = 0')
            .andWhere('o.order_category IN (:...cats)', {
              cats: FeeService.FIVE_BIB_CATEGORIES,
            })
            .andWhere('rc.race_id IN (:...raceIds)', { raceIds: chunk })
            .andWhere(
              `o.id IN (
                SELECT DISTINCT oli2.order_id
                FROM order_line_item oli2
                INNER JOIN ticket_type tt2 ON tt2.id = oli2.ticket_type_id
                INNER JOIN race_course rc2 ON rc2.id = tt2.race_course_id
                WHERE rc2.race_id IN (:...raceIdsInner)
              )`,
              { raceIdsInner: chunk },
            )
            .groupBy('rc.race_id')
            .getRawMany();

        for (const row of rows) {
          const raceId = Number(row.raceId);
          const revenue = Number(row.total ?? 0);
          if (raceId > 0 && !Number.isNaN(revenue)) {
            result.set(raceId, revenue);
          }
        }
      } catch (err) {
        this.logger.warn(
          `[finance] getActualRevenueForRaces chunk ${i / chunkSize + 1}/${Math.ceil(
            uniqueRaceIds.length / chunkSize,
          )} fail (${chunk.length} races, ids[0..2]=${chunk
            .slice(0, 3)
            .join(',')}): ${(err as Error).message}`,
        );
      }
    }

    return result;
  }

  // ────────────────────────────────────────────────────────────────────
  // F-058 — Analytics aggregate fee với Tier 0 cascade per-order pro-rate
  // ────────────────────────────────────────────────────────────────────

  /**
   * F-058 BR-58-01..05 — Aggregate fee computation cho Analytics dashboard.
   *
   * Khác với `computeSelfFee()` (per-contract per-race period-level Tier 0
   * check), method này nhận orders array đã pull sẵn từ Analytics service,
   * apply per-order pro-rate (PAUSE-58-03 = C):
   *   - `order.createdAt >= override.effective_from` → áp override
   *   - else → áp default Tier 1
   *
   * Cascade 3-field independent (PAUSE-58-02 = A):
   *   - service_fee_rate
   *   - manual_fee_per_ticket (cho MANUAL category)
   *   - fee_vat_rate
   *
   * Mỗi field tự cascade 4 tier (TIER 0 event override → TIER 1 merchant
   * default → TIER 2 contract — ONLY rate, không có cho manual/vat — →
   * TIER 3 platform default 5.5% / 5000 / 0).
   *
   * Read-only. Idempotent. KHÔNG side effect.
   *
   * **IMPORTANT:** Method này KHÔNG modify `computeSelfFee()` existing
   * (F-040 + F-043 territory protected). Cascade logic được duplicate có chủ ý
   * vì semantics khác (per-order vs per-period). Future refactor → F-059.
   */
  async computeFeeForOrdersAggregate(
    tenantId: number,
    orders: OrderForFeeAggregate[],
    _period: { from: Date | string; to: Date | string },
    // F-059 hotfix 2026-05-24: optional pre-loaded config injection.
    // Dashboard KPI/Sparkline batch pre-loads MerchantConfig via $in query then
    // passes per-tenant config here → avoids N internal findOne calls (N+1 fix).
    // Backward compat: analytics callers (F-058) omit this arg → fallback findOne.
    injectedConfig?: MerchantConfigDocument | null,
  ): Promise<AnalyticsFeeAggregateResultDto> {
    void _period; // period đã được Analytics filter trước khi pass orders, giữ làm tham số docs

    const warnings: string[] = [];

    // 1. Load MerchantConfig 1 lần. Empty config → fallback Tier 3 (BR-58-15).
    //    Pre-loaded `injectedConfig` được prefer; chỉ findOne nếu undefined (F-059).
    const config =
      injectedConfig !== undefined
        ? injectedConfig
        : this.merchantConfigModel
          ? await this.merchantConfigModel.findOne({ tenantId }).lean().exec()
          : null;

    if (!config) {
      warnings.push(
        `MerchantConfig không tồn tại cho tenantId=${tenantId} — fallback Tier 3 platform default 5.5% / 5000 VND / 0% VAT`,
      );
      this.logger.warn(
        `[F-058] MerchantConfig missing tenantId=${tenantId} — Tier 3 fallback applied`,
      );
    }

    // 2. Tier 1 defaults
    const defaultRate = config?.service_fee_rate ?? 5.5;
    const defaultManual = config?.manual_fee_per_ticket ?? 5000;
    const defaultVat = config?.fee_vat_rate ?? 0;

    // 3. Build raceId → override map (Tier 0 lookup; per-field nullable)
    const overrideByRace = new Map<number, {
      service_fee_rate: number | null;
      manual_fee_per_ticket: number | null;
      fee_vat_rate: number | null;
      effective_from: string;
    }>();
    for (const o of config?.event_fee_overrides ?? []) {
      overrideByRace.set(o.raceId, {
        service_fee_rate: o.service_fee_rate,
        manual_fee_per_ticket: o.manual_fee_per_ticket,
        fee_vat_rate: o.fee_vat_rate,
        effective_from: o.effective_from,
      });
    }

    // 4. Per-order cascade + pro-rate
    let totalServiceFee = 0;
    let totalManualFee = 0;
    let totalVat = 0;
    let totalNetGmv = 0;

    const sourceCounter: Record<string, { totalFee: number; orderCount: number }> = {
      event_override: { totalFee: 0, orderCount: 0 },
      merchant_default: { totalFee: 0, orderCount: 0 },
      contract_fallback: { totalFee: 0, orderCount: 0 },
      platform_default: { totalFee: 0, orderCount: 0 },
    };
    const appliedOverridesSet = new Map<string, AppliedOverrideEntryDto>();

    const fiveBibCats = FeeService.FIVE_BIB_CATEGORIES;

    for (const order of orders) {
      const orderDate =
        order.createdAt instanceof Date
          ? order.createdAt.toISOString().slice(0, 10)
          : String(order.createdAt).slice(0, 10);

      const override = overrideByRace.get(order.raceId);
      const overrideEligible = !!override && override.effective_from <= orderDate;

      // Per-field cascade (BR-58-02 independent)
      // Rate (BR-58-02 row 1)
      let appliedRate: number;
      let rateSource: 'event_override' | 'merchant_default' | 'platform_default';
      if (overrideEligible && override!.service_fee_rate != null) {
        appliedRate = Number(override!.service_fee_rate);
        rateSource = 'event_override';
        const key = `${order.raceId}|service_fee_rate`;
        if (!appliedOverridesSet.has(key)) {
          appliedOverridesSet.set(key, {
            raceId: order.raceId,
            field: 'service_fee_rate',
            value: appliedRate,
            effectiveFrom: override!.effective_from,
          });
        }
      } else if (config?.service_fee_rate != null) {
        appliedRate = Number(defaultRate);
        rateSource = 'merchant_default';
      } else {
        appliedRate = 5.5;
        rateSource = 'platform_default';
      }

      // Manual fee per ticket (BR-58-02 row 2)
      let appliedManualFee: number;
      if (overrideEligible && override!.manual_fee_per_ticket != null) {
        appliedManualFee = Number(override!.manual_fee_per_ticket);
        const key = `${order.raceId}|manual_fee_per_ticket`;
        if (!appliedOverridesSet.has(key)) {
          appliedOverridesSet.set(key, {
            raceId: order.raceId,
            field: 'manual_fee_per_ticket',
            value: appliedManualFee,
            effectiveFrom: override!.effective_from,
          });
        }
      } else {
        appliedManualFee = defaultManual;
      }

      // VAT (BR-58-02 row 3)
      let appliedVatRate: number;
      if (overrideEligible && override!.fee_vat_rate != null) {
        appliedVatRate = Number(override!.fee_vat_rate);
        const key = `${order.raceId}|fee_vat_rate`;
        if (!appliedOverridesSet.has(key)) {
          appliedOverridesSet.set(key, {
            raceId: order.raceId,
            field: 'fee_vat_rate',
            value: appliedVatRate,
            effectiveFrom: override!.effective_from,
          });
        }
      } else {
        appliedVatRate = defaultVat;
      }

      // Compute fee per order
      const cat = order.orderCategory;
      const isManual = cat === 'MANUAL';
      const is5bib = fiveBibCats.includes(cat);

      let orderServiceFee = 0;
      let orderManualFee = 0;
      let orderVat = 0;
      let orderNetGmv = 0;

      if (is5bib) {
        const netGmv = Math.max(
          Number(order.totalPrice) - Number(order.totalDiscounts ?? 0),
          0,
        );
        orderNetGmv = netGmv;
        orderServiceFee = (netGmv * appliedRate) / 100;
        orderVat = (orderServiceFee * appliedVatRate) / 100;
      } else if (isManual) {
        const tickets = Number(order.manualTicketCount ?? 0);
        orderManualFee = tickets * appliedManualFee;
        // MANUAL không có VAT trên fee theo F-043 BR-43-06 — VAT chỉ áp cho service_fee
      }

      totalServiceFee += orderServiceFee;
      totalManualFee += orderManualFee;
      totalVat += orderVat;
      totalNetGmv += orderNetGmv;

      // Source attribution — phân theo rate source (dominant cho 5BIB orders)
      const orderFee = orderServiceFee + orderManualFee + orderVat;
      const bucket = sourceCounter[rateSource];
      bucket.totalFee += orderFee;
      bucket.orderCount += 1;
    }

    // Round to integer VND
    totalServiceFee = Math.round(totalServiceFee);
    totalManualFee = Math.round(totalManualFee);
    totalVat = Math.round(totalVat);
    totalNetGmv = Math.round(totalNetGmv);
    const totalFee = totalServiceFee + totalManualFee + totalVat;

    const feeSourceBreakdown: FeeSourceBreakdownEntryDto[] = Object.entries(
      sourceCounter,
    )
      .filter(([, v]) => v.orderCount > 0)
      .map(([source, v]) => ({
        source: source as FeeSourceBreakdownEntryDto['source'],
        totalFee: Math.round(v.totalFee),
        orderCount: v.orderCount,
      }));

    return {
      tenantId,
      totalServiceFee,
      totalManualFee,
      totalVat,
      totalFee,
      totalNetGmv,
      feeSourceBreakdown,
      appliedOverrides: Array.from(appliedOverridesSet.values()),
      warnings,
    };
  }
}

// Re-export constant cho cross-module reference (no-op type guard).
export { F040_PRE_F016_CUTOFF };
