import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model, Types } from 'mongoose';
import {
  AnomalyWarning,
  AnomalyWarningDocument,
} from '../schemas/anomaly-warning.schema';
import {
  PODIUM_STATES,
  Podium,
  PodiumDocument,
  PodiumState,
} from '../schemas/podium.schema';
import { REDIS_TTL } from '../constants/awards-thresholds';
import { PodiumStateUpdateDto } from '../dto/podium-state-update.dto';

/**
 * F-019 BR-AG-23 — forward-only matrix.
 * Pattern verbatim port từ F-018 medical-incident TRANSITION_MATRIX.
 */
export const PODIUM_VALID_TRANSITIONS: Record<PodiumState, PodiumState[]> = {
  RAW_RESULT: ['AG_COMPUTED'],
  AG_COMPUTED: ['WARNINGS_GENERATED'],
  WARNINGS_GENERATED: ['BTC_REVIEW'],
  BTC_REVIEW: ['PODIUM_DRAFT'],
  PODIUM_DRAFT: ['PODIUM_LOCKED'],
  PODIUM_LOCKED: ['PODIUM_PUBLISHED'],
  PODIUM_PUBLISHED: ['DISPUTE_OPEN', 'PODIUM_FINAL'],
  DISPUTE_OPEN: ['AG_COMPUTED'],
  PODIUM_FINAL: [],
};

@Injectable()
export class PodiumStateMachineService {
  private readonly logger = new Logger(PodiumStateMachineService.name);

  constructor(
    @InjectModel(Podium.name)
    private readonly podiumModel: Model<PodiumDocument>,
    @InjectModel(AnomalyWarning.name)
    private readonly warningModel: Model<AnomalyWarningDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** BR-AG-23 — pure helper for testing. Forward-only check. */
  static isValidTransition(from: PodiumState, to: PodiumState): boolean {
    const allowed = PODIUM_VALID_TRANSITIONS[from] ?? [];
    return allowed.includes(to);
  }

  static getAllowedTransitions(from: PodiumState): PodiumState[] {
    return [...(PODIUM_VALID_TRANSITIONS[from] ?? [])];
  }

  /**
   * Forward state transition with concurrent-write guard (BR-AG-23/24/25).
   * - SETNX lock 5s (port pattern F-018 medical:incident-lock).
   * - Atomic findOneAndUpdate({_id, raceId, state: from}, ...) optimistic lock.
   * - Audit trail $push only (BR-AG-28 — pattern verbatim từ F-018).
   * - 409 Conflict on backward / wrong-source-state / lock-contention.
   */
  async transition(
    raceId: string,
    podiumId: string,
    dto: PodiumStateUpdateDto,
    actorId: string,
  ): Promise<PodiumDocument> {
    if (!Types.ObjectId.isValid(podiumId)) {
      throw new NotFoundException();
    }

    const lockKey = `awards:state-lock:${podiumId}`;
    const acquired = await this.redis.set(
      lockKey,
      actorId,
      'EX',
      REDIS_TTL.STATE_LOCK,
      'NX',
    );
    if (!acquired) {
      throw new ConflictException(
        'Bục trao giải đang được cập nhật bởi người khác — thử lại sau vài giây',
      );
    }

    try {
      const podium = await this.podiumModel.findOne({ _id: podiumId, raceId });
      if (!podium) throw new NotFoundException();

      const fromState = podium.state;
      const toState = dto.toState;

      if (!PodiumStateMachineService.isValidTransition(fromState, toState)) {
        throw new ConflictException(
          `Chuyển trạng thái không hợp lệ: ${fromState} → ${toState}. Forward-only enforced.`,
        );
      }

      // BR-AG-24 — gate BTC_REVIEW → PODIUM_DRAFT yêu cầu mọi Mức 1 đã resolved.
      if (fromState === 'BTC_REVIEW' && toState === 'PODIUM_DRAFT') {
        const blocking = await this.warningModel.countDocuments({
          raceId,
          courseId: podium.courseId,
          tier: 1,
          resolution: 'pending',
        });
        if (blocking > 0) {
          throw new ConflictException(
            `Còn ${blocking} cảnh báo Mức 1 chưa resolve — không thể chuyển sang DRAFT`,
          );
        }
      }

      // BR-AG-25 — gate PODIUM_DRAFT → PODIUM_LOCKED yêu cầu mọi Mức 2 đã ack.
      if (fromState === 'PODIUM_DRAFT' && toState === 'PODIUM_LOCKED') {
        const unacked = await this.warningModel.countDocuments({
          raceId,
          courseId: podium.courseId,
          tier: 2,
          ackedAt: { $exists: false },
          resolution: 'pending',
        });
        if (unacked > 0) {
          throw new ConflictException(
            `Còn ${unacked} cảnh báo Mức 2 chưa acknowledge — không thể lock`,
          );
        }
      }

      const now = new Date();
      const transition = {
        fromState,
        toState,
        actorId,
        at: now,
        note: dto.note,
        evidenceUrl: dto.evidenceUrl,
      };

      const $set: Record<string, unknown> = { state: toState };
      if (toState === 'PODIUM_LOCKED') $set.lockedAt = now;
      if (toState === 'PODIUM_PUBLISHED') $set.publishedAt = now;
      if (toState === 'DISPUTE_OPEN') $set.disputedAt = now;
      if (toState === 'PODIUM_FINAL') $set.finalAt = now;
      if (toState === 'AG_COMPUTED') $set.computedAt = now;

      const updated = await this.podiumModel.findOneAndUpdate(
        { _id: podiumId, raceId, state: fromState },
        {
          $set,
          $push: { stateHistory: transition },
        },
        { new: true },
      );

      if (!updated) {
        throw new ConflictException(
          'Bục trao giải đã thay đổi trạng thái — refresh và thử lại',
        );
      }

      this.logger.log(
        `[awards] state ${fromState} → ${toState} podium=${podiumId} actor=${actorId}`,
      );

      // Cache invalidation (BR-AG admin manual refresh + 60s TTL).
      await this.invalidateCache(raceId, podium.courseId);

      return updated;
    } finally {
      await this.redis.del(lockKey).catch(() => undefined);
    }
  }

  private async invalidateCache(raceId: string, courseId: string): Promise<void> {
    const keys = [
      `awards:race:${raceId}:podium:${courseId}`,
      `awards:race:${raceId}:anomalies`,
    ];
    await this.redis.del(...keys).catch(() => undefined);
  }
}
