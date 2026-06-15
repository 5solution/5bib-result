import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { env } from '../../../config';
import {
  IGLOO_LOCKS,
  IGLOO_LOCK_TTL_SEC,
} from '../igloo-insurance.constants';
import { IglooRequestService } from '../services/igloo-request.service';

/**
 * FEATURE-085 — Cron chọn + queue đơn tự động mỗi ngày (BR-IGL-02/05).
 * Gated bởi `IGLOO_DAILY_ENABLED` (default false = TẮT). SETNX lock theo ngày
 * chống double-fire (multi-instance). Port pattern ended-race-master-sync.cron.
 */
@Injectable()
export class IglooDailyCron {
  private readonly logger = new Logger(IglooDailyCron.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly requestService: IglooRequestService,
  ) {}

  @Cron(`0 ${env.igloo.cronHour} * * *`, {
    name: 'igloo-daily',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async tick(): Promise<void> {
    if (!env.igloo.dailyEnabled) {
      this.logger.log('[daily] IGLOO_DAILY_ENABLED=false — skip');
      return;
    }
    const ymd = new Date().toISOString().slice(0, 10);
    const key = IGLOO_LOCKS.daily(ymd);
    const acquired = await this.redis
      .set(key, '1', 'EX', IGLOO_LOCK_TTL_SEC.daily, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') {
      this.logger.log('[daily] lock held — skip');
      return;
    }
    try {
      const n = await this.requestService.selectAndQueueDaily(
        env.igloo.dailyCount,
      );
      this.logger.log(`[daily] queued ${n} đơn`);
    } catch (err) {
      this.logger.error(`[daily] FAILED: ${(err as Error).message}`);
    }
  }
}
