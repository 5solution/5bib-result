import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import {
  resolvePeriod,
  buildMetricCacheKey,
  PeriodKind,
} from './period-resolver';
import {
  RefundCancelResponseDto,
  RateTrendPointDto,
} from '../dto/refund-cancel.dto';

/**
 * F-026 BR-ANALYTICS-20/21 — Refund + Cancel Rate.
 *
 * refundRate = refunded / total × 100
 * cancelRate = cancelled / total × 100
 * total = paid + voided + refunded + cancelled (non-pending).
 *
 * BR-04: race draft loại qua JOIN races.
 */
@Injectable()
export class RefundCancelService {
  private readonly logger = new Logger(RefundCancelService.name);
  private readonly TTL = 3600;

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getRefundCancel(params: {
    period: PeriodKind;
    from?: string;
    to?: string;
    raceId?: string;
  }): Promise<RefundCancelResponseDto> {
    const current = resolvePeriod({
      kind: params.period,
      from: params.from,
      to: params.to,
    });

    const scope =
      params.raceId != null
        ? ({ raceId: params.raceId } as const)
        : ('platform' as const);
    const cacheKey = buildMetricCacheKey(
      'refund-cancel-rate',
      scope,
      current.periodKey,
    );

    const cached = await this.readCache<RefundCancelResponseDto>(cacheKey);
    if (cached) return cached;

    const raceFilter = params.raceId ? 'AND r.race_id = ?' : '';
    const sqlParams: Array<string | number> = [
      current.fromIso,
      current.toIso,
    ];
    if (params.raceId) sqlParams.push(Number(params.raceId));

    const rows: Array<{ status: string; cnt: number }> = await this.db.query(
      `
      SELECT om.financial_status AS status, COUNT(*) AS cnt
      FROM order_metadata om
      JOIN races r ON r.race_id = om.race_id
      WHERE r.status != 'draft'
        AND r.is_delete = 0
        AND om.payment_on >= ?
        AND om.payment_on < ?
        ${raceFilter}
      GROUP BY om.financial_status
      `,
      sqlParams,
    );

    let paid = 0;
    let refunded = 0;
    let cancelled = 0;
    let voided = 0;
    for (const r of rows) {
      const c = Number(r.cnt) || 0;
      if (r.status === 'paid') paid += c;
      else if (r.status === 'refunded') refunded += c;
      else if (r.status === 'cancelled') cancelled += c;
      else if (r.status === 'voided') voided += c;
    }
    const total = paid + refunded + cancelled + voided;
    const refundRate =
      total > 0 ? Math.round((refunded / total) * 10000) / 100 : 0;
    const cancelRate =
      total > 0 ? Math.round((cancelled / total) * 10000) / 100 : 0;

    const refundTrend = await this.computeTrend(
      current.fromIso,
      current.toIso,
      'refunded',
      params.raceId,
    );
    const cancelTrend = await this.computeTrend(
      current.fromIso,
      current.toIso,
      'cancelled',
      params.raceId,
    );

    const response: RefundCancelResponseDto = {
      totalOrders: total,
      refundedOrders: refunded,
      cancelledOrders: cancelled,
      refundRate,
      cancelRate,
      refundOverThreshold: refundRate > 3,
      refundTrend,
      cancelTrend,
    };
    await this.writeCache(cacheKey, response);
    return response;
  }

  async aggregate(): Promise<void> {
    await this.getRefundCancel({ period: 'quarter' });
  }

  private async computeTrend(
    fromIso: string,
    toIso: string,
    status: 'refunded' | 'cancelled',
    raceId?: string,
  ): Promise<RateTrendPointDto[]> {
    const raceFilter = raceId ? 'AND r.race_id = ?' : '';
    const params: Array<string | number> = [fromIso, toIso];
    if (raceId) params.push(Number(raceId));

    const rows: Array<{ bucket: string; matched: number; total: number }> =
      await this.db.query(
        `
        SELECT DATE_FORMAT(om.payment_on, '%Y-%m') AS bucket,
               SUM(CASE WHEN om.financial_status = ? THEN 1 ELSE 0 END) AS matched,
               COUNT(*) AS total
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        WHERE r.status != 'draft'
          AND r.is_delete = 0
          AND om.payment_on >= ?
          AND om.payment_on < ?
          ${raceFilter}
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        [status, ...params],
      );

    return rows.map((r) => ({
      bucket: r.bucket,
      rate:
        Number(r.total) > 0
          ? Math.round((Number(r.matched) / Number(r.total)) * 10000) / 100
          : 0,
    }));
  }

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      const v = await this.redis.get(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch (e) {
      this.logger.warn(`redis get fail ${key}: ${e}`);
      return null;
    }
  }

  private async writeCache<T>(key: string, value: T): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', this.TTL);
    } catch (e) {
      this.logger.warn(`redis set fail ${key}: ${e}`);
    }
  }
}
