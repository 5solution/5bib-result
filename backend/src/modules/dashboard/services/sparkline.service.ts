import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import {
  SparklinePointDto,
  SparklineSeriesDto,
  SparklinesResponseDto,
} from '../dto/dashboard-response.dto';

/**
 * F-023 BR-DASH-05 — Sparkline 30 ngày daily aggregate.
 *
 * Source: bảng `order_metadata` (MySQL platform DB), `financial_status='paid'`,
 * exclude `MANUAL`. Cron `EVERY_HOUR` (DashboardAggregatorCron) sẽ tính lại +
 * cache `dashboard:sparklines:30d` TTL 1 giờ. Endpoint chỉ đọc cache; nếu cache
 * miss (cron chưa chạy lần nào) thì compute on-demand và cache.
 */
const CACHE_KEY = 'dashboard:sparklines:30d';
const CACHE_TTL_SECONDS = 3600;
const DEFAULT_DAYS = 30;

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
      this.logger.warn(`Sparkline cache read fail: ${(e as Error).message}`);
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
      this.logger.warn(`Sparkline cache write fail: ${(e as Error).message}`);
    }
  }

  private async compute(days: number): Promise<SparklinesResponseDto> {
    const today = new Date();
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - days);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

    const rows = await this.queryDaily(startStr, endStr).catch((e) => {
      this.logger.warn(`Sparkline compute fail: ${(e as Error).message}`);
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
      dateMap.set(r.d, {
        gmv: Number(r.gmv ?? 0),
        net: Number(r.net ?? 0),
        athletes: Number(r.athletes ?? 0),
      });
    }

    // Backfill 30 điểm liên tục — ngày không có order = 0.
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
      feePoints.push({ date, value: Math.round(v.net * 0.055) });
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
