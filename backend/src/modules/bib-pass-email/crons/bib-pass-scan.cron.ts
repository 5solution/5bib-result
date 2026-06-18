import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { env } from '../../../config';
import {
  BIB_PASS_LOCKS,
  BIB_PASS_LOCK_TTL_SEC,
} from '../bib-pass-email.constants';
import { BibPassConfigService } from '../bib-pass-config.service';
import { BibPassSenderService } from '../bib-pass-sender.service';

/**
 * FEATURE-091 — cron quét VĐV mới xác nhận BIB của các giải đang BẬT, gửi
 * Border Pass (idempotent). Gated bởi `BIB_PASS_SEND_ENABLED` (default false =
 * TẮT → dev/staging KHÔNG egress). SETNX lock chống double-fire (multi-instance).
 * Port pattern F-085 IglooDailyCron.
 */
@Injectable()
export class BibPassScanCron {
  private readonly logger = new Logger(BibPassScanCron.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: BibPassConfigService,
    private readonly senderService: BibPassSenderService,
  ) {}

  @Cron(env.bibPass.scanCron, {
    name: 'bib-pass-scan',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async tick(): Promise<void> {
    if (!env.bibPass.sendEnabled) {
      this.logger.log('[scan] BIB_PASS_SEND_ENABLED=false — skip');
      return;
    }
    const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const cronLock = BIB_PASS_LOCKS.cron(hourKey);
    const acquired = await this.redis
      .set(cronLock, '1', 'EX', BIB_PASS_LOCK_TTL_SEC.cron, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') {
      this.logger.log('[scan] cron lock held — skip');
      return;
    }

    const raceIds = await this.configService.listEnabledRaceIds();
    if (!raceIds.length) {
      this.logger.log('[scan] no enabled config — skip');
      return;
    }
    this.logger.log(`[scan] enabled races: ${raceIds.join(', ')}`);

    for (const raceId of raceIds) {
      const raceLock = BIB_PASS_LOCKS.scan(raceId);
      const got = await this.redis
        .set(raceLock, '1', 'EX', BIB_PASS_LOCK_TTL_SEC.scan, 'NX')
        .catch(() => null);
      if (got !== 'OK') {
        this.logger.log(`[scan] race=${raceId} lock held — skip`);
        continue;
      }
      try {
        const res = await this.senderService.sendBatch(raceId);
        if (res.attempted > 0) {
          this.logger.log(
            `[scan] race=${raceId} sent=${res.sent} failed=${res.failed} skipped=${res.skipped} hasMore=${res.hasMore}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `[scan] race=${raceId} FAILED: ${(err as Error).message}`,
        );
      } finally {
        await this.redis.del(raceLock).catch(() => undefined);
      }
    }
  }
}
