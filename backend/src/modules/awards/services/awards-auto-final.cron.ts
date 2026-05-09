import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Podium, PodiumDocument } from '../schemas/podium.schema';
import { PUBLISHED_TO_FINAL_MS } from '../constants/awards-thresholds';

/**
 * F-019 BR-AG-26 — auto-transition PUBLISHED → FINAL after 30 phút if no DISPUTE.
 *
 * Mỗi tick scan podiums ở state=PODIUM_PUBLISHED có publishedAt > 30 phút.
 * Atomic findOneAndUpdate với optimistic lock state=PUBLISHED → state=FINAL.
 * Audit trail $push (BR-AG-28).
 */
@Injectable()
export class AwardsAutoFinalCron {
  private readonly logger = new Logger(AwardsAutoFinalCron.name);

  constructor(
    @InjectModel(Podium.name)
    private readonly podiumModel: Model<PodiumDocument>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    const cutoff = new Date(Date.now() - PUBLISHED_TO_FINAL_MS);
    const candidates = await this.podiumModel
      .find({
        state: 'PODIUM_PUBLISHED',
        publishedAt: { $lt: cutoff },
      })
      .limit(50)
      .lean();
    if (!candidates.length) return;
    let promoted = 0;
    for (const c of candidates) {
      const updated = await this.podiumModel.findOneAndUpdate(
        { _id: (c as unknown as { _id: unknown })._id, state: 'PODIUM_PUBLISHED' },
        {
          $set: { state: 'PODIUM_FINAL', finalAt: new Date() },
          $push: {
            stateHistory: {
              fromState: 'PODIUM_PUBLISHED',
              toState: 'PODIUM_FINAL',
              actorId: 'system:cron',
              at: new Date(),
              note: 'Auto-FINAL after 30-min dispute window',
            },
          },
        },
        { new: true },
      );
      if (updated) promoted += 1;
    }
    if (promoted > 0) {
      this.logger.log(`[awards-cron] auto-FINAL promoted ${promoted} podiums`);
    }
  }
}
