import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RaceResult,
  RaceResultDocument,
} from '../../race-result/schemas/race-result.schema';
import { parseTimeToSeconds } from '../utils/parsed-athlete';

export interface ProjectedRankResult {
  /** Overall rank projection (1-based, lower = better) */
  overallRank: number | null;
  /** Age group rank projection */
  ageGroupRank: number | null;
  /**
   * Confidence 0..1 dựa số athletes đã finish cùng course.
   * < 80% finished → confidence < 1.0 (early race day, ít data so sánh)
   */
  confidence: number;
  /** Total finishers used for ranking */
  totalFinishers: number;
}

/**
 * Phase 1B — projected rank calculator.
 *
 * Đọc `race_results` MongoDB collection (cùng app, cùng DB) → so sánh
 * `projectedFinishSeconds` với chipTime của athletes đã finish cùng course
 * + cùng age group → trả overall + age group rank projected.
 *
 * Module độc lập với MySQL — race_results đã được sync trước qua
 * `RaceSyncCron` (race-result module). Timing Alert KHÔNG sync, chỉ READ.
 *
 * **Edge cases:**
 * - race chưa có finishers → confidence=0, ranks=1 (athlete dự đoán đầu tiên)
 * - Course chưa có finisher (race vừa start) → confidence = 0, ranks = 1
 * - Athlete không có age group (gender-only race) → ageGroupRank = null
 */
@Injectable()
export class ProjectedRankService {
  private readonly logger = new Logger(ProjectedRankService.name);

  /**
   * Confidence threshold: trên ngưỡng này = high confidence (1.0).
   * Dưới = scaled tuyến tính. Match spec section 5 calc.
   */
  private static readonly CONFIDENCE_FINISHER_THRESHOLD = 50;

  constructor(
    @InjectModel(RaceResult.name)
    private readonly raceResultModel: Model<RaceResultDocument>,
  ) {}

  /**
   * Compute projected rank cho 1 athlete đang miss.
   *
   * @param raceId Mongo race document `_id` (string). Match RaceResult schema
   *        `raceId` field native — KHÔNG cần dual ID lookup.
   * @param courseId Mongo course ID
   * @param ageGroup Athlete category (RR Category field) — null nếu không có
   * @param projectedFinishSeconds Seconds total dự đoán finish
   */
  async calculate(
    raceId: string,
    courseId: string,
    ageGroup: string | null,
    projectedFinishSeconds: number,
    /**
     * F-010 BR-FC-15/17 — total registered athletes per race+course (countDocuments).
     * When omitted (legacy callers / 0), confidence falls back to absolute
     * threshold = 50 (matches pre-F-010 behavior).
     */
    totalRegistered?: number,
    /**
     * F-010 BR-FC-15/16 — confidence multiplier per race config (default 0.20).
     * `confidence = MIN(1, totalFinishers / (totalRegistered × multiplier))`.
     */
    confidenceMultiplier?: number,
  ): Promise<ProjectedRankResult> {
    if (projectedFinishSeconds <= 0) {
      return { overallRank: null, ageGroupRank: null, confidence: 0, totalFinishers: 0 };
    }

    // Query all finishers cùng course, có chipTime hợp lệ.
    // Filter timingPoint case-insensitive (vendor: "Finish" / "FINISH").
    const finishers = await this.raceResultModel
      .find({
        raceId,
        courseId,
        timingPoint: { $regex: /^finish$/i },
        chipTime: { $nin: ['', null] },
      })
      .select({ chipTime: 1, category: 1 })
      .lean<Array<{ chipTime: string; category: string | null }>>()
      .exec();

    const totalFinishers = finishers.length;
    if (totalFinishers === 0) {
      // Race đầu giờ — chưa có finisher. Trả rank=1 để caller có signal
      // "athlete dự đoán là finisher đầu tiên" với confidence=0.
      return {
        overallRank: 1,
        ageGroupRank: ageGroup ? 1 : null,
        confidence: 0,
        totalFinishers: 0,
      };
    }

    // Convert chipTime strings → seconds (parse cả "HH:MM:SS" + "MM:SS")
    const finisherSeconds = finishers
      .map((f) => ({
        seconds: parseTimeToSeconds(f.chipTime),
        category: f.category,
      }))
      .filter(
        (f): f is { seconds: number; category: string | null } =>
          f.seconds !== null && f.seconds > 0,
      );

    // Overall rank: 1 + count(finishers faster than projected)
    const overallFaster = finisherSeconds.filter(
      (f) => f.seconds < projectedFinishSeconds,
    ).length;
    const overallRank = overallFaster + 1;

    // Age group rank: same comparison nhưng filter category match
    let ageGroupRank: number | null = null;
    if (ageGroup) {
      const sameAgGroup = finisherSeconds.filter(
        (f) => f.category === ageGroup,
      );
      const ageFaster = sameAgGroup.filter(
        (f) => f.seconds < projectedFinishSeconds,
      ).length;
      ageGroupRank = ageFaster + 1;
    }

    // F-010 BR-FC-15/16/17 — confidence formula change:
    //   confidence = MIN(1, totalFinishers / (totalRegistered × multiplier))
    // Falls back to absolute threshold (50) when totalRegistered is missing or 0
    // (matches pre-F-010 behavior — backward compat for legacy callers).
    //
    // Why this matters: pre-F-010, race with 500 registered would hit confidence=1
    // when only 50 athletes finished (10% completion → claim "high confidence").
    // Post-F-010 with default multiplier 0.20: same race needs 100 finishers
    // (20% completion) for confidence=1. More accurate signal for projection trust.
    const multiplier = confidenceMultiplier ?? 0.20;
    const threshold =
      typeof totalRegistered === 'number' && totalRegistered > 0
        ? totalRegistered * multiplier
        : ProjectedRankService.CONFIDENCE_FINISHER_THRESHOLD;
    const confidence = Math.min(
      1,
      totalFinishers / Math.max(threshold, 1),
    );

    return {
      overallRank,
      ageGroupRank,
      confidence: Math.round(confidence * 100) / 100, // 2 decimal
      totalFinishers,
    };
  }
}
