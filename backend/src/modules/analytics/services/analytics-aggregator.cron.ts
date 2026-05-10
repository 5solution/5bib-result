import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { RepeatAthleteService } from './repeat-athlete.service';
import { MerchantChurnService } from './merchant-churn.service';
import { TimeToFillService } from './time-to-fill.service';
import { ClaimRateService } from './claim-rate.service';
import { GeographicDemographicService } from './geographic-demographic.service';
import { RefundCancelService } from './refund-cancel.service';

/**
 * F-026 BR-ANALYTICS-09 — hourly aggregator pre-warm 6 metric F-026.
 *
 * SETNX lock `analytics:cron-lock:hourly` TTL 3300s tránh duplicate run
 * cross-instance. Mỗi metric chạy isolated qua Promise.allSettled — fail
 * 1 metric không block các metric khác.
 */
@Injectable()
export class AnalyticsAggregatorCron {
  private readonly logger = new Logger(AnalyticsAggregatorCron.name);
  private readonly LOCK_KEY = 'analytics:cron-lock:hourly';
  private readonly LOCK_TTL = 3300;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly repeatAthlete: RepeatAthleteService,
    private readonly merchantChurn: MerchantChurnService,
    private readonly timeToFill: TimeToFillService,
    private readonly claimRate: ClaimRateService,
    private readonly geoDemo: GeographicDemographicService,
    private readonly refundCancel: RefundCancelService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'f026-analytics-hourly' })
  async runHourly(): Promise<void> {
    const acquired = await this.acquireLock();
    if (!acquired) {
      this.logger.log('Skip hourly — lock đã có instance khác');
      return;
    }

    const start = Date.now();
    try {
      const results = await Promise.allSettled([
        this.safeRun('repeat-athlete', () => this.repeatAthlete.aggregate()),
        this.safeRun('merchant-churn', () => this.merchantChurn.aggregate()),
        this.safeRun('time-to-fill', () => this.timeToFill.aggregate()),
        this.safeRun('claim-rate', () => this.claimRate.aggregate()),
        this.safeRun('geographic-demographic', () => this.geoDemo.aggregate()),
        this.safeRun('refund-cancel', () => this.refundCancel.aggregate()),
      ]);

      const failed = results.filter((r) => r.status === 'rejected').length;
      this.logger.log(
        `F-026 hourly aggregate done — ${results.length - failed}/${results.length} OK, ${Date.now() - start}ms`,
      );
    } finally {
      await this.releaseLock();
    }
  }

  private async safeRun(name: string, fn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await fn();
      this.logger.log(`[${name}] aggregate OK ${Date.now() - start}ms`);
    } catch (e) {
      this.logger.error(`[${name}] aggregate FAIL: ${(e as Error).message}`);
      throw e;
    }
  }

  private async acquireLock(): Promise<boolean> {
    try {
      const r = await this.redis.set(
        this.LOCK_KEY,
        '1',
        'EX',
        this.LOCK_TTL,
        'NX',
      );
      return r === 'OK';
    } catch (e) {
      this.logger.warn(`lock acquire fail: ${(e as Error).message}`);
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.redis.del(this.LOCK_KEY);
    } catch (e) {
      this.logger.warn(`lock release fail: ${(e as Error).message}`);
    }
  }
}
