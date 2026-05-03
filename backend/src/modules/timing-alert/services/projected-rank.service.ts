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
 * - mongo_race_id null trong config → caller skip projected rank entirely
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
   * @param mongoRaceId Mongo race document `_id` (string) — required cho query
   *        race_results. Caller PHẢI check non-null trước khi gọi.
   * @param courseId Mongo course ID
   * @param ageGroup Athlete category (RR Category field) — null nếu không có
   * @param projectedFinishSeconds Seconds total dự đoán finish
   */
  async calculate(
    mongoRaceId: string,
    courseId: string,
    ageGroup: string | null,
    projectedFinishSeconds: number,
  ): Promise<ProjectedRankResult> {
    if (projectedFinishSeconds <= 0) {
      return { overallRank: null, ageGroupRank: null, confidence: 0, totalFinishers: 0 };
    }

    // Query all finishers cùng course, có chipTime hợp lệ.
    // Filter timingPoint case-insensitive (vendor: "Finish" / "FINISH").
    const finishers = await this.raceResultModel
      .find({
        raceId: mongoRaceId,
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

    // Confidence — match spec section 5: dựa % finished. Threshold 50.
    // < 50 finishers → linear scale. ≥ 50 → 1.0 (đủ data).
    const confidence = Math.min(
      1,
      totalFinishers / ProjectedRankService.CONFIDENCE_FINISHER_THRESHOLD,
    );

    return {
      overallRank,
      ageGroupRank,
      confidence: Math.round(confidence * 100) / 100, // 2 decimal
      totalFinishers,
    };
  }
}
