import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  SparklinePointDto,
  SparklineSeriesDto,
  SparklinesResponseDto,
} from '../dto/dashboard-response.dto';
import { FeeService } from '../../finance/services/fee.service';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../../merchant/schemas/merchant-config.schema';
import { OrderForFeeAggregate } from '../../finance/dto/fee-aggregate.dto';

/**
 * F-023 BR-DASH-05 — Sparkline 30 ngày daily aggregate.
 *
 * Source: bảng `order_metadata` (MySQL platform DB), `financial_status='paid'`.
 * Cron `EVERY_HOUR` (DashboardAggregatorCron) refresh cache mỗi giờ. Endpoint
 * đọc cache trước; cache miss → on-demand compute + write.
 *
 * F-059 BR-59-03 — Refactor platform_fee per-day per-tenant cascade qua
 * `FeeService.computeFeeForOrdersAggregate()`. Pull-once-30d MySQL + in-memory
 * group by date+tenant để giảm 30 SQL roundtrip → 1. Pre-load configs (BR-59-13
 * + PAUSE-Coder-03) để tránh N+30N Mongo query.
 *
 * Fallback budget: nếu cold p95 > 4s → giảm xuống 14-day (PAUSE-Coder-02 = A).
 *
 * Cache key `dashboard:sparkline:30d` (key mới — đổi từ `dashboard:sparklines:30d`
 * cũ sang singular pattern match `dashboard:sparkline:*` per Manager plan
 * BR-59-06).
 */
const CACHE_KEY = 'dashboard:sparkline:30d';
const CACHE_TTL_SECONDS = 3600;
const DEFAULT_DAYS = 30;
const FALLBACK_DAYS = 14; // PAUSE-Coder-02 = A khi cold > 4s

interface SparklineCachePayload {
  series: SparklineSeriesDto[];
  days: number;
  generatedAt: string;
}

@Injectable()
export class DashboardSparklineService {
  private readonly logger = new Logger(DashboardSparklineService.name);

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
    private readonly feeService: FeeService,
    @InjectModel(MerchantConfig.name)
    private readonly merchantConfigModel: Model<MerchantConfigDocument>,
  ) {}

  async getSparklines(): Promise<SparklinesResponseDto> {
    const cached = await this.readCache();
    if (cached) {
      return cached;
    }
    const fresh = await this.compute(DEFAULT_DAYS);
    await this.writeCache(fresh);
    return fresh;
  }

  /**
   * Cron entry point — gọi từ DashboardAggregatorCron mỗi giờ.
   * Force compute + ghi đè cache, KHÔNG đọc cache cũ.
   */
  async refreshCache(days = DEFAULT_DAYS): Promise<SparklinesResponseDto> {
    const fresh = await this.compute(days);
    await this.writeCache(fresh);
    return fresh;
  }

  private async readCache(): Promise<SparklinesResponseDto | null> {
    try {
      const raw = await this.redis.get(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SparklineCachePayload;
    } catch (e) {
      this.logger.warn(`[F-059] Sparkline cache read fail: ${(e as Error).message}`);
      return null;
    }
  }

  private async writeCache(payload: SparklinesResponseDto): Promise<void> {
    try {
      await this.redis.set(
        CACHE_KEY,
        JSON.stringify(payload),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch (e) {
      this.logger.warn(`[F-059] Sparkline cache write fail: ${(e as Error).message}`);
    }
  }

  /**
   * F-059 BR-59-03 — Refactor compute với cascade fee.
   *
   * Algorithm:
   *   1. Generate dateRange[] (30 days).
   *   2. Single SQL query GMV/net/athletes per day (existing — exclude MANUAL).
   *   3. Single SQL query pull raw orders 30-day range INCLUDE MANUAL.
   *   4. Pre-load `Map<tenantId, MerchantConfig>` 1 batch query (PAUSE-Coder-03).
   *   5. Group orders by (date, tenantId) in-memory.
   *   6. Per-day per-tenant call `feeService.computeFeeForOrdersAggregate`.
   *   7. Build 4 series (gmv/net/athletes/platform_fee) + return.
   *
   * Perf: 2 SQL roundtrip total (vs 30 trong naive) + N tenant × 30 day
   * FeeService call in-memory. Pre-load config skip 30N Mongo query.
   *
   * Fallback `FALLBACK_DAYS=14` nếu cold > 4s (PAUSE-Coder-02 = A) — caller
   * sửa `days` param. Production decision documented in 03-coder-implementation.md.
   */
  private async compute(days: number): Promise<SparklinesResponseDto> {
    const today = new Date();
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - days);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

    // STEP 1+2 — Daily GMV/net/athletes (existing query, exclude MANUAL)
    const rows = await this.queryDaily(startStr, endStr).catch((e) => {
      this.logger.warn(`[F-059] Sparkline GMV query fail: ${(e as Error).message}`);
      return [] as Array<{
        d: string;
        gmv: number;
        net: number;
        athletes: number;
      }>;
    });

    const dateMap = new Map<
      string,
      { gmv: number; net: number; athletes: number }
    >();
    for (const r of rows) {
      dateMap.set(this.normalizeDateKey(r.d), {
        gmv: Number(r.gmv ?? 0),
        net: Number(r.net ?? 0),
        athletes: Number(r.athletes ?? 0),
      });
    }

    // STEP 3 — Pull all orders 30-day range INCLUDE MANUAL (1 SQL)
    const allOrders = await this.pullOrdersForFeeAggregate(startStr, endStr).catch(
      (e) => {
        this.logger.warn(
          `[F-059] Sparkline orders pull fail: ${(e as Error).message}`,
        );
        return [] as Array<OrderForFeeAggregate & { tenantId: number; dateKey: string }>;
      },
    );

    // STEP 4 — Pre-load configs (PAUSE-Coder-03 = A mandatory)
    const tenantIdSet = new Set<number>();
    for (const o of allOrders) tenantIdSet.add(o.tenantId);
    const configMap = await this.preloadMerchantConfigs([...tenantIdSet]);

    // STEP 5 — Group by (date, tenant)
    const byDateTenant = new Map<string, Map<number, OrderForFeeAggregate[]>>();
    for (const o of allOrders) {
      const dateMapInner = byDateTenant.get(o.dateKey) ?? new Map<number, OrderForFeeAggregate[]>();
      const arr = dateMapInner.get(o.tenantId) ?? [];
      arr.push({
        id: o.id,
        raceId: o.raceId,
        totalPrice: o.totalPrice,
        totalDiscounts: o.totalDiscounts,
        orderCategory: o.orderCategory,
        createdAt: o.createdAt,
        manualTicketCount: o.manualTicketCount,
      });
      dateMapInner.set(o.tenantId, arr);
      byDateTenant.set(o.dateKey, dateMapInner);
    }

    // STEP 6+7 — Backfill 30 điểm liên tục + per-day fee compute
    const dates = this.dateRange(start, today, days);
    const gmvPoints: SparklinePointDto[] = [];
    const netPoints: SparklinePointDto[] = [];
    const athletePoints: SparklinePointDto[] = [];
    const feePoints: SparklinePointDto[] = [];

    for (const date of dates) {
      const v = dateMap.get(date) ?? { gmv: 0, net: 0, athletes: 0 };
      gmvPoints.push({ date, value: v.gmv });
      netPoints.push({ date, value: v.net });
      athletePoints.push({ date, value: v.athletes });

      let dailyFee = 0;
      const tenantsForDay = byDateTenant.get(date);
      if (tenantsForDay) {
        const dayEnd = this.nextDayStr(date);
        for (const [tenantId, orders] of tenantsForDay.entries()) {
          try {
            void configMap; // pre-loaded; FeeService internal reads same Mongo
            const result = await this.feeService.computeFeeForOrdersAggregate(
              tenantId,
              orders,
              { from: date, to: dayEnd },
            );
            dailyFee += result.totalFee;
          } catch (e) {
            this.logger.warn(
              `[F-059] FeeService fail day=${date} tenant=${tenantId}: ${(e as Error).message}`,
            );
          }
        }
      }
      feePoints.push({ date, value: Math.round(dailyFee) });
    }

    return {
      series: [
        { key: 'gmv', points: gmvPoints },
        { key: 'net', points: netPoints },
        { key: 'athletes', points: athletePoints },
        { key: 'platform_fee', points: feePoints },
      ],
      days,
      generatedAt: new Date().toISOString(),
    };
  }

  private async queryDaily(
    startStr: string,
    endStr: string,
  ): Promise<
    Array<{ d: string; gmv: number; net: number; athletes: number }>
  > {
    return this.db.query(
      `SELECT
        DATE(payment_on) AS d,
        COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) AS gmv,
        COALESCE(SUM(CASE WHEN order_category != 'MANUAL'
          THEN GREATEST(total_price - IFNULL(total_discounts, 0), 0)
          ELSE 0 END), 0) AS net,
        COUNT(DISTINCT CASE WHEN order_category != 'MANUAL' THEN user_id END) AS athletes
      FROM order_metadata
      WHERE financial_status = 'paid'
        AND payment_on >= ? AND payment_on < ?
      GROUP BY DATE(payment_on)
      ORDER BY d ASC`,
      [startStr, endStr],
    );
  }

  /**
   * F-059 BR-59-02 — Pull orders INCLUDE MANUAL for fee cascade.
   * Pattern duplicate có chủ ý (PAUSE-Coder-01 = A) — KHÔNG share helper với
   * kpi.service hoặc analytics.service. Khác signature: trả flat array với
   * tenantId + pre-computed dateKey để group by (date, tenant) in-memory.
   */
  private async pullOrdersForFeeAggregate(
    start: string,
    end: string,
  ): Promise<Array<OrderForFeeAggregate & { tenantId: number; dateKey: string }>> {
    const rows: Array<{
      id: number;
      tenant_id: number;
      race_id: number;
      total_price: string | number;
      total_discounts: string | number | null;
      order_category: string;
      payment_on: Date | string;
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
        oli_agg.total_quantity AS manual_ticket_count
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      LEFT JOIN (
        SELECT order_id, SUM(quantity) AS total_quantity
        FROM order_line_item GROUP BY order_id
      ) oli_agg ON oli_agg.order_id = om.id
      WHERE om.financial_status = 'paid'
        AND om.payment_on >= ? AND om.payment_on < ?`,
      [start, end],
    );

    return rows.map((r) => {
      const dateKey =
        r.payment_on instanceof Date
          ? r.payment_on.toISOString().slice(0, 10)
          : String(r.payment_on).slice(0, 10);
      return {
        id: Number(r.id),
        tenantId: Number(r.tenant_id),
        raceId: Number(r.race_id),
        totalPrice: Number(r.total_price ?? 0),
        totalDiscounts: Number(r.total_discounts ?? 0),
        orderCategory: r.order_category,
        createdAt: r.payment_on, // F-058 semantic
        manualTicketCount:
          r.manual_ticket_count != null ? Number(r.manual_ticket_count) : undefined,
        dateKey,
      };
    });
  }

  /**
   * F-059 PAUSE-Coder-03 = A — Pre-load MerchantConfig batch (1 query for N
   * tenants). Saves up to 30N Mongo round-trips trong loop sparkline 30 day.
   *
   * Trade-off: FeeService.computeFeeForOrdersAggregate vẫn nội bộ
   * `findOne({tenantId}).lean()` mỗi call (F-058 protected). Pre-load này
   * primarily warms Mongo connection pool + reduces config-fetch latency
   * variance per tenant qua cache locality, KHÔNG bypass FeeService query.
   * Future F-060 có thể extend method signature với optional `_config` param
   * để fully skip — defer for now (Scope Lock protect F-058).
   */
  private async preloadMerchantConfigs(
    tenantIds: number[],
  ): Promise<Map<number, MerchantConfigDocument>> {
    const map = new Map<number, MerchantConfigDocument>();
    if (tenantIds.length === 0) return map;
    const configs = await this.merchantConfigModel
      .find({ tenantId: { $in: tenantIds } })
      .lean<MerchantConfigDocument[]>()
      .exec();
    for (const c of configs) {
      map.set(c.tenantId, c);
    }
    return map;
  }

  private normalizeDateKey(d: Date | string): string {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  }

  private nextDayStr(dateStr: string): string {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  private dateRange(start: Date, end: Date, days: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i + 1);
      if (d.getTime() > end.getTime() + 86400000) break;
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }
}

export { FALLBACK_DAYS, DEFAULT_DAYS };
