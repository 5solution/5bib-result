import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { KpiCardDto, KpiResponseDto } from '../dto/dashboard-response.dto';
import { FeeService } from '../../finance/services/fee.service';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../../merchant/schemas/merchant-config.schema';
import { OrderForFeeAggregate } from '../../finance/dto/fee-aggregate.dto';

/**
 * F-023 BR-DASH-01/02/04/21 — KPI MTD vs prev MTD.
 *
 * Bốn KPI cố định MVP:
 *  - GMV (gross merchandise value, MTD, exclude MANUAL orders)
 *  - Doanh thu net (sau discount)
 *  - VĐV đăng ký (count distinct user_id paid)
 *  - Phí 5BIB (platform fee đã thu trong MTD — F-059 cascade qua FeeService)
 *
 * Source-of-truth: bảng MySQL `order_metadata` (platform DB) — invariant
 * `financial_status='paid'`. GMV/net/athletes giữ exclude MANUAL (UX hiện
 * tại). Platform fee INCLUDE MANUAL (PAUSE-59-02 = B) — delegate sang
 * `FeeService.computeFeeForOrdersAggregate()` cascade 4 tier per-order
 * pro-rate.
 *
 * F-059 BR-59-01/02/09 — Cache key `dashboard:kpi:mtd` TTL 60s. Override
 * mutation flush `dashboard:kpi:*` (BR-59-06).
 *
 * Delta = (cur - prev) / prev × 100, làm tròn 1 chữ số. NULL khi prev=0 hoặc
 * cả hai = 0 (BR-DASH-02 → UI hiển thị "—").
 */
const KPI_CACHE_KEY = 'dashboard:kpi:mtd';
const KPI_CACHE_TTL_SECONDS = 60;

@Injectable()
export class DashboardKpiService {
  private readonly logger = new Logger(DashboardKpiService.name);

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
    private readonly feeService: FeeService,
    @InjectModel(MerchantConfig.name)
    private readonly merchantConfigModel: Model<MerchantConfigDocument>,
  ) {}

  async getMtdKpis(): Promise<KpiResponseDto> {
    // F-059 BR-59-09 — cache check (TTL 60s)
    const cached = await this.readCache();
    if (cached) return cached;

    const now = new Date();
    const periodStart = this.startOfMonth(now);
    const elapsedDays = Math.max(
      1,
      Math.floor((now.getTime() - periodStart.getTime()) / 86400000) + 1,
    );

    // Prev MTD = cùng số ngày của tháng trước (BR-DASH-01).
    const prevMonthStart = new Date(
      Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 1, 1),
    );
    const prevPeriodEnd = new Date(prevMonthStart);
    prevPeriodEnd.setUTCDate(prevPeriodEnd.getUTCDate() + elapsedDays);

    const curRange = {
      start: this.fmtDate(periodStart),
      end: this.fmtDateExclusive(now),
    };
    const prevRange = {
      start: this.fmtDate(prevMonthStart),
      end: this.fmtDate(prevPeriodEnd),
    };

    const [cur, prev] = await Promise.all([
      this.aggregateOrders(curRange.start, curRange.end),
      this.aggregateOrders(prevRange.start, prevRange.end),
    ]);

    const kpis: KpiCardDto[] = [
      this.toCard('gmv', 'GMV tháng này', cur.gmv, prev.gmv, 'vnd'),
      this.toCard('net', 'Doanh thu net', cur.net, prev.net, 'vnd'),
      this.toCard('athletes', 'VĐV đăng ký', cur.athletes, prev.athletes, 'count'),
      this.toCard(
        'platform_fee',
        'Phí 5BIB',
        cur.platformFee,
        prev.platformFee,
        'vnd',
      ),
    ];

    const result: KpiResponseDto = {
      kpis,
      period: 'mtd',
      periodStart: periodStart.toISOString(),
      prevPeriodStart: prevMonthStart.toISOString(),
    };

    await this.writeCache(result);
    return result;
  }

  /**
   * F-059 BR-59-01 — Aggregate paid orders trong khoảng [start, end).
   *
   * STEP 1: GMV/net/athletes SQL (exclude MANUAL — giữ UX semantic hiện tại).
   * STEP 2: Pull raw orders INCLUDE MANUAL via `pullOrdersForFeeAggregate`.
   * STEP 3: Pre-load `Map<tenantId, MerchantConfig>` 1 batch query (PAUSE-Coder-03 = A).
   * STEP 4: Per-tenant delegate `feeService.computeFeeForOrdersAggregate()` →
   *         sum totalFee. Cascade Tier 0 → 1 → 2 → 3 per-field per-order
   *         pro-rate (reuse F-058 zero modification).
   *
   * Platform fee có thể > `net × 5.5%` vì INCLUDE MANUAL fee VND-based
   * (PAUSE-59-02 = B). Đây là đúng business.
   */
  private async aggregateOrders(
    start: string,
    end: string,
  ): Promise<{ gmv: number; net: number; athletes: number; platformFee: number }> {
    try {
      // STEP 1 — Display GMV/net/athletes (exclude MANUAL, giữ UX)
      const [row] = await this.db.query(
        `SELECT
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) AS gmv,
          COALESCE(SUM(CASE WHEN order_category != 'MANUAL'
            THEN GREATEST(total_price - IFNULL(total_discounts, 0), 0)
            ELSE 0 END), 0) AS net,
          COUNT(DISTINCT CASE WHEN order_category != 'MANUAL' THEN user_id END) AS athletes
        FROM order_metadata
        WHERE financial_status = 'paid'
          AND payment_on >= ? AND payment_on < ?`,
        [start, end],
      );
      const gmv = Number(row?.gmv ?? 0);
      const net = Number(row?.net ?? 0);
      const athletes = Number(row?.athletes ?? 0);

      // STEP 2 — Pull raw orders INCLUDE MANUAL cho fee cascade
      const ordersByTenant = await this.pullOrdersForFeeAggregate(start, end);

      // STEP 3 — Pre-load MerchantConfig batch (PAUSE-Coder-03 = A mandatory)
      const tenantIds = Array.from(ordersByTenant.keys());
      const configMap = await this.preloadMerchantConfigs(tenantIds);

      // STEP 4 — Per-tenant FeeService delegation
      // F-059 hotfix 2026-05-24: inject pre-loaded config qua 4th arg để bypass
      // FeeService internal `findOne({tenantId}).lean()` (N+1 query fix).
      // Drop: KPI N findOne → 1 batch $in. Sparkline cũng dùng pattern này.
      let platformFee = 0;
      for (const [tenantId, orders] of ordersByTenant.entries()) {
        const result = await this.feeService.computeFeeForOrdersAggregate(
          tenantId,
          orders,
          { from: start, to: end },
          configMap.get(tenantId) ?? null,
        );
        platformFee += result.totalFee;
      }

      return { gmv, net, athletes, platformFee: Math.round(platformFee) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[F-059] KPI aggregate fail (${start}..${end}): ${msg}`);
      return { gmv: 0, net: 0, athletes: 0, platformFee: 0 };
    }
  }

  /**
   * F-059 BR-59-02 — Pull orders raw INCLUDE MANUAL group by tenant.
   *
   * Port pattern từ `analytics.service.ts:166-233` (PAUSE-Coder-01 = A —
   * duplicate có chủ ý, KHÔNG share helper cross-module per
   * conventions.md "duplication trumps premature abstraction").
   *
   * NOTE: `om.payment_on` (NOT `created_at`) — consistency với F-058 hotfix
   * v1.9.2 + Dashboard existing query semantic. Per BR-59-12.
   */
  private async pullOrdersForFeeAggregate(
    start: string,
    end: string,
  ): Promise<Map<number, OrderForFeeAggregate[]>> {
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
        createdAt: r.payment_on, // F-058 hotfix semantic — payment_on = effective date
        manualTicketCount:
          r.manual_ticket_count != null ? Number(r.manual_ticket_count) : undefined,
      });
      byTenant.set(tid, arr);
    }
    return byTenant;
  }

  /**
   * F-059 PAUSE-Coder-03 = A — Pre-load MerchantConfig batch query để giảm
   * N Mongo round-trip xuống 1. Helper expose `Map<tenantId, config>` cho
   * caller. KHÔNG modify FeeService signature (F-058 protected).
   *
   * Caller chỉ giữ Map làm cache layer trong scope request. Memoize không
   * cross-request.
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

  private async readCache(): Promise<KpiResponseDto | null> {
    try {
      const raw = await this.redis.get(KPI_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as KpiResponseDto;
    } catch (e) {
      this.logger.warn(`[F-059] KPI cache read fail: ${(e as Error).message}`);
      return null;
    }
  }

  private async writeCache(payload: KpiResponseDto): Promise<void> {
    try {
      await this.redis.set(
        KPI_CACHE_KEY,
        JSON.stringify(payload),
        'EX',
        KPI_CACHE_TTL_SECONDS,
      );
    } catch (e) {
      this.logger.warn(`[F-059] KPI cache write fail: ${(e as Error).message}`);
    }
  }

  private toCard(
    key: string,
    label: string,
    value: number,
    prevValue: number,
    unit: 'vnd' | 'count',
  ): KpiCardDto {
    const deltaPercent = this.computeDelta(value, prevValue);
    return { key, label, value, prevValue, deltaPercent, unit };
  }

  /**
   * BR-DASH-02 — chia 0 hoặc cả hai = 0 → NULL ("—" trên UI).
   */
  private computeDelta(cur: number, prev: number): number | null {
    if (prev === 0 || cur === 0) {
      if (cur === 0 && prev === 0) return null;
      // prev = 0, cur > 0 → tăng vô cùng, vẫn trả NULL để UI render "—" (đồng bộ design)
      if (prev === 0) return null;
    }
    return Math.round(((cur - prev) / prev) * 1000) / 10;
  }

  private startOfMonth(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private fmtDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private fmtDateExclusive(d: Date): string {
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  }
}
