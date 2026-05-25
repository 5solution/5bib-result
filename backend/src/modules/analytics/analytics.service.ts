import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../merchant/schemas/merchant-config.schema';
import {
  Reconciliation,
  ReconciliationDocument,
} from '../reconciliation/schemas/reconciliation.schema';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { FeeService } from '../finance/services/fee.service';
import type { OrderForFeeAggregate } from '../finance/dto/fee-aggregate.dto';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import {
  DiscrepancyCheckQueryDto,
  DiscrepancyCheckResponseDto,
  DiscrepancyVerdict,
} from './dto/analytics-discrepancy.dto';
// F-062 Wave 2B-1+2B-2 — period comparison + bucket helpers + cache-key helpers
import {
  resolveCompare,
  calcDeltaPercent,
  buildMetricCacheKey,
  resolveScopeFromTenant,
  periodKeyFromInputs,
  ymd,
  addDaysUtc,
} from './services/period-resolver';
import {
  dateToWeekKey,
  dateToMonthKey,
  weekKeyToRange,
  monthKeyToRange,
  mysqlYearweekToWeekKey,
  labelForWeekKey,
  labelForMonthKey,
  normalizePaymentOn,
} from './services/bucket-helpers';

/** Current month: 15 min. Historical months: 24 h (data doesn't change). */
const TTL_CURRENT = 900;   // 15 minutes
const TTL_HISTORY = 86400; // 24 hours
const MAX_DATE_RANGE_DAYS = 366;

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthTtl(month?: string): number {
  if (!month) return TTL_CURRENT;
  return month === currentMonthStr() ? TTL_CURRENT : TTL_HISTORY;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectModel(MerchantConfig.name)
    private readonly configModel: Model<MerchantConfigDocument>,
    @InjectModel(Reconciliation.name)
    private readonly reconciliationModel: Model<ReconciliationDocument>,
    @InjectRedis() private readonly redis: Redis,
    // F-058 — Delegate fee cascade to FeeService (PAUSE-58-01 = A)
    private readonly feeService: FeeService,
    // F-058 — Reconciliation aggregate for discrepancy-check (PAUSE-58-08 = A)
    private readonly reconciliationService: ReconciliationService,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private validateDateRange(from?: string, to?: string): void {
    if (from && to) {
      const diffMs = new Date(to).getTime() - new Date(from).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > MAX_DATE_RANGE_DAYS) {
        throw new BadRequestException(
          `Date range must not exceed ${MAX_DATE_RANGE_DAYS} days`,
        );
      }
    }
  }

  /**
   * Read from Redis cache. On miss, compute via fn() and store.
   * TTL auto-detected: if the cache key contains the current month string
   * (YYYY-MM) → 15 min. Otherwise (historical data) → 24 h.
   * Pass an explicit ttl to override.
   */
  async cachedQuery<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    const resolvedTtl = ttl ?? (key.includes(currentMonthStr()) ? TTL_CURRENT : TTL_HISTORY);
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch (e) {
      this.logger.warn(`Redis get failed for key ${key}: ${e}`);
    }
    const result = await fn();
    try {
      await this.redis.set(key, JSON.stringify(result), 'EX', resolvedTtl);
    } catch (e) {
      this.logger.warn(`Redis set failed for key ${key}: ${e}`);
    }
    return result;
  }

  private buildDateFilter(
    from?: string,
    to?: string,
    month?: string,
  ): { clause: string; params: any[] } {
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const start = `${year}-${String(mon).padStart(2, '0')}-01`;
      const nextMonth = mon === 12 ? 1 : mon + 1;
      const nextYear = mon === 12 ? year + 1 : year;
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      return {
        clause: 'payment_on >= ? AND payment_on < ?',
        params: [start, end],
      };
    }
    if (from || to) {
      const parts: string[] = [];
      const params: any[] = [];
      if (from) {
        parts.push('payment_on >= ?');
        params.push(from);
      }
      if (to) {
        parts.push('payment_on <= ?');
        params.push(`${to} 23:59:59`);
      }
      return { clause: parts.join(' AND '), params };
    }
    return { clause: '', params: [] };
  }

  // F-058 — `getFeeConfigs()` DELETED. Was Tier 1 only — bypassed F-043 Tier 0
  // event override cascade. All call sites now use `feeService.computeFeeForOrdersAggregate()`
  // which applies full 4-tier cascade + per-order pro-rate.

  /**
   * F-058 helper — Resolve period boundary (YYYY-MM-DD) from AnalyticsQueryDto
   * for fee aggregate calls. Defaults: month → first/last day; from/to → as-is.
   */
  private resolvePeriodWindow(query: AnalyticsQueryDto): { from: string; to: string } {
    if (query.month) {
      const [year, mon] = query.month.split('-').map(Number);
      const start = `${year}-${String(mon).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
      const end = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from: start, to: end };
    }
    if (query.from || query.to) {
      return {
        from: query.from ?? '1970-01-01',
        to: query.to ?? new Date().toISOString().slice(0, 10),
      };
    }
    return {
      from: new Date().toISOString().slice(0, 7) + '-01',
      to: new Date().toISOString().slice(0, 10),
    };
  }

  /**
   * F-058 helper — Pull orders raw từ MySQL group by (tenant, race) cho 1 period.
   * Trả về Map<tenantId, OrderForFeeAggregate[]> để feed `computeFeeForOrdersAggregate`.
   *
   * Hint scope: optional `tenantId` filter + optional `raceId` filter để giới
   * hạn query size (TopRaces, RaceDetail).
   */
  private async pullOrdersForFeeAggregate(
    clause: string,
    params: any[],
    filter?: { tenantId?: number; raceId?: number },
  ): Promise<Map<number, OrderForFeeAggregate[]>> {
    const whereClause = clause ? `AND ${clause}` : '';
    const extraConds: string[] = [];
    const extraParams: any[] = [];
    if (filter?.tenantId) {
      extraConds.push('r.tenant_id = ?');
      extraParams.push(filter.tenantId);
    }
    if (filter?.raceId) {
      extraConds.push('om.race_id = ?');
      extraParams.push(filter.raceId);
    }
    const extraWhere = extraConds.length > 0 ? `AND ${extraConds.join(' AND ')}` : '';

    const rows: Array<{
      id: number;
      tenant_id: number;
      race_id: number;
      total_price: string | number;
      total_discounts: string | number | null;
      order_category: string;
      payment_on: Date | string;
      payment_ref: string | null;
      manual_ticket_count: string | number | null;
    }> = await this.db.query(
      // HOTFIX F-058 2026-05-22: column thực tế là `payment_on` (NOT
      // `created_at` — order_metadata table không có column đó). Verified
      // bằng existing dashboard/kpi.service.ts pattern + entity OrderReadonly.
      // Semantic: `payment_on` chuẩn hơn cho fee calc (chỉ áp khi tiền vào).
      // F-061 BR-61-08: thêm `om.payment_ref` để FeeService cascade phân biệt
      // 5BIB-eligible (ref truthy) vs MANUAL semantic (ref empty/null).
      `SELECT
        om.id,
        r.tenant_id,
        om.race_id,
        om.total_price,
        om.total_discounts,
        om.order_category,
        om.payment_on,
        om.payment_ref,
        oli_agg.total_quantity AS manual_ticket_count
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      LEFT JOIN (
        SELECT order_id, SUM(quantity) AS total_quantity
        FROM order_line_item GROUP BY order_id
      ) oli_agg ON oli_agg.order_id = om.id
      WHERE om.financial_status = 'paid' ${whereClause} ${extraWhere}`,
      [...params, ...extraParams],
    );

    const byTenant = new Map<number, OrderForFeeAggregate[]>();
    for (const r of rows) {
      const tid = Number(r.tenant_id);
      const arr = byTenant.get(tid) ?? [];
      arr.push({
        id: Number(r.id),
        raceId: Number(r.race_id),
        totalPrice: Number(r.total_price ?? 0),
        totalDiscounts: Number(r.total_discounts ?? 0),
        orderCategory: r.order_category,
        createdAt: r.payment_on,  // F-058 hotfix: MySQL column `payment_on` → TS field `createdAt` (semantic: order paid time = effective date for fee cascade)
        paymentRef: r.payment_ref ?? null, // F-061 BR-61-08
        manualTicketCount: r.manual_ticket_count != null ? Number(r.manual_ticket_count) : undefined,
      });
      byTenant.set(tid, arr);
    }
    return byTenant;
  }

  private monthShift(month: string, delta: number): string {
    const [year, mon] = month.split('-').map(Number);
    let m = mon + delta;
    let y = year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  // ─── API Methods ──────────────────────────────────────────────────────────

  async getOverview(query: AnalyticsQueryDto) {
    const month = query.month ?? new Date().toISOString().slice(0, 7);
    const cacheKey = `analytics:overview:${month}`;
    return this.cachedQuery(cacheKey, () => this._computeOverview(month));
  }

  private async _computeOverview(month: string) {
    const { clause: curClause, params: curParams } = this.buildDateFilter(
      undefined,
      undefined,
      month,
    );
    const prevMonth = this.monthShift(month, -1);
    const { clause: prevClause, params: prevParams } = this.buildDateFilter(
      undefined,
      undefined,
      prevMonth,
    );

    // 1. Current month paid summary — MANUAL orders excluded from GMV
    //    (5BIB has no revenue share on manual orders, only fixed ticket fee)
    const [curRow] = await this.db.query(
      `SELECT
        COUNT(CASE WHEN order_category != 'MANUAL' THEN 1 END) as order_count,
        COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) as gross_gmv,
        COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN IFNULL(total_discounts, 0) ELSE 0 END), 0) as total_discounts,
        COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN GREATEST(total_price - IFNULL(total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
      FROM order_metadata
      WHERE financial_status = 'paid' AND ${curClause}`,
      curParams,
    );

    // 2. Previous month paid summary — same exclusion for consistent comparison
    const [prevRow] = await this.db.query(
      `SELECT
        COUNT(CASE WHEN order_category != 'MANUAL' THEN 1 END) as order_count,
        COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) as gross_gmv
      FROM order_metadata
      WHERE financial_status = 'paid' AND ${prevClause}`,
      prevParams,
    );

    // 3. Voided count current month
    const [voidedRow] = await this.db.query(
      `SELECT COUNT(*) as voided_count
      FROM order_metadata
      WHERE financial_status = 'voided' AND ${curClause}`,
      curParams,
    );

    // 4. Category breakdown
    const categoryRows = await this.db.query(
      `SELECT order_category, COUNT(*) as cnt, COALESCE(SUM(total_price), 0) as gmv
      FROM order_metadata
      WHERE financial_status = 'paid' AND ${curClause}
      GROUP BY order_category`,
      curParams,
    );

    // 5. Open races (status = GENERATED_CODE)
    const [openRacesRow] = await this.db.query(
      `SELECT COUNT(*) as open_races FROM races WHERE status = 'GENERATED_CODE' AND is_delete = 0`,
    );

    // 6. Platform fee — F-058: delegate FeeService với Tier 0 cascade per-order
    // pro-rate. Pull orders raw → group by tenant → call computeFeeForOrdersAggregate
    // per tenant (sequential giữ memory + Mongo connection budget).
    const ordersByTenant = await this.pullOrdersForFeeAggregate(curClause, curParams);
    const periodWindow = this.resolvePeriodWindow({ month } as AnalyticsQueryDto);

    let platformFee = 0;
    for (const [tenantId, orders] of ordersByTenant) {
      const result = await this.feeService.computeFeeForOrdersAggregate(
        tenantId,
        orders,
        { from: periodWindow.from, to: periodWindow.to },
      );
      platformFee += result.totalFee;
    }

    // 7. Pending reconciliations from MongoDB
    const pendingReconciliations = await this.reconciliationModel
      .countDocuments({ status: { $in: ['draft', 'flagged', 'ready'] } })
      .exec();

    const orderCount = Number(curRow.order_count);
    const grossGmv = Number(curRow.gross_gmv);
    const netGmv = Number(curRow.net_gmv);
    const prevGmv = Number(prevRow.gross_gmv);
    const prevOrderCount = Number(prevRow.order_count);

    return {
      gmv: grossGmv,
      netGmv,
      orderCount,
      platformFee: Math.round(platformFee),
      voidedCount: Number(voidedRow.voided_count),
      openRaces: Number(openRacesRow.open_races),
      avgOrderValue: orderCount > 0 ? Math.round(grossGmv / orderCount) : 0,
      vsLastMonth: {
        gmvChange:
          prevGmv > 0
            ? Math.round(((grossGmv - prevGmv) / prevGmv) * 10000) / 100
            : null,
        orderChange:
          prevOrderCount > 0
            ? Math.round(
                ((orderCount - prevOrderCount) / prevOrderCount) * 10000,
              ) / 100
            : null,
      },
      pendingReconciliations,
      categoryBreakdown: categoryRows.map((r: any) => ({
        category: r.order_category,
        count: Number(r.cnt),
        gmv: Number(r.gmv),
      })),
    };
  }

  async getDailyRevenue(query: AnalyticsQueryDto) {
    this.validateDateRange(query.from, query.to);
    const cacheKey = `analytics:daily:${query.from ?? ''}:${query.to ?? ''}:${query.month ?? ''}:${query.tenantId ?? ''}`;
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';

      let sql: string;
      let sqlParams: any[];

      if (query.tenantId) {
        sql = `SELECT
          DATE(om.payment_on) as date,
          COUNT(CASE WHEN om.order_category != 'MANUAL' THEN 1 END) as order_count,
          COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN om.total_price ELSE 0 END), 0) as gmv,
          COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        WHERE om.financial_status = 'paid' AND r.tenant_id = ? ${whereClause}
        GROUP BY DATE(om.payment_on)
        ORDER BY date ASC`;
        sqlParams = [query.tenantId, ...params];
      } else {
        sql = `SELECT
          DATE(payment_on) as date,
          COUNT(CASE WHEN order_category != 'MANUAL' THEN 1 END) as order_count,
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) as gmv,
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN GREATEST(total_price - IFNULL(total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
        FROM order_metadata
        WHERE financial_status = 'paid' ${whereClause}
        GROUP BY DATE(payment_on)
        ORDER BY date ASC`;
        sqlParams = params;
      }

      const rows = await this.db.query(sql, sqlParams);

      return rows.map((r: any) => ({
        date:
          r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
        orderCount: Number(r.order_count),
        gmv: Number(r.gmv),
        netGmv: Number(r.net_gmv),
      }));
    });
  }

  // ─── F-062 Wave 2B-1 — Weekly / Monthly / Comparison endpoints ──────────────
  // BR-SA-02/03/04 (PRD v3): chart data trên dashboard Sales Analytics.
  // Phí 5BIB PHẢI dùng FeeService.computeFeeForOrdersAggregate per (tenant, bucket)
  // — KHÔNG inline tính phí (BR-SA-02 mandate, F-040 4-tier cascade).
  // Cache keys per BR-SA-02/03/04/18 spec: `analytics:metric:<name>:<scope>:<periodKey>`
  // via Wave 1 `buildMetricCacheKey` helper (extended Wave 2B-1 fix với tenant scope).

  /**
   * F-062 Wave 2B-1 helper (refactored Wave 2B-2 → delegate shared util).
   * BR-SA-02 spec: scope = 'platform' nếu no tenant filter, else 'tenant:<id>'.
   * Implementation lives in `period-resolver.ts:resolveScopeFromTenant` —
   * extracted Wave 2B-2 cho reuse trong merchant-comparison + future Wave 2C.
   */
  private resolveQueryScope(
    query: AnalyticsQueryDto,
  ): 'platform' | { tenantId: number } {
    return resolveScopeFromTenant(query.tenantId);
  }

  /**
   * F-062 Wave 2B-1 helper (refactored Wave 2B-2 → delegate shared util).
   * Same query parameters → same periodKey. Implementation in
   * `period-resolver.ts:periodKeyFromInputs`.
   */
  private buildPeriodKey(query: AnalyticsQueryDto): string {
    return periodKeyFromInputs({
      month: query.month,
      from: query.from,
      to: query.to,
    });
  }

  /**
   * F-062 Wave 2B-1 helper — BR-SA-02 + BR-SA-03 default period.
   *
   * "Default 12 tuần gần nhất" / "Default 12 tháng gần nhất" khi không truyền
   * `from/to/month`. Trả về **NEW** query object (KHÔNG mutate input) để cacheKey
   * resolution + tests deterministic.
   *
   * Trade-off: weekly default = 84 days (~12 tuần), monthly default = 365 days
   * (~12 tháng). Inclusive endpoints — `to = today`.
   */
  private applyDefaultPeriod(
    query: AnalyticsQueryDto,
    granularity: 'week' | 'month',
  ): AnalyticsQueryDto {
    if (query.from || query.to || query.month) return query;
    const today = new Date();
    const days = granularity === 'week' ? 84 : 365;
    const fromDate = addDaysUtc(today, -days);
    return { ...query, from: ymd(fromDate), to: ymd(today) };
  }

  /**
   * F-062 BR-SA-02 v3 — Weekly revenue bucketed by ISO 8601 week.
   * Group by `YEARWEEK(payment_on, 3)` (Monday start, week 1 = first week ≥4 days
   * in new year — khớp `dateToWeekKey` helper).
   *
   * Per-bucket platformFee tính qua FeeService Tier 0 cascade. Trade-off:
   * pull orders raw full period → group in-memory by ISO week → run FeeService
   * mỗi (tenant, week). 12 tuần × ~58 tenant ≈ 700 cuộc gọi/cache miss; cache TTL
   * cho period current/historical bảo vệ throughput.
   *
   * Default: 12 tuần gần nhất nếu KHÔNG truyền from/to/month (BR-SA-02 line 186).
   * Cache: `analytics:metric:weekly-revenue:<scope>:<periodKey>` per BR-SA-02 line 187.
   */
  async getWeeklyRevenue(query: AnalyticsQueryDto) {
    query = this.applyDefaultPeriod(query, 'week');
    this.validateDateRange(query.from, query.to);
    const cacheKey = buildMetricCacheKey(
      'weekly-revenue',
      this.resolveQueryScope(query),
      this.buildPeriodKey(query),
    );
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';

      let sql: string;
      let sqlParams: any[];
      if (query.tenantId) {
        sql = `SELECT
          YEARWEEK(om.payment_on, 3) as iso_yw,
          COUNT(CASE WHEN om.order_category != 'MANUAL' THEN 1 END) as order_count,
          COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN om.total_price ELSE 0 END), 0) as gmv,
          COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        WHERE om.financial_status = 'paid' AND r.tenant_id = ? ${whereClause}
        GROUP BY YEARWEEK(om.payment_on, 3)
        ORDER BY iso_yw ASC`;
        sqlParams = [query.tenantId, ...params];
      } else {
        sql = `SELECT
          YEARWEEK(payment_on, 3) as iso_yw,
          COUNT(CASE WHEN order_category != 'MANUAL' THEN 1 END) as order_count,
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) as gmv,
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN GREATEST(total_price - IFNULL(total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
        FROM order_metadata
        WHERE financial_status = 'paid' ${whereClause}
        GROUP BY YEARWEEK(payment_on, 3)
        ORDER BY iso_yw ASC`;
        sqlParams = params;
      }

      const rows = await this.db.query(sql, sqlParams);

      // Per-bucket fee attribution via FeeService.
      const feeByBucket = await this.computeFeePerBucket(
        clause,
        params,
        query.tenantId,
        'week',
      );

      return rows.map((r: any) => {
        const weekKey = mysqlYearweekToWeekKey(r.iso_yw);
        const { weekStart, weekEnd } = weekKeyToRange(weekKey);
        return {
          week: weekKey,
          weekStart,
          weekEnd,
          gmv: Number(r.gmv),
          netGmv: Number(r.net_gmv),
          platformFee: Math.round(feeByBucket.get(weekKey) ?? 0),
          orderCount: Number(r.order_count),
        };
      });
    });
  }

  /**
   * F-062 BR-SA-03 v3 — Monthly revenue bucketed by calendar month.
   * Group by `DATE_FORMAT(payment_on, '%Y-%m')`.
   *
   * Per-bucket platformFee tính qua FeeService Tier 0 cascade. Cùng pattern
   * weekly nhưng ít buckets hơn (12 month max trên 1y range).
   *
   * Default: 12 tháng gần nhất nếu KHÔNG truyền from/to/month (BR-SA-03 line 195).
   * Cache: `analytics:metric:monthly-revenue:<scope>:<periodKey>` per BR-SA-03 line 196.
   */
  async getMonthlyRevenue(query: AnalyticsQueryDto) {
    query = this.applyDefaultPeriod(query, 'month');
    this.validateDateRange(query.from, query.to);
    const cacheKey = buildMetricCacheKey(
      'monthly-revenue',
      this.resolveQueryScope(query),
      this.buildPeriodKey(query),
    );
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';

      let sql: string;
      let sqlParams: any[];
      if (query.tenantId) {
        sql = `SELECT
          DATE_FORMAT(om.payment_on, '%Y-%m') as month_key,
          COUNT(CASE WHEN om.order_category != 'MANUAL' THEN 1 END) as order_count,
          COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN om.total_price ELSE 0 END), 0) as gmv,
          COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        WHERE om.financial_status = 'paid' AND r.tenant_id = ? ${whereClause}
        GROUP BY DATE_FORMAT(om.payment_on, '%Y-%m')
        ORDER BY month_key ASC`;
        sqlParams = [query.tenantId, ...params];
      } else {
        sql = `SELECT
          DATE_FORMAT(payment_on, '%Y-%m') as month_key,
          COUNT(CASE WHEN order_category != 'MANUAL' THEN 1 END) as order_count,
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) as gmv,
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN GREATEST(total_price - IFNULL(total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
        FROM order_metadata
        WHERE financial_status = 'paid' ${whereClause}
        GROUP BY DATE_FORMAT(payment_on, '%Y-%m')
        ORDER BY month_key ASC`;
        sqlParams = params;
      }

      const rows = await this.db.query(sql, sqlParams);

      const feeByBucket = await this.computeFeePerBucket(
        clause,
        params,
        query.tenantId,
        'month',
      );

      return rows.map((r: any) => ({
        month: String(r.month_key),
        gmv: Number(r.gmv),
        netGmv: Number(r.net_gmv),
        platformFee: Math.round(feeByBucket.get(String(r.month_key)) ?? 0),
        orderCount: Number(r.order_count),
      }));
    });
  }

  /**
   * F-062 Wave 2B-1 helper — Per-bucket fee attribution.
   * 1. Pull orders raw full period bằng `pullOrdersForFeeAggregate` (per-tenant Map)
   * 2. Re-group orders by bucket key (`YYYY-Www` hoặc `YYYY-MM`) in-memory
   * 3. Mỗi (tenant, bucket) → `computeFeeForOrdersAggregate` với bucket window
   * 4. Sum fee qua tất cả tenant per bucket → Map<bucketKey, fee>
   */
  private async computeFeePerBucket(
    clause: string,
    params: any[],
    tenantId: number | undefined,
    granularity: 'week' | 'month',
  ): Promise<Map<string, number>> {
    const filter = tenantId ? { tenantId } : undefined;
    const ordersByTenant = await this.pullOrdersForFeeAggregate(
      clause,
      params,
      filter,
    );
    const feeByBucket = new Map<string, number>();

    for (const [tid, orders] of ordersByTenant) {
      // Group tenant orders → bucket
      const ordersByBucket = new Map<string, OrderForFeeAggregate[]>();
      for (const o of orders) {
        const dt = normalizePaymentOn(o.createdAt);
        const bucketKey =
          granularity === 'week' ? dateToWeekKey(dt) : dateToMonthKey(dt);
        const arr = ordersByBucket.get(bucketKey) ?? [];
        arr.push(o);
        ordersByBucket.set(bucketKey, arr);
      }

      for (const [bucketKey, bucketOrders] of ordersByBucket) {
        const window =
          granularity === 'week'
            ? weekKeyToRange(bucketKey)
            : monthKeyToRange(bucketKey);
        const from =
          granularity === 'week'
            ? (window as { weekStart: string }).weekStart
            : (window as { monthStart: string }).monthStart;
        const to =
          granularity === 'week'
            ? (window as { weekEnd: string }).weekEnd
            : (window as { monthEnd: string }).monthEnd;
        const result = await this.feeService.computeFeeForOrdersAggregate(
          tid,
          bucketOrders,
          { from, to },
        );
        feeByBucket.set(
          bucketKey,
          (feeByBucket.get(bucketKey) ?? 0) + result.totalFee,
        );
      }
    }

    return feeByBucket;
  }

  /**
   * F-062 BR-SA-04 v3 — Period-over-period comparison.
   * - `compareWith=wow` → lùi 7 ngày (Wave 1 `resolveCompare` symmetric)
   * - `compareWith=mom` → lùi 1 calendar month với day-clamp (Wave 2A shiftMonthClamped)
   * - `compareWith=yoy` → lùi 1 năm (F-026 backward compat)
   *
   * Trả về current + previous summary + delta % cho 4 metric (gmv/netGmv/
   * platformFee/orderCount). Delta dùng `calcDeltaPercent` guard base=0 → null.
   */
  async getComparison(
    query: AnalyticsQueryDto,
    compareWith: 'wow' | 'mom' | 'yoy' = 'mom',
  ) {
    this.validateDateRange(query.from, query.to);
    // BR-SA-04 line 216 spec: `analytics:metric:comparison:<scope>:<compareWith>:<periodKey>`
    // compareWith axis BETWEEN scope và periodKey — buildMetricCacheKey `extra` param.
    const cacheKey = buildMetricCacheKey(
      'comparison',
      this.resolveQueryScope(query),
      this.buildPeriodKey(query),
      compareWith,
    );
    return this.cachedQuery(cacheKey, async () => {
      // Resolve current window từ query (tái dùng buildDateFilter + resolvePeriodWindow)
      const currentWindow = this.resolvePeriodWindow(query);
      const curFromDate = new Date(`${currentWindow.from}T00:00:00.000Z`);
      const curToDate = new Date(`${currentWindow.to}T23:59:59.999Z`);

      // Resolve previous window
      const prevRange = resolveCompare(
        {
          fromIso: curFromDate.toISOString(),
          toIso: curToDate.toISOString(),
          periodKey: 'cmp',
        },
        { kind: compareWith },
      );
      if (!prevRange) {
        throw new BadRequestException(
          `compareWith=${compareWith} không hỗ trợ`,
        );
      }
      const prevFrom = prevRange.fromIso.slice(0, 10);
      const prevTo = prevRange.toIso.slice(0, 10);

      // 2 parallel summary aggregates: current + previous
      const [current, previous] = await Promise.all([
        this.computePeriodSummary(
          currentWindow.from,
          currentWindow.to,
          query.tenantId,
          compareWith,
          'current',
        ),
        this.computePeriodSummary(
          prevFrom,
          prevTo,
          query.tenantId,
          compareWith,
          'previous',
        ),
      ]);

      return {
        current,
        previous,
        delta: {
          gmvPct: calcDeltaPercent(current.gmv, previous.gmv),
          netGmvPct: calcDeltaPercent(current.netGmv, previous.netGmv),
          platformFeePct: calcDeltaPercent(
            current.platformFee,
            previous.platformFee,
          ),
          orderCountPct: calcDeltaPercent(
            current.orderCount,
            previous.orderCount,
          ),
        },
      };
    });
  }

  /**
   * F-062 Wave 2B-1 helper — Compute summary metrics cho 1 period range.
   * Tái dùng pattern `_computeOverview` (gross/net/orderCount SQL + FeeService
   * per tenant). Trả về `ComparisonMetricsDto` shape (cộng `label` cho UI).
   */
  private async computePeriodSummary(
    from: string,
    to: string,
    tenantId: number | undefined,
    compareWith: 'wow' | 'mom' | 'yoy',
    side: 'current' | 'previous',
  ): Promise<{
    label: string;
    from: string;
    to: string;
    gmv: number;
    netGmv: number;
    platformFee: number;
    orderCount: number;
  }> {
    const { clause, params } = this.buildDateFilter(from, to);
    const whereClause = clause ? `AND ${clause}` : '';

    let sql: string;
    let sqlParams: any[];
    if (tenantId) {
      sql = `SELECT
        COUNT(CASE WHEN om.order_category != 'MANUAL' THEN 1 END) as order_count,
        COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN om.total_price ELSE 0 END), 0) as gmv,
        COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      WHERE om.financial_status = 'paid' AND r.tenant_id = ? ${whereClause}`;
      sqlParams = [tenantId, ...params];
    } else {
      sql = `SELECT
        COUNT(CASE WHEN order_category != 'MANUAL' THEN 1 END) as order_count,
        COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) as gmv,
        COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN GREATEST(total_price - IFNULL(total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
      FROM order_metadata
      WHERE financial_status = 'paid' ${whereClause}`;
      sqlParams = params;
    }

    const [row] = await this.db.query(sql, sqlParams);

    // FeeService aggregate per tenant — BR-SA-02 mandate
    const filter = tenantId ? { tenantId } : undefined;
    const ordersByTenant = await this.pullOrdersForFeeAggregate(
      clause,
      params,
      filter,
    );
    let platformFee = 0;
    for (const [tid, orders] of ordersByTenant) {
      const result = await this.feeService.computeFeeForOrdersAggregate(
        tid,
        orders,
        { from, to },
      );
      platformFee += result.totalFee;
    }

    // Label phụ thuộc compareWith + side
    const label = this.formatComparisonLabel(from, to, compareWith, side);

    return {
      label,
      from: `${from}T00:00:00.000Z`,
      to: `${to}T23:59:59.999Z`,
      gmv: Number(row.gmv),
      netGmv: Number(row.net_gmv),
      platformFee: Math.round(platformFee),
      orderCount: Number(row.order_count),
    };
  }

  /**
   * F-062 BR-SA-04 — UI label tiếng Việt cho period comparison panel.
   * Pattern: mom → "Tháng MM / YYYY", yoy → "Năm YYYY", wow → "Tuần WW / YYYY".
   */
  private formatComparisonLabel(
    from: string,
    _to: string,
    compareWith: 'wow' | 'mom' | 'yoy',
    _side: 'current' | 'previous',
  ): string {
    const d = new Date(`${from}T00:00:00.000Z`);
    if (compareWith === 'mom') {
      return labelForMonthKey(dateToMonthKey(d));
    }
    if (compareWith === 'yoy') {
      return `Năm ${d.getUTCFullYear()}`;
    }
    // wow
    return labelForWeekKey(dateToWeekKey(d));
  }

  async getTopRaces(query: AnalyticsQueryDto) {
    this.validateDateRange(query.from, query.to);
    const limit = Math.min(query.limit ?? 5, 50);
    const cacheKey = `analytics:top-races:${query.month ?? ''}:${query.from ?? ''}:${query.to ?? ''}:${limit}`;
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';

      const rows = await this.db.query(
        `SELECT
          om.race_id,
          r.title as race_name,
          t.name as tenant_name,
          r.tenant_id,
          r.race_type,
          COUNT(CASE WHEN om.order_category != 'MANUAL' THEN 1 END) as order_count,
          COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN om.total_price ELSE 0 END), 0) as gross_gmv,
          COALESCE(SUM(CASE WHEN om.order_category != 'MANUAL' THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        JOIN tenant t ON t.id = r.tenant_id
        WHERE om.financial_status = 'paid' ${whereClause}
        GROUP BY om.race_id, r.title, t.name, r.tenant_id, r.race_type
        ORDER BY gross_gmv DESC
        LIMIT ?`,
        [...params, limit],
      );

      // F-058 — per-race fee via FeeService Tier 0 cascade. Pull orders cho
      // tất cả race trong top list, group by (tenant, race) → call FeeService.
      const periodWindow = this.resolvePeriodWindow(query);
      const raceIds = rows.map((r: any) => Number(r.race_id));

      // Per-tenant aggregate map: tenantId → tenantOrders[]
      const ordersByTenant = raceIds.length > 0
        ? await this.pullOrdersForFeeAggregate(clause, params)
        : new Map<number, OrderForFeeAggregate[]>();

      // Per-race fee map: raceId → platformFee
      const feeByRace = new Map<number, number>();
      for (const [tenantId, orders] of ordersByTenant) {
        // Filter orders thuộc raceIds tránh tính fee thừa
        const scoped = orders.filter((o) => raceIds.includes(o.raceId));
        if (scoped.length === 0) continue;
        // Re-attribute per race: run aggregate per race ID. Outer-tenant
        // aggregate was wasted work — only per-race totals are surfaced
        // in the TopRaces response (each row has its own platformFee).
        for (const raceId of raceIds) {
          const raceOrders = scoped.filter((o) => o.raceId === raceId);
          if (raceOrders.length === 0) continue;
          const subResult = await this.feeService.computeFeeForOrdersAggregate(
            tenantId,
            raceOrders,
            { from: periodWindow.from, to: periodWindow.to },
          );
          feeByRace.set(raceId, subResult.totalFee);
        }
      }

      return rows.map((r: any) => {
        const raceId = Number(r.race_id);
        const netGmv = Number(r.net_gmv);
        return {
          raceId,
          raceName: r.race_name,
          tenantName: r.tenant_name,
          raceType: r.race_type,
          orderCount: Number(r.order_count),
          grossGmv: Number(r.gross_gmv),
          netGmv,
          platformFee: feeByRace.get(raceId) ?? 0,
        };
      });
    });
  }

  async getRevenueByCategory(query: AnalyticsQueryDto) {
    this.validateDateRange(query.from, query.to);
    const cacheKey = `analytics:rev-by-cat:${query.month ?? ''}:${query.from ?? ''}:${query.to ?? ''}`;
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';

      const rows = await this.db.query(
        `SELECT
          order_category,
          COUNT(*) as order_count,
          COALESCE(SUM(total_price), 0) as gross_gmv,
          COALESCE(SUM(GREATEST(total_price - IFNULL(total_discounts, 0), 0)), 0) as net_gmv
        FROM order_metadata
        WHERE financial_status = 'paid' ${whereClause}
        GROUP BY order_category
        ORDER BY gross_gmv DESC`,
        params,
      );

      const totalGmv = rows.reduce(
        (sum: number, r: any) => sum + Number(r.gross_gmv),
        0,
      );

      return rows.map((r: any) => ({
        category: r.order_category,
        orderCount: Number(r.order_count),
        grossGmv: Number(r.gross_gmv),
        netGmv: Number(r.net_gmv),
        pct:
          totalGmv > 0
            ? Math.round((Number(r.gross_gmv) / totalGmv) * 10000) / 100
            : 0,
      }));
    });
  }

  async getRacePerformance(query: AnalyticsQueryDto) {
    this.validateDateRange(query.from, query.to);

    const { clause, params } = this.buildDateFilter(
      query.from,
      query.to,
      query.month,
    );
    const dateWhere = clause ? `AND ${clause}` : '';
    const page = Math.max(query.page ?? 0, 0);
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = page * limit;

    const extraConditions: string[] = [];
    const extraParams: any[] = [];

    if (query.tenantId) {
      extraConditions.push('r.tenant_id = ?');
      extraParams.push(query.tenantId);
    }
    if (query.raceType) {
      extraConditions.push('r.race_type = ?');
      extraParams.push(query.raceType);
    }
    if (query.status) {
      extraConditions.push('r.status = ?');
      extraParams.push(query.status);
    }

    const extraWhere =
      extraConditions.length > 0
        ? `AND ${extraConditions.join(' AND ')}`
        : '';

    const allowedSorts: Record<string, string> = {
      grossGmv: 'gross_gmv',
      paidOrders: 'paid_orders',
      eventStartDate: 'r.event_start_date',
      voidedRate: 'voided_orders',
    };
    const sortField =
      query.sortBy && allowedSorts[query.sortBy]
        ? allowedSorts[query.sortBy]
        : 'gross_gmv';
    const sortDir =
      query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const rows = await this.db.query(
      `SELECT
        om.race_id,
        r.title as race_name,
        t.name as tenant_name,
        r.tenant_id,
        r.race_type,
        r.status as race_status,
        r.event_start_date,
        COUNT(CASE WHEN om.financial_status = 'paid' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN om.financial_status = 'voided' THEN 1 END) as voided_orders,
        COUNT(DISTINCT CASE WHEN om.financial_status = 'paid' THEN om.user_id END) as unique_runners,
        COALESCE(SUM(CASE WHEN om.financial_status = 'paid' THEN om.total_price ELSE 0 END), 0) as gross_gmv,
        COALESCE(SUM(CASE WHEN om.financial_status = 'paid'
          THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      JOIN tenant t ON t.id = r.tenant_id
      WHERE r.is_delete = 0 ${dateWhere} ${extraWhere}
      GROUP BY om.race_id, r.title, t.name, r.tenant_id, r.race_type, r.status, r.event_start_date
      HAVING paid_orders > 0
      ORDER BY ${sortField} ${sortDir}
      LIMIT ? OFFSET ?`,
      [...params, ...extraParams, limit, offset],
    );

    const countRows = await this.db.query(
      `SELECT COUNT(DISTINCT om.race_id) as total
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      JOIN tenant t ON t.id = r.tenant_id
      WHERE r.is_delete = 0 ${dateWhere} ${extraWhere}`,
      [...params, ...extraParams],
    );
    const total = Number(countRows[0]?.total ?? 0);

    // F-058 — per-race fee via FeeService Tier 0 cascade
    const periodWindow = this.resolvePeriodWindow(query);
    const raceIds = rows.map((r: any) => Number(r.race_id));
    const ordersByTenant = raceIds.length > 0
      ? await this.pullOrdersForFeeAggregate(clause, params)
      : new Map<number, OrderForFeeAggregate[]>();
    const feeByRace = new Map<number, number>();
    for (const [tenantId, orders] of ordersByTenant) {
      for (const raceId of raceIds) {
        const raceOrders = orders.filter((o) => o.raceId === raceId);
        if (raceOrders.length === 0) continue;
        const result = await this.feeService.computeFeeForOrdersAggregate(
          tenantId,
          raceOrders,
          { from: periodWindow.from, to: periodWindow.to },
        );
        feeByRace.set(raceId, result.totalFee);
      }
    }

    const data = rows.map((r: any) => {
      const paidOrders = Number(r.paid_orders);
      const voidedOrders = Number(r.voided_orders);
      const totalRow = paidOrders + voidedOrders;
      const netGmv = Number(r.net_gmv);
      const grossGmv = Number(r.gross_gmv);
      const raceId = Number(r.race_id);

      return {
        raceId,
        raceName: r.race_name,
        tenantName: r.tenant_name,
        tenantId: Number(r.tenant_id),
        raceType: r.race_type,
        raceStatus: r.race_status,
        eventStartDate: r.event_start_date,
        paidOrders,
        voidedOrders,
        uniqueRunners: Number(r.unique_runners),
        grossGmv,
        netGmv,
        platformFee: feeByRace.get(raceId) ?? 0,
        avgOrderValue: paidOrders > 0 ? Math.round(grossGmv / paidOrders) : 0,
        voidedRate:
          totalRow > 0 ? Math.round((voidedOrders / totalRow) * 10000) / 100 : 0,
      };
    });

    return { data, total, page, limit };
  }

  async getRaceDetail(raceId: number, query: AnalyticsQueryDto) {
    this.validateDateRange(query.from, query.to);

    const { clause, params } = this.buildDateFilter(
      query.from,
      query.to,
      query.month,
    );
    const whereClause = clause ? `AND ${clause}` : '';

    const [summary] = await this.db.query(
      `SELECT
        om.race_id,
        r.title as race_name,
        t.name as tenant_name,
        r.tenant_id,
        r.race_type,
        r.status as race_status,
        r.event_start_date,
        r.event_end_date,
        r.registration_start_time,
        r.registration_end_time,
        COUNT(CASE WHEN om.financial_status = 'paid' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN om.financial_status = 'voided' THEN 1 END) as voided_orders,
        COUNT(DISTINCT CASE WHEN om.financial_status = 'paid' THEN om.user_id END) as unique_runners,
        COALESCE(SUM(CASE WHEN om.financial_status = 'paid' THEN om.total_price ELSE 0 END), 0) as gross_gmv,
        COALESCE(SUM(CASE WHEN om.financial_status = 'paid'
          THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      JOIN tenant t ON t.id = r.tenant_id
      WHERE om.race_id = ? ${whereClause}
      GROUP BY om.race_id, r.title, t.name, r.tenant_id, r.race_type, r.status,
               r.event_start_date, r.event_end_date, r.registration_start_time, r.registration_end_time`,
      [raceId, ...params],
    );

    if (!summary) {
      return {
        raceId,
        raceName: null,
        paidOrders: 0,
        voidedOrders: 0,
        uniqueRunners: 0,
        grossGmv: 0,
        netGmv: 0,
        platformFee: 0,
        categoryBreakdown: [],
        dailyRevenue: [],
        ticketBreakdown: [],
      };
    }

    const [categoryRows, dailyRows, ticketRows] = await Promise.all([
      this.db.query(
        `SELECT
          order_category,
          COUNT(*) as order_count,
          COALESCE(SUM(total_price), 0) as gmv
        FROM order_metadata
        WHERE race_id = ? AND financial_status = 'paid' ${whereClause}
        GROUP BY order_category`,
        [raceId, ...params],
      ),
      this.db.query(
        `SELECT
          DATE(payment_on) as date,
          COUNT(*) as order_count,
          COALESCE(SUM(total_price), 0) as gmv
        FROM order_metadata
        WHERE race_id = ? AND financial_status = 'paid' ${whereClause}
        GROUP BY DATE(payment_on)
        ORDER BY date ASC`,
        [raceId, ...params],
      ),
      this.db.query(
        `SELECT
          oli.ticket_type_id,
          SUM(oli.quantity) as ticket_count,
          COALESCE(SUM(oli.quantity * oli.price), 0) as gmv
        FROM order_line_item oli
        JOIN order_metadata om ON om.id = oli.order_id
        WHERE om.race_id = ? AND om.financial_status = 'paid' ${whereClause}
        GROUP BY oli.ticket_type_id`,
        [raceId, ...params],
      ),
    ]);

    // F-058 — Tier 0 cascade fee via FeeService for this specific race
    const tenantId = Number(summary.tenant_id);
    const netGmv = Number(summary.net_gmv);
    const periodWindow = this.resolvePeriodWindow(query);
    const ordersByTenant = await this.pullOrdersForFeeAggregate(
      clause,
      params,
      { tenantId, raceId },
    );
    const orders = ordersByTenant.get(tenantId) ?? [];
    const feeResult = await this.feeService.computeFeeForOrdersAggregate(
      tenantId,
      orders,
      { from: periodWindow.from, to: periodWindow.to },
    );

    // Compute effective rate for legacy `feeRate` field
    // (best-effort: derive from result; fallback to MerchantConfig.service_fee_rate)
    const config = await this.configModel.findOne({ tenantId }).lean().exec();
    const fallbackRate = config?.service_fee_rate ?? 5.5;
    // If only 1 source detected → use that source's effective rate; else fall back
    const effectiveRate =
      feeResult.appliedOverrides.find((o) => o.field === 'service_fee_rate')?.value ??
      fallbackRate;

    return {
      raceId: Number(summary.race_id),
      raceName: summary.race_name,
      tenantName: summary.tenant_name,
      tenantId,
      raceType: summary.race_type,
      raceStatus: summary.race_status,
      eventStartDate: summary.event_start_date,
      eventEndDate: summary.event_end_date,
      registrationStartTime: summary.registration_start_time,
      registrationEndTime: summary.registration_end_time,
      paidOrders: Number(summary.paid_orders),
      voidedOrders: Number(summary.voided_orders),
      uniqueRunners: Number(summary.unique_runners),
      grossGmv: Number(summary.gross_gmv),
      netGmv,
      platformFee: feeResult.totalFee,
      feeRate: effectiveRate,
      categoryBreakdown: categoryRows.map((r: any) => ({
        category: r.order_category,
        orderCount: Number(r.order_count),
        gmv: Number(r.gmv),
      })),
      dailyRevenue: dailyRows.map((r: any) => ({
        date:
          r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
        orderCount: Number(r.order_count),
        gmv: Number(r.gmv),
      })),
      ticketBreakdown: ticketRows.map((r: any) => ({
        ticketTypeId: Number(r.ticket_type_id),
        ticketCount: Number(r.ticket_count),
        gmv: Number(r.gmv),
      })),
    };
  }

  async getMerchantComparison(query: AnalyticsQueryDto) {
    this.validateDateRange(query.from, query.to);
    const cacheKey = `analytics:merchants:${query.month ?? ''}:${query.from ?? ''}:${query.to ?? ''}:${query.sortBy ?? ''}:${query.sortOrder ?? ''}`;
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';

      const allowedSorts: Record<string, string> = {
        grossGmv: 'gross_gmv',
        paidOrders: 'paid_orders',
        raceCount: 'race_count',
      };
      const sortField =
        query.sortBy && allowedSorts[query.sortBy]
          ? allowedSorts[query.sortBy]
          : 'gross_gmv';
      const sortDir =
        query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const rows = await this.db.query(
        `SELECT
          r.tenant_id,
          t.name as merchant_name,
          COUNT(DISTINCT om.race_id) as race_count,
          COUNT(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL' THEN 1 END) as paid_orders,
          COUNT(CASE WHEN om.financial_status = 'voided' THEN 1 END) as voided_orders,
          COALESCE(SUM(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL' THEN om.total_price ELSE 0 END), 0) as gross_gmv,
          COALESCE(SUM(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL'
            THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv,
          COUNT(CASE WHEN om.financial_status = 'paid' AND om.order_category = 'MANUAL'
            THEN 1 END) as manual_orders,
          MAX(CASE WHEN om.financial_status = 'paid' THEN om.payment_on END) as last_order_date
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        JOIN tenant t ON t.id = r.tenant_id
        WHERE 1=1 ${whereClause}
        GROUP BY r.tenant_id, t.name
        ORDER BY ${sortField} ${sortDir}`,
        params,
      );

      // F-058 — per-tenant fee via FeeService Tier 0 cascade
      const periodWindow = this.resolvePeriodWindow(query);
      const ordersByTenant = await this.pullOrdersForFeeAggregate(clause, params);
      const feeByTenant = new Map<number, { totalFee: number; rate: number }>();
      // Per-tenant MerchantConfig lookup cho `feeRate` display field (default rate)
      const tenantIds = rows.map((r: any) => Number(r.tenant_id));
      const configs = await this.configModel
        .find({ tenantId: { $in: tenantIds } })
        .lean()
        .exec();
      const configMap = new Map<number, { rate: number }>();
      for (const c of configs) {
        configMap.set(c.tenantId, { rate: c.service_fee_rate ?? 5.5 });
      }

      for (const [tenantId, orders] of ordersByTenant) {
        const result = await this.feeService.computeFeeForOrdersAggregate(
          tenantId,
          orders,
          { from: periodWindow.from, to: periodWindow.to },
        );
        feeByTenant.set(tenantId, {
          totalFee: result.totalFee,
          rate: configMap.get(tenantId)?.rate ?? 5.5,
        });
      }

      return rows.map((r: any) => {
        const tenantId = Number(r.tenant_id);
        const paidOrders = Number(r.paid_orders);
        const voidedOrders = Number(r.voided_orders);
        const totalRow = paidOrders + voidedOrders;
        const grossGmv = Number(r.gross_gmv);
        const netGmv = Number(r.net_gmv);
        const manualOrders = Number(r.manual_orders);
        const feeEntry = feeByTenant.get(tenantId);

        return {
          tenantId,
          merchantName: r.merchant_name,
          feeRate: feeEntry?.rate ?? configMap.get(tenantId)?.rate ?? 5.5,
          raceCount: Number(r.race_count),
          paidOrders,
          voidedOrders,
          grossGmv,
          netGmv,
          platformFee: feeEntry?.totalFee ?? 0,
          manualOrders,
          manualOrderPct:
            paidOrders > 0
              ? Math.round((manualOrders / paidOrders) * 10000) / 100
              : 0,
          avgOrderValue: paidOrders > 0 ? Math.round(grossGmv / paidOrders) : 0,
          voidedRate:
            totalRow > 0 ? Math.round((voidedOrders / totalRow) * 10000) / 100 : 0,
          lastOrderDate: r.last_order_date,
        };
      });
    });
  }

  async getRunnerBehavior(query: AnalyticsQueryDto) {
    this.validateDateRange(query.from, query.to);
    const cacheKey = `analytics:runner-behavior:${query.from ?? ''}:${query.to ?? ''}:${query.month ?? ''}:${query.tenantId ?? ''}`;
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';

      const tenantFilterJoin = query.tenantId
        ? 'JOIN races r ON r.race_id = om.race_id'
        : '';
      const tenantFilterWhere = query.tenantId
        ? `AND r.tenant_id = ${Number(query.tenantId)}`
        : '';

      // Repeat rate (global, not date-filtered)
      const [repeatRow] = await this.db.query(
        `SELECT
          COUNT(DISTINCT user_id) as total_runners,
          SUM(CASE WHEN race_count >= 2 THEN 1 ELSE 0 END) as repeat_runners
        FROM (
          SELECT user_id, COUNT(DISTINCT race_id) as race_count
          FROM order_metadata
          WHERE financial_status = 'paid' AND user_id IS NOT NULL
          GROUP BY user_id
        ) sub`,
      );

      // Avg booking lead time
      const [leadRow] = await this.db.query(
        `SELECT AVG(DATEDIFF(r2.event_start_date, om.payment_on)) as avg_lead_days
        FROM order_metadata om
        JOIN races r2 ON r2.race_id = om.race_id
        WHERE om.financial_status = 'paid'
          AND DATEDIFF(r2.event_start_date, om.payment_on) > 0
          ${whereClause} ${tenantFilterWhere}`,
        params,
      );

      // Peak by hour
      const hourRows = await this.db.query(
        `SELECT HOUR(om.payment_on) as hour, COUNT(*) as order_count
        FROM order_metadata om
        ${tenantFilterJoin}
        WHERE om.financial_status = 'paid' ${whereClause} ${tenantFilterWhere}
        GROUP BY HOUR(om.payment_on)
        ORDER BY hour ASC`,
        params,
      );

      // Peak by day of week
      const dowRows = await this.db.query(
        `SELECT DAYOFWEEK(om.payment_on) as dow, COUNT(*) as order_count
        FROM order_metadata om
        ${tenantFilterJoin}
        WHERE om.financial_status = 'paid' ${whereClause} ${tenantFilterWhere}
        GROUP BY DAYOFWEEK(om.payment_on)
        ORDER BY dow ASC`,
        params,
      );

      // Category mix
      const categoryRows = await this.db.query(
        `SELECT om.order_category, COUNT(*) as cnt
        FROM order_metadata om
        ${tenantFilterJoin}
        WHERE om.financial_status = 'paid' ${whereClause} ${tenantFilterWhere}
        GROUP BY om.order_category`,
        params,
      );

      const totalRunners = Number(repeatRow.total_runners);
      const repeatRunners = Number(repeatRow.repeat_runners);

      const peakHourRow =
        hourRows.length > 0
          ? hourRows.reduce(
              (best: any, r: any) =>
                Number(r.order_count) > Number(best.order_count) ? r : best,
              hourRows[0],
            )
          : null;

      return {
        totalRunners,
        repeatRunners,
        repeatRunnerRate:
          totalRunners > 0
            ? Math.round((repeatRunners / totalRunners) * 10000) / 100
            : 0,
        avgLeadTimeDays:
          leadRow.avg_lead_days != null
            ? Math.round(Number(leadRow.avg_lead_days) * 10) / 10
            : null,
        peakBookingHour: peakHourRow ? Number(peakHourRow.hour) : null,
        peakByHour: hourRows.map((r: any) => ({
          hour: Number(r.hour),
          orderCount: Number(r.order_count),
        })),
        peakByDow: dowRows.map((r: any) => ({
          dow: Number(r.dow),
          orderCount: Number(r.order_count),
        })),
        categoryMix: categoryRows.map((r: any) => ({
          category: r.order_category,
          count: Number(r.cnt),
        })),
      };
    });
  }

  async getBookingPatterns(query: AnalyticsQueryDto) {
    this.validateDateRange(query.from, query.to);
    const cacheKey = `analytics:booking-patterns:${query.from ?? ''}:${query.to ?? ''}:${query.month ?? ''}:${query.tenantId ?? ''}`;
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';

      const tenantFilterJoin = query.tenantId
        ? 'JOIN races r ON r.race_id = om.race_id'
        : '';
      const tenantFilterWhere = query.tenantId
        ? `AND r.tenant_id = ${Number(query.tenantId)}`
        : '';

      const rows = await this.db.query(
        `SELECT
          DAYOFWEEK(om.payment_on) as dow,
          HOUR(om.payment_on) as hour,
          COUNT(*) as order_count
        FROM order_metadata om
        ${tenantFilterJoin}
        WHERE om.financial_status = 'paid' ${whereClause} ${tenantFilterWhere}
        GROUP BY DAYOFWEEK(om.payment_on), HOUR(om.payment_on)`,
        params,
      );

      // Build 7×24 matrix [dow 0-6 (0=Sunday)][hour 0-23]
      const matrix: number[][] = Array.from({ length: 7 }, () =>
        new Array(24).fill(0),
      );
      for (const r of rows) {
        const dow = Number(r.dow) - 1; // MySQL DAYOFWEEK: 1=Sunday → 0-indexed
        const hour = Number(r.hour);
        if (dow >= 0 && dow < 7 && hour >= 0 && hour < 24) {
          matrix[dow][hour] = Number(r.order_count);
        }
      }

      return { matrix };
    });
  }

  async getFunnel(query: AnalyticsQueryDto) {
    this.validateDateRange(query.from, query.to);
    const cacheKey = `analytics:funnel:${query.from ?? ''}:${query.to ?? ''}:${query.month ?? ''}:${query.tenantId ?? ''}:${query.raceId ?? ''}`;
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const dateWhere = clause ? `AND ${clause}` : '';

      const extraConditions: string[] = [];
      const extraParams: any[] = [];

      if (query.raceId) {
        extraConditions.push('om.race_id = ?');
        extraParams.push(query.raceId);
      }
      if (query.tenantId) {
        extraConditions.push('r.tenant_id = ?');
        extraParams.push(query.tenantId);
      }

      const needsJoin = query.tenantId != null || query.raceId != null;
      const joinClause = needsJoin
        ? 'JOIN races r ON r.race_id = om.race_id'
        : '';
      const extraWhere =
        extraConditions.length > 0
          ? `AND ${extraConditions.join(' AND ')}`
          : '';

      const rows = await this.db.query(
        `SELECT
          om.financial_status,
          om.order_category,
          COUNT(*) as count,
          AVG(CASE WHEN om.financial_status = 'paid'
            THEN TIMESTAMPDIFF(MINUTE, om.processed_on, om.payment_on) END) as avg_minutes_to_pay
        FROM order_metadata om
        ${joinClause}
        WHERE 1=1 ${dateWhere} ${extraWhere}
        GROUP BY om.financial_status, om.order_category`,
        [...params, ...extraParams],
      );

      let paidOrders = 0;
      let voidedOrders = 0;
      let weightedMinutes = 0;
      let paidCount = 0;

      for (const r of rows) {
        const cnt = Number(r.count);
        if (r.financial_status === 'paid') {
          paidOrders += cnt;
          if (r.avg_minutes_to_pay != null) {
            weightedMinutes += Number(r.avg_minutes_to_pay) * cnt;
            paidCount += cnt;
          }
        }
        if (r.financial_status === 'voided') voidedOrders += cnt;
      }

      const total = paidOrders + voidedOrders;
      const avgTimeToPay =
        paidCount > 0
          ? Math.round((weightedMinutes / paidCount) * 10) / 10
          : null;

      return {
        paidOrders,
        voidedOrders,
        conversionRate:
          total > 0 ? Math.round((paidOrders / total) * 10000) / 100 : 0,
        voidRate:
          total > 0 ? Math.round((voidedOrders / total) * 10000) / 100 : 0,
        avgTimeToPay,
        breakdownByCategory: rows.map((r: any) => ({
          financialStatus: r.financial_status,
          orderCategory: r.order_category,
          count: Number(r.count),
          avgMinutesToPay:
            r.avg_minutes_to_pay != null
              ? Math.round(Number(r.avg_minutes_to_pay) * 10) / 10
              : null,
        })),
      };
    });
  }

  // ────────────────────────────────────────────────────────────────────
  // F-058 — Discrepancy check endpoint (BR-58-08)
  // ────────────────────────────────────────────────────────────────────

  /**
   * F-058 BR-58-08/09/17 — Compare Analytics aggregate vs Reconciliation totals
   * for finance team ad-hoc reconcile. Read-only, no cache, idempotent.
   *
   * Verdict thresholds (BR-58-09):
   *   - MATCH        : abs(delta) <= 1000 VND OR abs(pct) <= 0.1%
   *   - MINOR_DRIFT  : pct between 0.1% and 1%
   *   - MAJOR_DRIFT  : pct >= 1% (suspect bug)
   *   - NO_RECONCILIATION : no reconciliation doc tháng đó
   */
  async getDiscrepancyCheck(
    query: DiscrepancyCheckQueryDto,
  ): Promise<DiscrepancyCheckResponseDto> {
    const { tenantId, month } = query;
    const periodWindow = this.resolvePeriodWindow({ month } as AnalyticsQueryDto);

    // 1. Analytics aggregate via FeeService Tier 0 cascade
    const { clause, params } = this.buildDateFilter(undefined, undefined, month);
    const ordersByTenant = await this.pullOrdersForFeeAggregate(
      clause,
      params,
      { tenantId },
    );
    const orders = ordersByTenant.get(tenantId) ?? [];
    const analyticsResult = await this.feeService.computeFeeForOrdersAggregate(
      tenantId,
      orders,
      { from: periodWindow.from, to: periodWindow.to },
    );

    // 2. Reconciliation totals
    const reconTotals = await this.reconciliationService.getTotalsByTenantMonth(
      tenantId,
      month,
    );

    // 3. Compute delta + verdict
    const THRESHOLD_ABS_VND = 1000;
    const THRESHOLD_PCT = 0.1;

    let delta: { absVnd: number; pctOfReconciliation: number | null } | null = null;
    let verdict: DiscrepancyVerdict;

    if (reconTotals.reconCount === 0) {
      verdict = 'NO_RECONCILIATION';
    } else {
      const absVnd = analyticsResult.totalFee - reconTotals.totalFee;
      const pct =
        reconTotals.totalFee > 0
          ? Math.round((Math.abs(absVnd) / reconTotals.totalFee) * 10000) / 100
          : null;
      delta = {
        absVnd,
        pctOfReconciliation:
          pct != null
            ? // preserve sign for direction
              absVnd < 0
              ? -pct
              : pct
            : null,
      };
      const absPct = pct ?? 0;
      if (Math.abs(absVnd) <= THRESHOLD_ABS_VND || absPct <= THRESHOLD_PCT) {
        verdict = 'MATCH';
      } else if (absPct < 1) {
        verdict = 'MINOR_DRIFT';
      } else {
        verdict = 'MAJOR_DRIFT';
      }
    }

    return {
      tenantId,
      month,
      analyticsAggregate: {
        totalServiceFee: analyticsResult.totalServiceFee,
        totalManualFee: analyticsResult.totalManualFee,
        totalVat: analyticsResult.totalVat,
        totalFee: analyticsResult.totalFee,
      },
      reconciliationAggregate: {
        totalServiceFee: reconTotals.totalServiceFee,
        totalManualFee: reconTotals.totalManualFee,
        totalVat: reconTotals.totalVat,
        totalFee: reconTotals.totalFee,
        totalNetGmv: reconTotals.totalNetGmv,
        reconCount: reconTotals.reconCount,
        reconciliationIds: reconTotals.reconciliationIds,
      },
      delta,
      verdict,
      thresholdAbsVnd: THRESHOLD_ABS_VND,
      thresholdPct: THRESHOLD_PCT,
    };
  }
}
