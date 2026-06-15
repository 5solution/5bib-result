import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import {
  IGLOO_LOCKS,
  IGLOO_LOCK_TTL_SEC,
  IGLOO_POLL_BATCH,
  IGLOO_STATUSES,
  IglooStatus,
} from '../igloo-insurance.constants';
import { IglooHttpService } from '../services/igloo-http.service';
import { IglooRequestService } from '../services/igloo-request.service';

/**
 * FEATURE-085 — Worker reconcile trạng thái đơn đã gửi (BR-IGL-10).
 * Poll Igloo cho đơn non-terminal có iglooRequestId → cập nhật.
 * KHÔNG cần kill-switch (chỉ GET — không phát sinh đơn mới).
 */
@Injectable()
export class IglooPollWorkerCron {
  private readonly logger = new Logger(IglooPollWorkerCron.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly http: IglooHttpService,
    private readonly requestService: IglooRequestService,
  ) {}

  @Cron('*/2 * * * *', { name: 'igloo-poll-worker' })
  async tick(): Promise<void> {
    const acquired = await this.redis
      .set(IGLOO_LOCKS.poll, '1', 'EX', IGLOO_LOCK_TTL_SEC.poll, 'NX')
      .catch(() => null);
    if (acquired !== 'OK') return;

    try {
      const docs = await this.requestService.getToPoll(IGLOO_POLL_BATCH);
      for (const doc of docs) {
        const id = String(doc._id);
        if (!doc.iglooRequestId) continue;
        try {
          const res = await this.http.getStatus(doc.iglooRequestId);
          const status = (IGLOO_STATUSES as readonly string[]).includes(
            res.status,
          )
            ? (res.status as IglooStatus)
            : 'PROCESSING';
          await this.requestService.applyStatus(
            id,
            status,
            res.gicContractNo,
            res.certificateUrl,
          );
        } catch (err) {
          this.logger.warn(
            `[poll] req=${doc.iglooRequestId} error: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      await this.redis.del(IGLOO_LOCKS.poll).catch(() => undefined);
    }
  }
}
