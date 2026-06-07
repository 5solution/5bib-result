import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import * as ExcelJS from 'exceljs';
import type Redis from 'ioredis';
import { Model } from 'mongoose';
import { DataSource } from 'typeorm';
import {
  dateToMonthKey,
  dateToWeekKey,
  labelForMonthKey,
  labelForWeekKey,
  mysqlYearweekToWeekKey,
  normalizePaymentOn,
  ymdUtc,
} from '../../analytics/services/bucket-helpers';
import { pullOrdersForFeeAggregate } from '../../analytics/services/fee-aggregate.helpers';
import {
  type PeriodKind,
  resolvePeriod,
} from '../../analytics/services/period-resolver';
import { FeeService } from '../../finance/services/fee.service';
import type { LogtoUser } from '../../logto-auth/types';
import { MerchantMeResponseDto } from '../dto/merchant-me.dto';
import {
  RevenueAggregateDto,
  RevenueByCategoryDto,
} from '../dto/revenue-breakdown.dto';
import { RevenueSummaryDto } from '../dto/revenue-summary.dto';
import { RevenueTrendDto } from '../dto/revenue-trend.dto';
import { MerchantRaceListResponseDto } from '../dto/race-list.dto';
import {
  TicketOrderListDto,
  TicketStackedDto,
  TicketTrendDto,
} from '../dto/ticket-charts.dto';
import {
  type TicketChartGranularity,
  TicketSalesBreakdownDto,
  TicketSalesSummaryDto,
} from '../dto/ticket-sales.dto';
import {
  MerchantPortalAccess,
  MerchantPortalAccessDocument,
  type MerchantPortalPermission,
} from '../schemas/merchant-portal-access.schema';

export interface ResolvedAccessConfig {
  userId: string;
  userName: string;
  email: string;
  tenantIds: number[];
  include: number[];
  exclude: number[];
  permissions: MerchantPortalPermission[];
  isActive: boolean;
}

const ACCESS_CACHE_TTL_SECONDS = 300;
const RACES_CACHE_TTL_SECONDS = 300;
const TICKET_SALES_CACHE_TTL_SECONDS = 60;

const CANONICAL_FINANCIAL_STATUSES = ['paid', 'voided', 'pending'];

function categoryGroup(orderCategory: string | null): 'fee_fixed' | 'fee_percent' {
  return orderCategory === 'MANUAL' ? 'fee_fixed' : 'fee_percent';
}

@Injectable()
export class MerchantPortalService {
  private readonly logger = new Logger(MerchantPortalService.name);

  private static readonly NOMINAL_PERIOD = {
    from: '1970-01-01',
    to: '2999-12-31',
  };

  constructor(
    @InjectModel(MerchantPortalAccess.name)
    private readonly accessModel: Model<MerchantPortalAccessDocument>,
    @InjectDataSource('platform')
    private readonly db: DataSource,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly feeService: FeeService,
  ) {}

  async getAccessConfig(userId: string): Promise<ResolvedAccessConfig> {
    const cacheKey = `merchant-portal:access:${userId}`;
    let cachedCfg: ResolvedAccessConfig | null = null;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) cachedCfg = JSON.parse(cached);
    } catch (err) {
      this.logger.warn(`Redis read ${cacheKey} failed: ${err.message}`);
    }
    if (cachedCfg) {
      this.assertActive(cachedCfg);
      return cachedCfg;
    }
    const doc = await this.accessModel.findOne({ userId }).lean().exec();
    if (!doc) {
      throw new NotFoundException({
        statusCode: 404,
        errorCode: '404_NO_CONFIG',
        message: {
          vi: 'Tài khoản của bạn chưa được gán giải nào. Vui lòng liên hệ admin 5BIB.',
          en: 'Your account has no race assignments. Please contact 5BIB admin.',
        },
      });
    }
    const cfg: ResolvedAccessConfig = {
      userId: doc.userId,
      userName: doc.userName,
      email: doc.email,
      tenantIds: doc.tenantIds ?? [],
      include: doc.raceOverrides?.include ?? [],
      exclude: doc.raceOverrides?.exclude ?? [],
      permissions: doc.permissions,
      isActive: doc.isActive,
    };
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(cfg),
        'EX',
        ACCESS_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(`Redis write ${cacheKey} failed: ${err.message}`);
    }
    this.assertActive(cfg);
    return cfg;
  }

  private assertActive(cfg: ResolvedAccessConfig): void {
    if (!cfg.isActive) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: '403_INACTIVE',
        message: {
          vi: 'Tài khoản đã bị vô hiệu hóa',
          en: 'Account has been deactivated',
        },
      });
    }
  }

  async resolveAccessibleRaces(userId: string): Promise<Set<number>> {
    const cacheKey = `merchant-portal:races:${userId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return new Set(JSON.parse(cached));
      }
    } catch (err) {
      this.logger.warn(`Redis read ${cacheKey} failed: ${err.message}`);
    }
    const cfg = await this.getAccessConfig(userId);
    const accessible = new Set<number>();
    if (cfg.tenantIds.length > 0) {
      const tenantPlaceholders = cfg.tenantIds.map(() => '?').join(',');
      const tenantRaces = await this.db.query(
        `SELECT r.race_id
           FROM races r
           WHERE r.tenant_id IN (${tenantPlaceholders})
             AND r.status != 'DRAFT' AND r.is_delete = 0`,
        cfg.tenantIds,
      );
      for (const row of tenantRaces) accessible.add(Number(row.race_id));
    }
    if (cfg.include.length > 0) {
      const incPlaceholders = cfg.include.map(() => '?').join(',');
      const includeRaces = await this.db.query(
        `SELECT r.race_id
           FROM races r
           WHERE r.race_id IN (${incPlaceholders})
             AND r.status != 'DRAFT' AND r.is_delete = 0`,
        cfg.include,
      );
      for (const row of includeRaces) accessible.add(Number(row.race_id));
    }
    for (const excludeId of cfg.exclude) accessible.delete(excludeId);
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify([...accessible]),
        'EX',
        RACES_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(`Redis write ${cacheKey} failed: ${err.message}`);
    }
    return accessible;
  }

  assertRaceAccessible(accessible: Set<number>, raceId: number): void {
    if (!accessible.has(raceId)) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: '403_NO_RACE',
        message: {
          vi: 'Bạn không có quyền xem giải này',
          en: "You don't have access to this race",
        },
      });
    }
  }

  async getMe(user: LogtoUser): Promise<MerchantMeResponseDto> {
    const cfg = await this.getAccessConfig(user.userId);
    const accessible = await this.resolveAccessibleRaces(user.userId);
    return {
      userId: cfg.userId,
      userName: cfg.userName,
      email: cfg.email,
      tenantIds: cfg.tenantIds,
      permissions: cfg.permissions,
      assignedRaceCount: accessible.size,
    };
  }

  async getRaces(
    userId: string,
    tenantId?: number,
  ): Promise<MerchantRaceListResponseDto> {
    const cfg = await this.getAccessConfig(userId);
    if (tenantId !== undefined && !cfg.tenantIds.includes(tenantId)) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: '403_NO_TENANT',
        message: {
          vi: 'Bạn không có quyền xem BTC này',
          en: "You don't have access to this merchant",
        },
      });
    }
    const accessible = await this.resolveAccessibleRaces(userId);
    if (accessible.size === 0) {
      return { races: [], total: 0 };
    }
    const raceIds = [...accessible];
    const placeholders = raceIds.map(() => '?').join(',');
    const tenantClause = tenantId !== undefined ? 'AND r.tenant_id = ?' : '';
    const metaParams =
      tenantId !== undefined ? [...raceIds, tenantId] : raceIds;
    const metaRows = await this.db.query(
      `SELECT r.race_id, r.title, r.status, r.event_start_date, r.tenant_id
       FROM races r
       WHERE r.race_id IN (${placeholders}) AND r.is_delete = 0 ${tenantClause}
       ORDER BY r.event_start_date DESC`,
      metaParams,
    );
    const ticketRows = await this.db.query(
      `SELECT om.race_id, COALESCE(SUM(oli.quantity),0) AS ticket_count
       FROM order_metadata om
       LEFT JOIN order_line_item oli ON oli.order_id = om.id
       WHERE om.race_id IN (${placeholders})
         AND om.deleted = 0 AND om.financial_status = 'paid'
       GROUP BY om.race_id`,
      raceIds,
    );
    const ticketByRace = new Map<number, number>();
    for (const row of ticketRows) {
      ticketByRace.set(Number(row.race_id), Number(row.ticket_count ?? 0));
    }
    const races = metaRows.map((row) => {
      const raceId = Number(row.race_id);
      return {
        raceId,
        title: row.title ?? '',
        status: row.status ?? '',
        eventStartDate: row.event_start_date,
        tenantId: Number(row.tenant_id),
        ticketsSold: ticketByRace.get(raceId) ?? 0,
      };
    });
    return { races, total: races.length };
  }

  private async assertRaceForUser(
    userId: string,
    raceId: number,
  ): Promise<void> {
    const accessible = await this.resolveAccessibleRaces(userId);
    this.assertRaceAccessible(accessible, raceId);
  }

  private async cachedTicketRead<T>(
    cacheKey: string,
    compute: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      this.logger.warn(`Redis read ${cacheKey} failed: ${err.message}`);
    }
    const result = await compute();
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        TICKET_SALES_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(`Redis write ${cacheKey} failed: ${err.message}`);
    }
    return result;
  }

  async getTicketSalesSummary(
    userId: string,
    raceId: number,
  ): Promise<TicketSalesSummaryDto> {
    await this.assertRaceForUser(userId, raceId);
    const cacheKey = `merchant-portal:ticket-summary:${userId}:${raceId}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const rows = await this.db.query(
        `SELECT om.financial_status,
                COUNT(DISTINCT om.id) AS order_count,
                COALESCE(SUM(oli.quantity),0) AS ticket_count
         FROM order_metadata om
         LEFT JOIN order_line_item oli ON oli.order_id = om.id
         WHERE om.race_id = ? AND om.deleted = 0
         GROUP BY om.financial_status`,
        [raceId],
      );
      const byStatusMap = new Map<
        string,
        { financialStatus: string; orderCount: number; ticketCount: number }
      >();
      for (const row of rows) {
        const status = row.financial_status ?? 'unknown';
        byStatusMap.set(status, {
          financialStatus: status,
          orderCount: Number(row.order_count ?? 0),
          ticketCount: Number(row.ticket_count ?? 0),
        });
      }
      const byStatus: Array<{
        financialStatus: string;
        orderCount: number;
        ticketCount: number;
      }> = [];
      for (const status of CANONICAL_FINANCIAL_STATUSES) {
        byStatus.push(
          byStatusMap.get(status) ?? {
            financialStatus: status,
            orderCount: 0,
            ticketCount: 0,
          },
        );
        byStatusMap.delete(status);
      }
      for (const extra of byStatusMap.values()) byStatus.push(extra);
      const totalTickets = byStatus.reduce((s, b) => s + b.ticketCount, 0);
      const totalOrders = byStatus.reduce((s, b) => s + b.orderCount, 0);
      return { raceId, totalTickets, totalOrders, byStatus };
    });
  }

  async getTicketSalesByCourse(
    userId: string,
    raceId: number,
  ): Promise<TicketSalesBreakdownDto> {
    await this.assertRaceForUser(userId, raceId);
    const cacheKey = `merchant-portal:ticket-by-course:${userId}:${raceId}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const rows = await this.db.query(
        `SELECT rc.id AS course_id, rc.name AS course_name,
                COUNT(DISTINCT om.id) AS order_count,
                COALESCE(SUM(oli.quantity),0) AS ticket_count
         FROM order_line_item oli
         JOIN order_metadata om ON oli.order_id = om.id
         JOIN ticket_type tt ON oli.ticket_type_id = tt.id
         JOIN race_course rc ON tt.race_course_id = rc.id
         WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
         GROUP BY rc.id, rc.name
         ORDER BY ticket_count DESC`,
        [raceId],
      );
      return this.toBreakdown(raceId, rows, 'course_id', 'course_name');
    });
  }

  async getTicketSalesByType(
    userId: string,
    raceId: number,
  ): Promise<TicketSalesBreakdownDto> {
    await this.assertRaceForUser(userId, raceId);
    const cacheKey = `merchant-portal:ticket-by-type:${userId}:${raceId}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const rows = await this.db.query(
        `SELECT tt.id AS ticket_type_id, tt.type_name AS ticket_type_name,
                COUNT(DISTINCT om.id) AS order_count,
                COALESCE(SUM(oli.quantity),0) AS ticket_count
         FROM order_line_item oli
         JOIN order_metadata om ON oli.order_id = om.id
         JOIN ticket_type tt ON oli.ticket_type_id = tt.id
         WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
         GROUP BY tt.id, tt.type_name
         ORDER BY ticket_count DESC`,
        [raceId],
      );
      return this.toBreakdown(raceId, rows, 'ticket_type_id', 'ticket_type_name');
    });
  }

  private toBreakdown(
    raceId: number,
    rows: any[],
    idKey: string,
    nameKey: string,
  ): TicketSalesBreakdownDto {
    const items = rows.map((row) => ({
      id: Number(row[idKey]),
      name: row[nameKey] ?? '',
      orderCount: Number(row.order_count ?? 0),
      ticketCount: Number(row.ticket_count ?? 0),
    }));
    const totalTickets = items.reduce((s, i) => s + i.ticketCount, 0);
    return { raceId, totalTickets, items };
  }

  private assertRevenuePermission(cfg: ResolvedAccessConfig): void {
    if (!cfg.permissions.includes('revenue_report')) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: '403_NO_REVENUE_PERMISSION',
        message: {
          vi: 'Tài khoản của bạn không có quyền xem doanh thu',
          en: 'Your account does not have revenue report permission',
        },
      });
    }
  }

  async getRevenueSummary(
    userId: string,
    raceId: number,
  ): Promise<RevenueSummaryDto> {
    const cfg = await this.getAccessConfig(userId);
    this.assertRevenuePermission(cfg);
    const accessible = await this.resolveAccessibleRaces(userId);
    this.assertRaceAccessible(accessible, raceId);
    const cacheKey = `merchant-portal:revenue-summary:${userId}:${raceId}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const byTenant = await pullOrdersForFeeAggregate(this.db, '', [], {
        raceId,
      });
      const period = { from: '1970-01-01', to: '2999-12-31' };
      let gmv = 0;
      let orderCount = 0;
      let totalServiceFee = 0;
      let totalManualFee = 0;
      let totalVat = 0;
      let totalFee = 0;
      const warnings: string[] = [];
      for (const [tenantId, orders] of byTenant.entries()) {
        for (const o of orders) {
          gmv += (o.totalPrice ?? 0) - (o.totalDiscounts ?? 0);
        }
        orderCount += orders.length;
        const fee = await this.feeService.computeFeeForOrdersAggregate(
          tenantId,
          orders,
          period,
        );
        totalServiceFee += fee.totalServiceFee;
        totalManualFee += fee.totalManualFee;
        totalVat += fee.totalVat;
        totalFee += fee.totalFee;
        if (fee.warnings?.length) warnings.push(...fee.warnings);
      }
      const net = gmv - totalFee;
      return {
        raceId,
        gmv,
        totalServiceFee,
        totalManualFee,
        totalVat,
        totalFee,
        net,
        orderCount,
        warnings,
      };
    });
  }

  async getRevenueByCategory(
    userId: string,
    raceId: number,
  ): Promise<RevenueByCategoryDto> {
    const cfg = await this.getAccessConfig(userId);
    this.assertRevenuePermission(cfg);
    const accessible = await this.resolveAccessibleRaces(userId);
    this.assertRaceAccessible(accessible, raceId);
    const cacheKey = `merchant-portal:revenue-by-category:${userId}:${raceId}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const byTenant = await pullOrdersForFeeAggregate(this.db, '', [], {
        raceId,
      });
      const warnings: string[] = [];
      const acc = {
        fee_percent: { gmv: 0, totalFee: 0, orderCount: 0 },
        fee_fixed: { gmv: 0, totalFee: 0, orderCount: 0 },
      };
      for (const [tenantId, orders] of byTenant.entries()) {
        const partitions = {
          fee_percent: [],
          fee_fixed: [],
        };
        for (const o of orders) {
          partitions[categoryGroup(o.orderCategory ?? null)].push(o);
        }
        for (const key of ['fee_percent', 'fee_fixed'] as const) {
          const part = partitions[key];
          if (part.length === 0) continue;
          for (const o of part) {
            acc[key].gmv += (o.totalPrice ?? 0) - (o.totalDiscounts ?? 0);
          }
          acc[key].orderCount += part.length;
          const fee = await this.feeService.computeFeeForOrdersAggregate(
            tenantId,
            part,
            MerchantPortalService.NOMINAL_PERIOD,
          );
          acc[key].totalFee += fee.totalFee;
          if (fee.warnings?.length) warnings.push(...fee.warnings);
        }
      }
      const groups = (['fee_percent', 'fee_fixed'] as const).map((key) => ({
        groupKey: key,
        gmv: acc[key].gmv,
        totalFee: acc[key].totalFee,
        net: acc[key].gmv - acc[key].totalFee,
        orderCount: acc[key].orderCount,
      }));
      const gmv = groups.reduce((s, g) => s + g.gmv, 0);
      return { raceId, gmv, groups, warnings };
    });
  }

  async getRevenueAggregate(userId: string): Promise<RevenueAggregateDto> {
    const cfg = await this.getAccessConfig(userId);
    this.assertRevenuePermission(cfg);
    const accessible = await this.resolveAccessibleRaces(userId);
    const cacheKey = `merchant-portal:revenue-aggregate:${userId}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const byTenantRows: Array<{
        tenantId: number;
        gmv: number;
        totalFee: number;
        net: number;
        orderCount: number;
      }> = [];
      const warnings: string[] = [];
      for (const tenantId of cfg.tenantIds) {
        const ordersMap = await pullOrdersForFeeAggregate(this.db, '', [], {
          tenantId,
        });
        const orders = (ordersMap.get(tenantId) ?? []).filter((o) =>
          accessible.has(o.raceId),
        );
        if (orders.length === 0) continue;
        let gmv = 0;
        for (const o of orders) {
          gmv += (o.totalPrice ?? 0) - (o.totalDiscounts ?? 0);
        }
        const fee = await this.feeService.computeFeeForOrdersAggregate(
          tenantId,
          orders,
          MerchantPortalService.NOMINAL_PERIOD,
        );
        if (fee.warnings?.length) warnings.push(...fee.warnings);
        byTenantRows.push({
          tenantId,
          gmv,
          totalFee: fee.totalFee,
          net: gmv - fee.totalFee,
          orderCount: orders.length,
        });
      }
      byTenantRows.sort((a, b) => b.gmv - a.gmv);
      const totals = byTenantRows.reduce(
        (t, r) => {
          t.gmv += r.gmv;
          t.totalFee += r.totalFee;
          t.orderCount += r.orderCount;
          return t;
        },
        { gmv: 0, totalFee: 0, orderCount: 0 },
      );
      return {
        gmv: totals.gmv,
        totalFee: totals.totalFee,
        net: totals.gmv - totals.totalFee,
        orderCount: totals.orderCount,
        byTenant: byTenantRows,
        warnings,
      };
    });
  }

  private bucketExpr(granularity: TicketChartGranularity): string {
    switch (granularity) {
      case 'weekly':
        return 'YEARWEEK(om.payment_on, 3)';
      case 'monthly':
        return "DATE_FORMAT(om.payment_on, '%Y-%m')";
      case 'daily':
      default:
        return "DATE_FORMAT(om.payment_on, '%Y-%m-%d')";
    }
  }

  private bucketKeyLabel(
    raw: number | string,
    granularity: TicketChartGranularity,
  ): { bucket: string; label: string } {
    if (granularity === 'weekly') {
      const key = mysqlYearweekToWeekKey(raw);
      return { bucket: key, label: labelForWeekKey(key) };
    }
    if (granularity === 'monthly') {
      const key = String(raw);
      return { bucket: key, label: labelForMonthKey(key) };
    }
    const key = String(raw);
    const label = `${key.slice(8, 10)}/${key.slice(5, 7)}`;
    return { bucket: key, label };
  }

  async getTicketSalesTrend(
    userId: string,
    raceId: number,
    period: string,
    granularity: TicketChartGranularity,
    now?: Date,
  ): Promise<TicketTrendDto> {
    await this.assertRaceForUser(userId, raceId);
    const { fromIso, toIso, periodKey } = resolvePeriod({
      kind: period as PeriodKind,
      now,
    });
    const cacheKey = `merchant-portal:ticket-trend:${userId}:${raceId}:${periodKey}:${granularity}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const expr = this.bucketExpr(granularity);
      const rows = await this.db.query(
        `SELECT ${expr} AS bucket, COUNT(DISTINCT om.id) AS order_count
           FROM order_metadata om
           WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
             AND om.payment_on >= ? AND om.payment_on < ?
           GROUP BY bucket
           ORDER BY bucket`,
        [raceId, fromIso, toIso],
      );
      const series = rows.map((r) => {
        const { bucket, label } = this.bucketKeyLabel(r.bucket, granularity);
        return { bucket, label, orderCount: Number(r.order_count ?? 0) };
      });
      return { raceId, period, granularity, series };
    });
  }

  async getTicketSalesStacked(
    userId: string,
    raceId: number,
    period: string,
    granularity: TicketChartGranularity,
    now?: Date,
  ): Promise<TicketStackedDto> {
    await this.assertRaceForUser(userId, raceId);
    const { fromIso, toIso, periodKey } = resolvePeriod({
      kind: period as PeriodKind,
      now,
    });
    const cacheKey = `merchant-portal:ticket-stacked:${userId}:${raceId}:${periodKey}:${granularity}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const expr = this.bucketExpr(granularity);
      const rows = await this.db.query(
        `SELECT ${expr} AS bucket, rc.id AS course_id, rc.name AS course_name,
                COALESCE(SUM(oli.quantity),0) AS ticket_count
         FROM order_line_item oli
         JOIN order_metadata om ON oli.order_id = om.id
         JOIN ticket_type tt ON oli.ticket_type_id = tt.id
         JOIN race_course rc ON tt.race_course_id = rc.id
         WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
           AND om.payment_on >= ? AND om.payment_on < ?
         GROUP BY bucket, rc.id, rc.name
         ORDER BY bucket`,
        [raceId, fromIso, toIso],
      );
      const courseTotal = new Map<number, { name: string; total: number }>();
      const bucketMap = new Map<
        string,
        { label: string; counts: Record<number, number> }
      >();
      for (const r of rows) {
        const courseId = Number(r.course_id);
        const tc = Number(r.ticket_count ?? 0);
        const ct = courseTotal.get(courseId) ?? {
          name: r.course_name ?? '',
          total: 0,
        };
        ct.total += tc;
        courseTotal.set(courseId, ct);
        const { bucket, label } = this.bucketKeyLabel(r.bucket, granularity);
        const entry = bucketMap.get(bucket) ?? { label, counts: {} };
        entry.counts[courseId] = (entry.counts[courseId] ?? 0) + tc;
        bucketMap.set(bucket, entry);
      }
      const courses = [...courseTotal.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([courseId, v]) => ({ courseId, courseName: v.name }));
      const series = [...bucketMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([bucket, v]) => ({ bucket, label: v.label, counts: v.counts }));
      return { raceId, period, granularity, courses, series };
    });
  }

  async getTicketSalesOrders(
    userId: string,
    raceId: number,
    page: number,
    pageSize: number,
    financialStatus?: string,
    search?: string,
  ): Promise<TicketOrderListDto> {
    await this.assertRaceForUser(userId, raceId);
    const conds = ['om.race_id = ?', 'om.deleted = 0'];
    const params: any[] = [raceId];
    if (financialStatus) {
      conds.push('om.financial_status = ?');
      params.push(financialStatus);
    }
    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      conds.push(
        "(om.first_name LIKE ? OR om.last_name LIKE ? OR om.name LIKE ? OR CONCAT(COALESCE(om.first_name,''),' ',COALESCE(om.last_name,'')) LIKE ?)",
      );
      params.push(like, like, like, like);
    }
    const where = conds.join(' AND ');
    const countRows = await this.db.query(
      `SELECT COUNT(*) AS total FROM order_metadata om WHERE ${where}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const offset = (page - 1) * pageSize;
    const rows = await this.db.query(
      `SELECT om.id AS order_id, om.first_name, om.last_name, om.name,
              om.email, om.phone_number,
              om.financial_status, om.payment_on,
              oli_agg.quantity AS quantity,
              rc.name AS course_name, tt.type_name AS ticket_type_name
       FROM order_metadata om
       LEFT JOIN (
         SELECT order_id, SUM(quantity) AS quantity, MIN(ticket_type_id) AS ticket_type_id
         FROM order_line_item GROUP BY order_id
       ) oli_agg ON oli_agg.order_id = om.id
       LEFT JOIN ticket_type tt ON tt.id = oli_agg.ticket_type_id
       LEFT JOIN race_course rc ON rc.id = tt.race_course_id
       WHERE ${where}
       ORDER BY om.payment_on DESC, om.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );
    const items = rows.map((r) => {
      const fullName = [r.first_name, r.last_name]
        .filter((x) => x && x.trim())
        .join(' ')
        .trim();
      return {
        orderId: Number(r.order_id),
        buyerName: fullName || (r.name ?? '').trim(),
        buyerEmail: r.email ?? null,
        buyerPhone: r.phone_number ?? null,
        courseName: r.course_name ?? null,
        ticketTypeName: r.ticket_type_name ?? null,
        quantity: Number(r.quantity ?? 0),
        financialStatus: r.financial_status ?? '',
        paymentOn: r.payment_on,
      };
    });
    return { items, total, page, pageSize };
  }

  private dateBucketKeyLabel(
    d: Date,
    granularity: TicketChartGranularity,
  ): { bucket: string; label: string } {
    if (granularity === 'weekly') {
      const key = dateToWeekKey(d);
      return { bucket: key, label: labelForWeekKey(key) };
    }
    if (granularity === 'monthly') {
      const key = dateToMonthKey(d);
      return { bucket: key, label: labelForMonthKey(key) };
    }
    const key = ymdUtc(d);
    return { bucket: key, label: `${key.slice(8, 10)}/${key.slice(5, 7)}` };
  }

  async getRevenueTrend(
    userId: string,
    raceId: number,
    period: string,
    granularity: TicketChartGranularity,
    now?: Date,
  ): Promise<RevenueTrendDto> {
    const cfg = await this.getAccessConfig(userId);
    this.assertRevenuePermission(cfg);
    const accessible = await this.resolveAccessibleRaces(userId);
    this.assertRaceAccessible(accessible, raceId);
    const { fromIso, toIso, periodKey } = resolvePeriod({
      kind: period as PeriodKind,
      now,
    });
    const cacheKey = `merchant-portal:revenue-trend:${userId}:${raceId}:${periodKey}:${granularity}`;
    return this.cachedTicketRead(cacheKey, async () => {
      const byTenant = await pullOrdersForFeeAggregate(
        this.db,
        'om.payment_on >= ? AND om.payment_on < ?',
        [fromIso, toIso],
        { raceId },
      );
      const warnings: string[] = [];
      const bucketMap = new Map<
        string,
        { label: string; gmv: number; totalFee: number; orderCount: number }
      >();
      for (const [tenantId, orders] of byTenant.entries()) {
        const perBucket = new Map<string, { label: string; list: any[] }>();
        for (const o of orders) {
          const d = normalizePaymentOn(o.createdAt);
          const { bucket, label } = this.dateBucketKeyLabel(d, granularity);
          const e = perBucket.get(bucket) ?? { label, list: [] };
          e.list.push(o);
          perBucket.set(bucket, e);
        }
        for (const [bucket, { label, list }] of perBucket.entries()) {
          let gmv = 0;
          for (const o of list) {
            gmv += (o.totalPrice ?? 0) - (o.totalDiscounts ?? 0);
          }
          const fee = await this.feeService.computeFeeForOrdersAggregate(
            tenantId,
            list,
            { from: fromIso, to: toIso },
          );
          if (fee.warnings?.length) warnings.push(...fee.warnings);
          const acc = bucketMap.get(bucket) ?? {
            label,
            gmv: 0,
            totalFee: 0,
            orderCount: 0,
          };
          acc.gmv += gmv;
          acc.totalFee += fee.totalFee;
          acc.orderCount += list.length;
          bucketMap.set(bucket, acc);
        }
      }
      const series = [...bucketMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([bucket, v]) => ({
          bucket,
          label: v.label,
          gmv: v.gmv,
          totalFee: v.totalFee,
          net: v.gmv - v.totalFee,
          orderCount: v.orderCount,
        }));
      return { raceId, period, granularity, series, warnings };
    });
  }

  async getRevenueExport(
    userId: string,
    raceId: number,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const summary = await this.getRevenueSummary(userId, raceId);
    const byCategory = await this.getRevenueByCategory(userId, raceId);
    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB Merchant Portal';
    const s1 = wb.addWorksheet('Tổng quan doanh thu');
    s1.columns = [
      { header: 'Chỉ tiêu', key: 'k', width: 28 },
      { header: 'Giá trị (VND)', key: 'v', width: 20 },
    ];
    s1.addRows([
      { k: 'Race ID', v: summary.raceId },
      { k: 'GMV (gross paid)', v: summary.gmv },
      { k: 'Phí dịch vụ', v: summary.totalServiceFee },
      { k: 'Phí thủ công', v: summary.totalManualFee },
      { k: 'VAT', v: summary.totalVat },
      { k: 'Tổng phí 5BIB', v: summary.totalFee },
      { k: 'Net về BTC', v: summary.net },
      { k: 'Số đơn paid', v: summary.orderCount },
    ]);
    const s2 = wb.addWorksheet('Theo loại phí');
    s2.columns = [
      { header: 'Nhóm', key: 'g', width: 22 },
      { header: 'GMV', key: 'gmv', width: 18 },
      { header: 'Phí', key: 'fee', width: 18 },
      { header: 'Net', key: 'net', width: 18 },
      { header: 'Số đơn', key: 'n', width: 12 },
    ];
    const groupLabel = {
      fee_percent: 'Phí %',
      fee_fixed: 'Phí cố định (thủ công)',
    };
    for (const g of byCategory.groups) {
      s2.addRow({
        g: groupLabel[g.groupKey] ?? g.groupKey,
        gmv: g.gmv,
        fee: g.totalFee,
        net: g.net,
        n: g.orderCount,
      });
    }
    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `5bib-merchant-revenue-race-${raceId}.xlsx`;
    return {
      buffer,
      filename,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
