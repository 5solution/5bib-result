import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { FeeService } from '../../finance/services/fee.service';
import {
  buildMetricCacheKey,
  resolveScopeFromTenant,
  periodKeyFromInputs,
} from './period-resolver';
import { pullOrdersForFeeAggregate } from './fee-aggregate.helpers';
import type { RaceTypeDistributionPointDto } from '../dto/race-type-distribution.dto';
import type { RaceSpotlightDto } from '../dto/race-spotlight.dto';
import type {
  RacePerformanceItemDto,
  RacePerformanceListQueryDto,
  RacePerformanceListResponseDto,
} from '../dto/race-performance-list.dto';

/**
 * F-062 Wave 2C-1 NEW SERVICE — Race Performance Analytics (BR-SA-21 v3).
 *
 * 3 public endpoints (BR-SA-21 a/b/c):
 *   - getTypeDistribution() — BR-SA-21a: GMV by race type chart
 *   - getSpotlight() — BR-SA-21b: top GMV race + auto-insight text
 *   - getPerformanceList() — BR-SA-21c: paginated filtered list với 5 sort fields
 *
 * Shared internal `_buildRaceAggregates()` does SQL group by (race_id, race_type)
 * + FeeService Tier 0 cascade per race. Mỗi public method projects to different
 * response shape với separate cache keys per BR-SA-21 a/b/c spec.
 *
 * Convention compliance (Wave 2B-1 v2 LESSON APPLIED):
 *   - Phí 5BIB dùng shared pullOrdersForFeeAggregate + FeeService (BR-SA mandate)
 *   - Cache keys via buildMetricCacheKey helper composition
 *   - Default period 12 tháng (matches Wave 2B-1+2B-2 pattern)
 *   - Race type values per existing races.race_type column convention
 *
 * TTL convention: cachedQuery auto-detect current → 900s, historical → 86400s.
 */
const TTL_CURRENT = 900;
const TTL_HISTORY = 86400;
const MAX_DATE_RANGE_DAYS = 366;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

const KNOWN_RACE_TYPES = [
  'ROAD_MARATHON',
  'ROAD_HALF_MARATHON',
  'ULTRA_TRAIL_RACE',
  'TRAIL_RACE',
] as const;

type RaceType =
  | (typeof KNOWN_RACE_TYPES)[number]
  | 'OTHER';

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeRaceType(raw: string | null | undefined): RaceType {
  if (!raw) return 'OTHER';
  return (KNOWN_RACE_TYPES as readonly string[]).includes(raw)
    ? (raw as RaceType)
    : 'OTHER';
}

/** Internal race aggregate — base shape projected to 3 endpoint DTOs. */
interface RaceAggregate {
  raceId: number;
  raceName: string;
  merchant: string;
  raceType: RaceType;
  date: string | null;
  orders: number;
  voidedOrders: number;
  gmv: number;
  netGmv: number;
  fee: number;
}

@Injectable()
export class RacePerformanceService {
  private readonly logger = new Logger(RacePerformanceService.name);

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
    private readonly feeService: FeeService,
  ) {}

  // ─── Shared helpers (cache + range + default-period) ────────────────────────

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
   * F-062 Wave 2B-1 v2 lesson APPLIED — default 12 tháng gần nhất nếu không
   * truyền from/to/month. Returns NEW query object (no mutation).
   */
  private applyDefaultPeriod<T extends AnalyticsQueryDto>(query: T): T {
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

  /**
   * Pull race aggregates (BR-SA-21 base data). 1 SQL grouped by (race_id, race_type,
   * tenant_id, merchant_name) + FeeService Tier 0 per race.
   *
   * Per-race fee attribution: pullOrdersForFeeAggregate (full period, all tenants);
   * group results by raceId in-memory, run FeeService per (tenantId, [race orders]).
   *
   * Optional raceType filter applied at SQL level for efficiency.
   */
  private async _buildRaceAggregates(
    query: AnalyticsQueryDto,
    raceTypeFilter?: string,
  ): Promise<RaceAggregate[]> {
    const { clause, params } = this.buildDateFilter(
      query.from,
      query.to,
      query.month,
    );
    const whereClause = clause ? `AND ${clause}` : '';
    const raceTypeWhere = raceTypeFilter ? 'AND r.race_type = ?' : '';
    const tenantWhere = query.tenantId ? 'AND r.tenant_id = ?' : '';
    const sqlParams: any[] = [...params];
    if (raceTypeFilter) sqlParams.push(raceTypeFilter);
    if (query.tenantId) sqlParams.push(query.tenantId);

    const rows = await this.db.query(
      `SELECT
        om.race_id,
        r.title as race_name,
        r.race_type,
        r.tenant_id,
        t.name as merchant_name,
        COUNT(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN om.financial_status = 'voided' THEN 1 END) as voided_orders,
        COALESCE(SUM(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL' THEN om.total_price ELSE 0 END), 0) as gmv,
        COALESCE(SUM(CASE WHEN om.financial_status = 'paid' AND om.order_category != 'MANUAL'
          THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv,
        MAX(CASE WHEN om.financial_status = 'paid' THEN om.payment_on END) as last_paid_date
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      JOIN tenant t ON t.id = r.tenant_id
      WHERE 1=1 ${whereClause} ${raceTypeWhere} ${tenantWhere}
      GROUP BY om.race_id, r.title, r.race_type, r.tenant_id, t.name
      ORDER BY gmv DESC`,
      sqlParams,
    );

    if (rows.length === 0) return [];

    // FeeService per (tenant, race) — pull orders raw scoped tenant if filtered
    const filter = query.tenantId ? { tenantId: query.tenantId } : undefined;
    const ordersByTenant = await pullOrdersForFeeAggregate(
      this.db,
      clause,
      params,
      filter,
    );
    const periodWindow = this.resolvePeriodWindow(query);

    const feeByRace = new Map<number, number>();
    for (const [tid, orders] of ordersByTenant) {
      // Group tenant orders by raceId
      const ordersByRace = new Map<number, typeof orders>();
      for (const o of orders) {
        const arr = ordersByRace.get(o.raceId) ?? [];
        arr.push(o);
        ordersByRace.set(o.raceId, arr);
      }
      for (const [raceId, raceOrders] of ordersByRace) {
        const result = await this.feeService.computeFeeForOrdersAggregate(
          tid,
          raceOrders,
          { from: periodWindow.from, to: periodWindow.to },
        );
        feeByRace.set(raceId, (feeByRace.get(raceId) ?? 0) + result.totalFee);
      }
    }

    return rows.map((r: any) => {
      const raceId = Number(r.race_id);
      const date = r.last_paid_date
        ? new Date(r.last_paid_date).toISOString().slice(0, 10)
        : null;
      return {
        raceId,
        raceName: String(r.race_name),
        merchant: String(r.merchant_name),
        raceType: normalizeRaceType(r.race_type),
        date,
        orders: Number(r.paid_orders),
        voidedOrders: Number(r.voided_orders),
        gmv: Number(r.gmv),
        netGmv: Number(r.net_gmv),
        fee: Math.round(feeByRace.get(raceId) ?? 0),
      };
    });
  }

  // ─── BR-SA-21a — Race Type Distribution ─────────────────────────────────────

  /**
   * BR-SA-21a — GMV by race type horizontal bar chart.
   * Cache: `analytics:metric:race-perf-type:<scope>:<periodKey>` per spec line 534.
   */
  async getTypeDistribution(
    query: AnalyticsQueryDto,
  ): Promise<RaceTypeDistributionPointDto[]> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = buildMetricCacheKey(
      'race-perf-type',
      resolveScopeFromTenant(query.tenantId),
      periodKeyFromInputs(query),
    );
    return this.cachedQuery(cacheKey, async () => {
      const aggregates = await this._buildRaceAggregates(query);
      const byType = new Map<RaceType, { count: number; gmv: number }>();
      for (const a of aggregates) {
        const entry = byType.get(a.raceType) ?? { count: 0, gmv: 0 };
        entry.count += 1;
        entry.gmv += a.gmv;
        byType.set(a.raceType, entry);
      }
      return Array.from(byType.entries()).map(([raceType, { count, gmv }]) => ({
        raceType,
        count,
        gmv,
        avgGmv: count > 0 ? Math.round(gmv / count) : 0,
      }));
    });
  }

  // ─── BR-SA-21b — Race Spotlight ─────────────────────────────────────────────

  /**
   * BR-SA-21b — Top GMV race + auto-generated insight text.
   * Cache: `analytics:metric:race-perf-spotlight:<scope>:<periodKey>` per spec line 541.
   *
   * Returns `null` if no race in period — controller wraps in 200 with null body.
   */
  async getSpotlight(query: AnalyticsQueryDto): Promise<RaceSpotlightDto | null> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = buildMetricCacheKey(
      'race-perf-spotlight',
      resolveScopeFromTenant(query.tenantId),
      periodKeyFromInputs(query),
    );
    return this.cachedQuery(cacheKey, async () => {
      const aggregates = await this._buildRaceAggregates(query);
      if (aggregates.length === 0) return null;

      // aggregates already sorted gmv DESC trong SQL → top GMV race = index 0
      const top = aggregates[0];
      const totalGmv = aggregates.reduce((sum, a) => sum + a.gmv, 0);
      const contributionPct =
        totalGmv > 0 ? Math.round((top.gmv / totalGmv) * 1000) / 10 : 0;
      const avgPerOrder = top.orders > 0 ? Math.round(top.gmv / top.orders) : 0;
      const insight = `Đóng góp ${contributionPct.toLocaleString('vi-VN')}% tổng GMV, trung bình ${avgPerOrder.toLocaleString('vi-VN')} đ/đơn`;

      return {
        raceId: top.raceId,
        raceName: top.raceName,
        merchant: top.merchant,
        type: top.raceType,
        date: top.date,
        gmv: top.gmv,
        orders: top.orders,
        avgPerOrder,
        platformFee: top.fee,
        insight,
      };
    });
  }

  // ─── BR-SA-21c — Race Performance List (Paginated + Filtered) ───────────────

  /**
   * BR-SA-21c — Paginated + filtered race performance list.
   * Cache: `analytics:metric:race-perf-list:<scope>:<filters-hash>` per spec line 554.
   *
   * Filters: raceType + tenantId (in query); sort: gmv/orders/fee/avgPerOrder/voidedPct
   * with asc/desc. Default sort: gmv DESC. Page size default 12, max 50.
   *
   * Filters-hash = sha256(JSON sorted keys) so different filter combos = distinct
   * cache keys, but same combo = stable hit.
   */
  async getPerformanceList(
    query: RacePerformanceListQueryDto,
  ): Promise<RacePerformanceListResponseDto> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE));
    const sortBy = query.sortBy ?? 'gmv';
    const sortOrder = query.sortOrder ?? 'desc';

    // filters-hash for cache key — includes ALL axes that vary results
    const filterPayload = {
      raceType: query.raceType ?? null,
      sortBy,
      sortOrder,
      page,
      limit,
    };
    const filtersHash = createHash('sha256')
      .update(JSON.stringify(filterPayload))
      .digest('hex')
      .slice(0, 12);

    const cacheKey = buildMetricCacheKey(
      'race-perf-list',
      resolveScopeFromTenant(query.tenantId),
      periodKeyFromInputs(query),
      filtersHash,
    );

    return this.cachedQuery(cacheKey, async () => {
      // _buildRaceAggregates handles raceType + tenantId filter at SQL level
      const aggregates = await this._buildRaceAggregates(query, query.raceType);
      const total = aggregates.length;
      const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

      // Map to RacePerformanceItem
      const items: RacePerformanceItemDto[] = aggregates.map((a) => {
        const totalRow = a.orders + a.voidedOrders;
        return {
          raceId: a.raceId,
          raceName: a.raceName,
          merchant: a.merchant,
          raceType: a.raceType,
          date: a.date,
          orders: a.orders,
          gmv: a.gmv,
          platformFee: a.fee,
          avgPerOrder: a.orders > 0 ? Math.round(a.gmv / a.orders) : 0,
          voidedPct:
            totalRow > 0
              ? Math.round((a.voidedOrders / totalRow) * 10000) / 100
              : 0,
        };
      });

      // In-memory sort (small dataset typically ~50-200 races)
      const sortMul = sortOrder === 'asc' ? 1 : -1;
      items.sort((a, b) => {
        const av = a[sortBy] as number;
        const bv = b[sortBy] as number;
        return (av - bv) * sortMul;
      });

      // Pagination slice
      const start = (page - 1) * limit;
      const data = items.slice(start, start + limit);

      return {
        data,
        total,
        page,
        limit,
        totalPages,
      };
    });
  }
}
