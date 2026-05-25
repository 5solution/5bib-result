import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../../merchant/schemas/merchant-config.schema';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { FeeService } from '../../finance/services/fee.service';
import type { OrderForFeeAggregate } from '../../finance/dto/fee-aggregate.dto';
import {
  buildMetricCacheKey,
  resolveScopeFromTenant,
  periodKeyFromInputs,
} from './period-resolver';
import type { MerchantScatterPointDto } from '../dto/merchant-scatter.dto';
import type { MerchantHealthDistributionTierDto } from '../dto/merchant-health-distribution.dto';
import type {
  MerchantComparisonItemDto,
  MerchantComparisonResponseDto,
} from '../dto/merchant-comparison-table.dto';

/**
 * F-062 Wave 2B-2 NEW SERVICE — Merchant comparison analytics (BR-SA-22 v3).
 *
 * 3 public endpoints (BR-SA-22 a/b/c):
 *   - getScatter() — BR-SA-22a: orders × gmv bubble per merchant
 *   - getHealthDistribution() — BR-SA-22b: 5-tier histogram
 *   - getComparisonTable() — BR-SA-22c: 10-col table với totals footer
 *
 * Shared internal `_buildMerchantAggregates()` does SQL aggregation +
 * FeeService Tier 0 cascade + Health Score RFM calc + status classification.
 * Mỗi public method PROJECTS this base to different response shape, separate
 * cache keys per BR-SA-22 a/b/c spec.
 *
 * Convention compliance:
 *   - Phí 5BIB dùng FeeService.computeFeeForOrdersAggregate (BR-SA-22c mandate)
 *   - Cache keys via buildMetricCacheKey helper (Wave 2B-1 v2 lesson APPLIED)
 *   - Default period 12 tháng (matches BR-SA-03 monthly default pattern)
 *
 * TTL convention: cachedQuery auto-detect current month → 900s, historical → 86400s.
 */
const TTL_CURRENT = 900;
const TTL_HISTORY = 86400;
const MAX_DATE_RANGE_DAYS = 366;

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── BR-SA-07 Health Score RFM constants ───────────────────────────────────

const HEALTH_TIERS: ReadonlyArray<{
  tier: MerchantHealthDistributionTierDto['tier'];
  label: string;
  min: number;
  max: number;
  color: string;
}> = [
  { tier: 'EXCELLENT', label: 'Xuất sắc', min: 80, max: 100, color: 'green-600' },
  { tier: 'GOOD', label: 'Tốt', min: 60, max: 79, color: 'blue-600' },
  { tier: 'AVERAGE', label: 'Trung bình', min: 40, max: 59, color: 'amber-500' },
  { tier: 'WEAK', label: 'Yếu', min: 20, max: 39, color: 'orange-500' },
  { tier: 'AT_RISK_SCORE', label: 'Nguy cơ', min: 0, max: 19, color: 'red-500' },
];

const HEALTH_WEIGHTS = { recency: 0.4, frequency: 0.3, monetary: 0.3 };

/** Internal merchant aggregate — base shape projected to 3 endpoint DTOs. */
interface MerchantAggregate {
  tenantId: number;
  tenantName: string;
  feeRate: number;
  races: number;
  orders: number;
  gmv: number;
  netGmv: number;
  fee: number;
  manualOrders: number;
  voidedOrders: number;
  lastOrderDate: Date | null;
  tenantCreatedOn: Date | null;
  gmv90d: number;
  orders90d: number;
  healthScore: number;
  status: 'ACTIVE' | 'AT_RISK' | 'CHURNED' | 'NEW';
}

@Injectable()
export class MerchantComparisonService {
  private readonly logger = new Logger(MerchantComparisonService.name);

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectModel(MerchantConfig.name)
    private readonly configModel: Model<MerchantConfigDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly feeService: FeeService,
  ) {}

  // ─── Helpers (shared cache wrapper + range filter) ─────────────────────────

  private async cachedQuery<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const ttl = key.includes(currentMonthStr()) ? TTL_CURRENT : TTL_HISTORY;
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch (e) {
      this.logger.warn(`Redis get failed for key ${key}: ${e}`);
    }
    const result = await fn();
    try {
      await this.redis.set(key, JSON.stringify(result), 'EX', ttl);
    } catch (e) {
      this.logger.warn(`Redis set failed for key ${key}: ${e}`);
    }
    return result;
  }

  private validateDateRange(from?: string, to?: string): void {
    if (from && to) {
      const diffDays =
        (new Date(to).getTime() - new Date(from).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diffDays > MAX_DATE_RANGE_DAYS) {
        throw new Error(
          `Date range must not exceed ${MAX_DATE_RANGE_DAYS} days`,
        );
      }
    }
  }

  /**
   * F-062 Wave 2B-2 — default 12 tháng gần nhất nếu không truyền from/to/month.
   * Pattern mirrors Wave 2B-1 v2 `applyDefaultPeriod('month')`. Returns NEW query
   * object (no mutation). Match BR-SA-03 monthly default — merchant comparison
   * naturally fits monthly window (race lifecycle ~weeks-months, not days).
   */
  private applyDefaultPeriod(query: AnalyticsQueryDto): AnalyticsQueryDto {
    if (query.from || query.to || query.month) return query;
    const today = new Date();
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 365);
    const ymdUtc = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return { ...query, from: ymdUtc(from), to: ymdUtc(today) };
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

  private resolvePeriodWindow(query: AnalyticsQueryDto): {
    from: string;
    to: string;
  } {
    if (query.month) {
      const [year, mon] = query.month.split('-').map(Number);
      const start = `${year}-${String(mon).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
      const end = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from: start, to: end };
    }
    return {
      from: query.from ?? '1970-01-01',
      to: query.to ?? new Date().toISOString().slice(0, 10),
    };
  }

  // ─── BR-SA-07 Health Score classification ──────────────────────────────────

  /**
   * Compute Health Score (0-100) per BR-SA-07 RFM formula.
   *   recency = 100/75/50/25/0 based on days since last order
   *   frequency = min(100, totalOrders90d × 10)
   *   monetary = min(100, gmv90d / 10M × 100)
   *   score = 0.4×r + 0.3×f + 0.3×m
   */
  private computeHealthScore(
    lastOrderDate: Date | null,
    orders90d: number,
    gmv90d: number,
  ): number {
    const recency = (() => {
      if (!lastOrderDate) return 0;
      const days =
        (Date.now() - new Date(lastOrderDate).getTime()) /
        (1000 * 60 * 60 * 24);
      if (days <= 7) return 100;
      if (days <= 14) return 75;
      if (days <= 30) return 50;
      if (days <= 60) return 25;
      return 0;
    })();
    const frequency = Math.min(100, orders90d * 10);
    const monetary = Math.min(100, (gmv90d / 10_000_000) * 100);
    const score =
      HEALTH_WEIGHTS.recency * recency +
      HEALTH_WEIGHTS.frequency * frequency +
      HEALTH_WEIGHTS.monetary * monetary;
    return Math.round(score);
  }

  /**
   * Status classification per BR-SA-07 lines 248-252:
   *   NEW: tenant created within 30d AND no orders
   *   ACTIVE: order trong 30d
   *   AT_RISK: no order 30d, có order 60d
   *   CHURNED: no order 90d
   */
  private classifyStatus(
    lastOrderDate: Date | null,
    tenantCreatedOn: Date | null,
    totalOrders: number,
  ): 'ACTIVE' | 'AT_RISK' | 'CHURNED' | 'NEW' {
    const now = Date.now();
    const tenantAgeDays = tenantCreatedOn
      ? (now - new Date(tenantCreatedOn).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    if (totalOrders === 0 && tenantAgeDays <= 30) return 'NEW';
    if (!lastOrderDate) return 'CHURNED';
    const lastOrderDays =
      (now - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24);
    if (lastOrderDays <= 30) return 'ACTIVE';
    if (lastOrderDays <= 60) return 'AT_RISK';
    return 'CHURNED';
  }

  /**
   * Pull merchant aggregates trong period — base data cho 3 public endpoints.
   * 1 SQL aggregate over (tenant_id, t.name, t.created_on) + 90d sliding-window
   * subquery cho Health Score RFM input.
   * Then FeeService Tier 0 cascade per tenant + MerchantConfig lookup cho feeRate.
   */
  private async _buildMerchantAggregates(
    query: AnalyticsQueryDto,
  ): Promise<MerchantAggregate[]> {
    const { clause, params } = this.buildDateFilter(
      query.from,
      query.to,
      query.month,
    );
    const whereClause = clause ? `AND ${clause}` : '';

    // Main period aggregate per merchant
    const rows = await this.db.query(
      `SELECT
        r.tenant_id,
        t.name as tenant_name,
        t.created_on as tenant_created_on,
        COUNT(DISTINCT om.race_id) as race_count,
        COUNT(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN om.financial_status = 'voided' THEN 1 END) as voided_orders,
        COUNT(CASE WHEN om.financial_status = 'paid' AND om.order_category = 'MANUAL' THEN 1 END) as manual_orders,
        COALESCE(SUM(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL' THEN om.total_price ELSE 0 END), 0) as gmv,
        COALESCE(SUM(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL'
          THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv,
        MAX(CASE WHEN om.financial_status = 'paid' THEN om.payment_on END) as last_order_date
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      JOIN tenant t ON t.id = r.tenant_id
      WHERE 1=1 ${whereClause}
      GROUP BY r.tenant_id, t.name, t.created_on
      ORDER BY gmv DESC`,
      params,
    );

    if (rows.length === 0) return [];

    // 90-day sliding window cho Health Score RFM input — fixed regardless of period
    const tenantIds = rows.map((r: any) => Number(r.tenant_id));
    const rfmRows = await this.db.query(
      `SELECT
        r.tenant_id,
        COUNT(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL' THEN 1 END) as orders_90d,
        COALESCE(SUM(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL' THEN om.total_price ELSE 0 END), 0) as gmv_90d
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      WHERE r.tenant_id IN (${tenantIds.map(() => '?').join(',')})
        AND om.payment_on >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY r.tenant_id`,
      tenantIds,
    );
    const rfmByTenant = new Map<number, { orders90d: number; gmv90d: number }>();
    for (const r of rfmRows) {
      rfmByTenant.set(Number(r.tenant_id), {
        orders90d: Number(r.orders_90d),
        gmv90d: Number(r.gmv_90d),
      });
    }

    // FeeService Tier 0 cascade per tenant — period-scoped
    const periodWindow = this.resolvePeriodWindow(query);
    const ordersByTenant = await this.pullOrdersForFeeAggregate(clause, params);
    const feeByTenant = new Map<number, number>();
    for (const [tid, orders] of ordersByTenant) {
      const result = await this.feeService.computeFeeForOrdersAggregate(
        tid,
        orders,
        { from: periodWindow.from, to: periodWindow.to },
      );
      feeByTenant.set(tid, result.totalFee);
    }

    // MerchantConfig feeRate lookup
    const configs = await this.configModel
      .find({ tenantId: { $in: tenantIds } })
      .lean()
      .exec();
    const configMap = new Map<number, number>();
    for (const c of configs) {
      configMap.set(c.tenantId, c.service_fee_rate ?? 5.5);
    }

    return rows.map((r: any) => {
      const tenantId = Number(r.tenant_id);
      const lastOrderDate = r.last_order_date
        ? new Date(r.last_order_date)
        : null;
      const tenantCreatedOn = r.tenant_created_on
        ? new Date(r.tenant_created_on)
        : null;
      const paidOrders = Number(r.paid_orders);
      const voidedOrders = Number(r.voided_orders);
      const rfm = rfmByTenant.get(tenantId) ?? { orders90d: 0, gmv90d: 0 };
      const healthScore = this.computeHealthScore(
        lastOrderDate,
        rfm.orders90d,
        rfm.gmv90d,
      );
      const status = this.classifyStatus(
        lastOrderDate,
        tenantCreatedOn,
        paidOrders + voidedOrders + Number(r.manual_orders),
      );

      return {
        tenantId,
        tenantName: String(r.tenant_name),
        feeRate: configMap.get(tenantId) ?? 5.5,
        races: Number(r.race_count),
        orders: paidOrders,
        gmv: Number(r.gmv),
        netGmv: Number(r.net_gmv),
        fee: Math.round(feeByTenant.get(tenantId) ?? 0),
        manualOrders: Number(r.manual_orders),
        voidedOrders,
        lastOrderDate,
        tenantCreatedOn,
        gmv90d: rfm.gmv90d,
        orders90d: rfm.orders90d,
        healthScore,
        status,
      };
    });
  }

  /**
   * Pull orders raw cho FeeService aggregate — mirror analytics.service.ts
   * pullOrdersForFeeAggregate pattern (not extracted to shared helper because
   * tightly coupled với module-internal OrderForFeeAggregate shape; future
   * refactor TD if 3+ services use identical pattern).
   */
  private async pullOrdersForFeeAggregate(
    clause: string,
    params: any[],
  ): Promise<Map<number, OrderForFeeAggregate[]>> {
    const whereClause = clause ? `AND ${clause}` : '';
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
      WHERE om.financial_status = 'paid' ${whereClause}`,
      params,
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
        createdAt: r.payment_on,
        paymentRef: r.payment_ref ?? null,
        manualTicketCount:
          r.manual_ticket_count != null
            ? Number(r.manual_ticket_count)
            : undefined,
      });
      byTenant.set(tid, arr);
    }
    return byTenant;
  }

  // ─── BR-SA-22a — Scatter ────────────────────────────────────────────────────

  /**
   * BR-SA-22a — Scatter chart data. Mỗi merchant = 1 bubble (x=orders, y=gmv).
   * Cache: `analytics:metric:merchant-comp-scatter:<scope>:<periodKey>` per spec line 563.
   */
  async getScatter(
    query: AnalyticsQueryDto,
  ): Promise<MerchantScatterPointDto[]> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = buildMetricCacheKey(
      'merchant-comp-scatter',
      resolveScopeFromTenant(query.tenantId),
      periodKeyFromInputs(query),
    );
    return this.cachedQuery(cacheKey, async () => {
      const aggregates = await this._buildMerchantAggregates(query);
      return aggregates.map((a) => ({
        tenantId: a.tenantId,
        tenantName: a.tenantName,
        orders: a.orders,
        gmv: a.gmv,
        status: a.status,
      }));
    });
  }

  // ─── BR-SA-22b — Health Distribution ────────────────────────────────────────

  /**
   * BR-SA-22b — Health Score 5-tier distribution.
   * Cache: `analytics:metric:merchant-comp-dist:<scope>:<periodKey>` per spec line 570.
   */
  async getHealthDistribution(
    query: AnalyticsQueryDto,
  ): Promise<MerchantHealthDistributionTierDto[]> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = buildMetricCacheKey(
      'merchant-comp-dist',
      resolveScopeFromTenant(query.tenantId),
      periodKeyFromInputs(query),
    );
    return this.cachedQuery(cacheKey, async () => {
      const aggregates = await this._buildMerchantAggregates(query);
      return HEALTH_TIERS.map((tier) => ({
        ...tier,
        count: aggregates.filter(
          (a) => a.healthScore >= tier.min && a.healthScore <= tier.max,
        ).length,
      }));
    });
  }

  // ─── BR-SA-22c — Comparison Table (Full) ────────────────────────────────────

  /**
   * BR-SA-22c — Full comparison table với totals footer.
   * Cache: `analytics:metric:merchant-comp-table:<scope>:<periodKey>` per spec line 579.
   */
  async getComparisonTable(
    query: AnalyticsQueryDto,
  ): Promise<MerchantComparisonResponseDto> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = buildMetricCacheKey(
      'merchant-comp-table',
      resolveScopeFromTenant(query.tenantId),
      periodKeyFromInputs(query),
    );
    return this.cachedQuery(cacheKey, async () => {
      const aggregates = await this._buildMerchantAggregates(query);
      const data: MerchantComparisonItemDto[] = aggregates.map((a) => {
        const totalRow = a.orders + a.voidedOrders;
        const totalPaid = a.orders + a.manualOrders;
        return {
          tenantId: a.tenantId,
          tenantName: a.tenantName,
          feeRate: a.feeRate,
          races: a.races,
          orders: a.orders,
          gmv: a.gmv,
          fee: a.fee,
          manualPct:
            totalPaid > 0
              ? Math.round((a.manualOrders / totalPaid) * 10000) / 100
              : 0,
          voidedPct:
            totalRow > 0
              ? Math.round((a.voidedOrders / totalRow) * 10000) / 100
              : 0,
          status: a.status,
          healthScore: a.healthScore,
        };
      });

      const totals = data.reduce(
        (acc, row) => ({
          orders: acc.orders + row.orders,
          gmv: acc.gmv + row.gmv,
          fee: acc.fee + row.fee,
        }),
        { orders: 0, gmv: 0, fee: 0 },
      );

      return { data, totals };
    });
  }
}
