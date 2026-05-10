import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DashboardSparklineService } from './sparkline.service';

/**
 * F-023 BR-DASH-05 — Hourly sparkline aggregator.
 *
 * Mỗi giờ chạy `DashboardSparklineService.refreshCache(30)` để cập nhật
 * 30-day daily aggregate vào Redis. SETNX lock `dashboard:cron-lock:sparkline`
 * TTL 3300s anti-stampede (port pattern `master:cron-lock:<raceId>`).
 *
 * Performance target: < 30s cho ~195 races/orders.
 */
@Injectable()
export class DashboardAggregatorCron {
  private readonly logger = new Logger(DashboardAggregatorCron.name);
  private static readonly LOCK_KEY = 'dashboard:cron-lock:sparkline';
  private static readonly LOCK_TTL_SECONDS = 3300;

  constructor(
    private readonly sparklineService: DashboardSparklineService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'dashboard-sparkline-aggregate' })
  async aggregate(): Promise<void> {
    const acquired = await this.acquireLock();
    if (!acquired) {
      this.logger.log('[dashboard-cron] sparkline lock busy, skip tick');
      return;
    }
    const start = Date.now();
    try {
      await this.sparklineService.refreshCache();
      const ms = Date.now() - start;
      this.logger.log(`[dashboard-cron] sparkline refresh OK in ${ms}ms`);
    } catch (e) {
      this.logger.error(
        `[dashboard-cron] sparkline refresh fail: ${(e as Error).message}`,
      );
    } finally {
      await this.releaseLock();
    }
  }

  private async acquireLock(): Promise<boolean> {
    try {
      const res = await this.redis.set(
        DashboardAggregatorCron.LOCK_KEY,
        String(Date.now()),
        'EX',
        DashboardAggregatorCron.LOCK_TTL_SECONDS,
        'NX',
      );
      return res === 'OK';
    } catch (e) {
      this.logger.warn(`acquire lock fail: ${(e as Error).message}`);
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.redis.del(DashboardAggregatorCron.LOCK_KEY);
    } catch (e) {
      this.logger.warn(`release lock fail: ${(e as Error).message}`);
    }
  }
}
