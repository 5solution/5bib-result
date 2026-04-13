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

  private async getFeeConfigs(): Promise<
    Map<number, { fee_rate: number; manual_fee: number }>
  > {
    const configs = await this.configModel.find({}).lean().exec();
    const map = new Map<number, { fee_rate: number; manual_fee: number }>();
    for (const c of configs) {
      map.set(c.tenantId, {
        fee_rate: c.service_fee_rate ?? 5.5,
        manual_fee: c.manual_fee_per_ticket ?? 5000,
      });
    }
    return map;
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

    // 1. Current month paid summary
    const [curRow] = await this.db.query(
      `SELECT
        COUNT(*) as order_count,
        COALESCE(SUM(total_price), 0) as gross_gmv,
        COALESCE(SUM(IFNULL(total_discounts, 0)), 0) as total_discounts,
        COALESCE(SUM(GREATEST(total_price - IFNULL(total_discounts, 0), 0)), 0) as net_gmv
      FROM order_metadata
      WHERE financial_status = 'paid' AND ${curClause}`,
      curParams,
    );

    // 2. Previous month paid summary
    const [prevRow] = await this.db.query(
      `SELECT
        COUNT(*) as order_count,
        COALESCE(SUM(total_price), 0) as gross_gmv
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

    // 6. Platform fee — per-tenant GMV × service_fee_rate + MANUAL tickets × manual_fee
    const tenantGmvRows = await this.db.query(
      `SELECT r.tenant_id,
        SUM(CASE WHEN om.order_category != 'MANUAL'
          THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END) as net_gmv,
        SUM(CASE WHEN om.order_category = 'MANUAL'
          THEN IFNULL(oli_agg.total_quantity, 0) ELSE 0 END) as manual_tickets
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      LEFT JOIN (
        SELECT order_id, SUM(quantity) as total_quantity
        FROM order_line_item GROUP BY order_id
      ) oli_agg ON oli_agg.order_id = om.id
      WHERE om.financial_status = 'paid' AND ${curClause}
      GROUP BY r.tenant_id`,
      curParams,
    );

    const feeConfigs = await this.getFeeConfigs();
    let platformFee = 0;
    for (const row of tenantGmvRows) {
      const cfg = feeConfigs.get(Number(row.tenant_id)) ?? {
        fee_rate: 5.5,
        manual_fee: 5000,
      };
      platformFee += (Number(row.net_gmv) * cfg.fee_rate) / 100;
      platformFee += Number(row.manual_tickets) * cfg.manual_fee;
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
          COUNT(*) as order_count,
          COALESCE(SUM(om.total_price), 0) as gmv,
          COALESCE(SUM(GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0)), 0) as net_gmv
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        WHERE om.financial_status = 'paid' AND r.tenant_id = ? ${whereClause}
        GROUP BY DATE(om.payment_on)
        ORDER BY date ASC`;
        sqlParams = [query.tenantId, ...params];
      } else {
        sql = `SELECT
          DATE(payment_on) as date,
          COUNT(*) as order_count,
          COALESCE(SUM(total_price), 0) as gmv,
          COALESCE(SUM(GREATEST(total_price - IFNULL(total_discounts, 0), 0)), 0) as net_gmv
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
          COUNT(om.id) as order_count,
          COALESCE(SUM(om.total_price), 0) as gross_gmv,
          COALESCE(SUM(GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0)), 0) as net_gmv
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        JOIN tenant t ON t.id = r.tenant_id
        WHERE om.financial_status = 'paid' ${whereClause}
        GROUP BY om.race_id, r.title, t.name, r.tenant_id, r.race_type
        ORDER BY gross_gmv DESC
        LIMIT ?`,
        [...params, limit],
      );

      const feeConfigs = await this.getFeeConfigs();

      return rows.map((r: any) => {
        const cfg = feeConfigs.get(Number(r.tenant_id)) ?? {
          fee_rate: 5.5,
          manual_fee: 5000,
        };
        const netGmv = Number(r.net_gmv);
        return {
          raceId: Number(r.race_id),
          raceName: r.race_name,
          tenantName: r.tenant_name,
          raceType: r.race_type,
          orderCount: Number(r.order_count),
          grossGmv: Number(r.gross_gmv),
          netGmv,
          platformFee: Math.round((netGmv * cfg.fee_rate) / 100),
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

    const feeConfigs = await this.getFeeConfigs();

    const data = rows.map((r: any) => {
      const cfg = feeConfigs.get(Number(r.tenant_id)) ?? {
        fee_rate: 5.5,
        manual_fee: 5000,
      };
      const paidOrders = Number(r.paid_orders);
      const voidedOrders = Number(r.voided_orders);
      const total = paidOrders + voidedOrders;
      const netGmv = Number(r.net_gmv);
      const grossGmv = Number(r.gross_gmv);

      return {
        raceId: Number(r.race_id),
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
        platformFee: Math.round((netGmv * cfg.fee_rate) / 100),
        avgOrderValue: paidOrders > 0 ? Math.round(grossGmv / paidOrders) : 0,
        voidedRate:
          total > 0 ? Math.round((voidedOrders / total) * 10000) / 100 : 0,
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

    const feeConfigs = await this.getFeeConfigs();
    const tenantId = Number(summary.tenant_id);
    const cfg = feeConfigs.get(tenantId) ?? { fee_rate: 5.5, manual_fee: 5000 };
    const netGmv = Number(summary.net_gmv);

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
      platformFee: Math.round((netGmv * cfg.fee_rate) / 100),
      feeRate: cfg.fee_rate,
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
          COUNT(CASE WHEN om.financial_status = 'paid' THEN 1 END) as paid_orders,
          COUNT(CASE WHEN om.financial_status = 'voided' THEN 1 END) as voided_orders,
          COALESCE(SUM(CASE WHEN om.financial_status = 'paid' THEN om.total_price ELSE 0 END), 0) as gross_gmv,
          COALESCE(SUM(CASE WHEN om.financial_status = 'paid'
            THEN GREATEST(om.total_price - IFNULL(om.total_discounts, 0), 0) ELSE 0 END), 0) as net_gmv,
          SUM(CASE WHEN om.financial_status = 'paid' AND om.order_category = 'MANUAL'
            THEN 1 ELSE 0 END) as manual_orders,
          MAX(CASE WHEN om.financial_status = 'paid' THEN om.payment_on END) as last_order_date
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        JOIN tenant t ON t.id = r.tenant_id
        WHERE 1=1 ${whereClause}
        GROUP BY r.tenant_id, t.name
        ORDER BY ${sortField} ${sortDir}`,
        params,
      );

      const feeConfigs = await this.getFeeConfigs();

      return rows.map((r: any) => {
        const cfg = feeConfigs.get(Number(r.tenant_id)) ?? {
          fee_rate: 5.5,
          manual_fee: 5000,
        };
        const paidOrders = Number(r.paid_orders);
        const voidedOrders = Number(r.voided_orders);
        const total = paidOrders + voidedOrders;
        const grossGmv = Number(r.gross_gmv);
        const netGmv = Number(r.net_gmv);
        const manualOrders = Number(r.manual_orders);

        return {
          tenantId: Number(r.tenant_id),
          merchantName: r.merchant_name,
          feeRate: cfg.fee_rate,
          raceCount: Number(r.race_count),
          paidOrders,
          voidedOrders,
          grossGmv,
          netGmv,
          platformFee: Math.round((netGmv * cfg.fee_rate) / 100),
          manualOrders,
          manualOrderPct:
            paidOrders > 0
              ? Math.round((manualOrders / paidOrders) * 10000) / 100
              : 0,
          avgOrderValue: paidOrders > 0 ? Math.round(grossGmv / paidOrders) : 0,
          voidedRate:
            total > 0 ? Math.round((voidedOrders / total) * 10000) / 100 : 0,
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
}
