import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { env } from '../../../config';
import {
  IGLOO_LOCKS,
  IGLOO_LOCK_TTL_SEC,
  IGLOO_SUBMIT_BATCH,
} from '../igloo-insurance.constants';
import { IglooHttpService } from '../services/igloo-http.service';
import { IglooRequestService } from '../services/igloo-request.service';

/**
 * FEATURE-085 — Worker đẩy đơn QUEUED sang Igloo (BR-IGL-10).
 * Gated bởi `IGLOO_SUBMIT_ENABLED` (default false = KHÔNG egress). Đây là chốt
 * chặn an toàn cuối: dev luôn để false → không request nào rời backend.
 */
@Injectable()
export class IglooSubmitWorkerCron {
  private readonly logger = new Logger(IglooSubmitWorkerCron.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly http: IglooHttpService,
    private readonly requestService: IglooRequestService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'igloo-submit-worker' })
  async tick(): Promise<void> {
    if (!env.igloo.submitEnabled) return; // kill-switch — im lặng
    const acquired = await this.redis
      .set(IGLOO_LOCKS.submit, '1', 'EX', IGLOO_LOCK_TTL_SEC.submit, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') return;

    try {
      const docs = await this.requestService.getQueuedToSubmit(
        IGLOO_SUBMIT_BATCH,
      );
      if (!docs.length) return;
      this.logger.log(`[submit] ${docs.length} đơn QUEUED`);
      for (const doc of docs) {
        const id = String(doc._id);
        try {
          const res = await this.http.createRequest(doc.payloadSnapshot);
          await this.requestService.markSubmitted(id, res.iglooRequestId);
        } catch (err) {
          const msg = (err as Error).message ?? 'submit error';
          await this.requestService.markFailed(id, msg);
          this.logger.warn(`[submit] athlete=${doc.athletesId} FAILED: ${msg}`);
        }
      }
    } finally {
      await this.redis.del(IGLOO_LOCKS.submit).catch(() => undefined);
    }
  }
}
