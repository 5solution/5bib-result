import { Injectable } from '@nestjs/common';
import {
  PATTERN_A_THRESHOLDS,
  PATTERN_B_CONFIDENCE,
  PATTERN_C_CONFIDENCE,
  PATTERN_C_PENDING_REGEX,
  PATTERN_D_THRESHOLDS,
  PATTERN_E_CONFIDENCE,
  PATTERN_F_THRESHOLDS,
  PATTERN_G_LOWER_BOUNDS_SEC_PER_KM,
  TIER_THRESHOLDS,
  tierFromConfidence,
} from '../constants/awards-thresholds';
import { AnomalyPattern, Tier } from '../schemas/anomaly-warning.schema';
import { NormalizedAthlete } from './normalize-vendor-quirks.service';

export interface ScoreResult {
  pattern: AnomalyPattern;
  confidence: number;
  tier: Tier;
  evidence: Record<string, unknown>;
}

export interface ScoreContext {
  /** Race-day datetime for cutoff comparisons. */
  raceDay: Date;
  /** Course cutoff time as ms-since-start (optional). */
  courseCutoffMs?: number;
  /** Course type for pace-impossibility lower bound. */
  courseType?: 'road' | 'trail' | 'ultra' | 'half_marathon';
  /** F-010 paceBuffer (vendor pre-race expected pace × buffer = upper bound — used only as denom). */
  paceBuffer?: number;
  /** F-010 confidence_multiplier (used for Pattern G adjustment). */
  confidenceMultiplier?: number;
  /** Wave start expected (for Pattern F). */
  expectedWaveStartMsSinceStart?: number;
  /** Athlete-supplied wave start chip read (for Pattern F). */
  chipStartMsSinceStart?: number;
}

/**
 * F-019 BR-AG-11..18 — 7 confidence formulas A-G as pure functions.
 * Output ∈ [0.0, 1.0]. Each helper validates input + clamps output.
 */
@Injectable()
export class ConfidenceScorerService {
  private clamp(c: number): number {
    if (!Number.isFinite(c)) return 0;
    return Math.max(0, Math.min(1, c));
  }

  /** BR-AG-11 — Pattern A: thiếu đọc chip finish. */
  scorePatternA(athlete: NormalizedAthlete): ScoreResult | null {
    if (athlete.hasFinishChipRead) return null;
    if (athlete.splitsCount < 1) return null;
    if (
      athlete.status === 'DNF' ||
      athlete.status === 'DSQ' ||
      athlete.status === 'CUT'
    ) {
      return null;
    }
    const lastRank = athlete.lastSplitRank ?? Infinity;
    let confidence: number = PATTERN_A_THRESHOLDS.CONFIDENCE_LOW;
    if (lastRank <= PATTERN_A_THRESHOLDS.LAST_SPLIT_RANK_HIGH) {
      confidence = PATTERN_A_THRESHOLDS.CONFIDENCE_HIGH;
    } else if (lastRank <= PATTERN_A_THRESHOLDS.LAST_SPLIT_RANK_MED) {
      confidence = PATTERN_A_THRESHOLDS.CONFIDENCE_MED;
    }
    confidence = this.clamp(confidence);
    return {
      pattern: 'A',
      confidence,
      tier: tierFromConfidence(confidence),
      evidence: {
        reason: 'Thiếu finish chip read',
        lastSplitRank: athlete.lastSplitRank,
        splitsCount: athlete.splitsCount,
      },
    };
  }

  /** BR-AG-12 — Pattern B: DNF status conflict (status=DNF nhưng có finish read). */
  scorePatternB(athlete: NormalizedAthlete): ScoreResult | null {
    if (athlete.status !== 'DNF') return null;
    if (!athlete.hasFinishChipRead) return null;
    const confidence = this.clamp(PATTERN_B_CONFIDENCE);
    return {
      pattern: 'B',
      confidence,
      tier: tierFromConfidence(confidence),
      evidence: {
        reason: 'Status DNF nhưng có finish chip read',
        chipTimeMs: athlete.chipTimeMs,
      },
    };
  }

  /** BR-AG-13 — Pattern C: DSQ pending re-check. */
  scorePatternC(athlete: NormalizedAthlete): ScoreResult | null {
    if (athlete.status !== 'DSQ') return null;
    if (!athlete.dsqReasonText) return null;
    if (!PATTERN_C_PENDING_REGEX.test(athlete.dsqReasonText)) return null;
    const confidence = this.clamp(PATTERN_C_CONFIDENCE);
    return {
      pattern: 'C',
      confidence,
      tier: tierFromConfidence(confidence),
      evidence: {
        reason: 'DSQ reason chứa keyword pending/đang xem xét',
        dsqReasonExcerpt: athlete.dsqReasonText.slice(0, 200),
      },
    };
  }

  /** BR-AG-14 — Pattern D: CUTOFF marginal (giáp ranh). */
  scorePatternD(
    athlete: NormalizedAthlete,
    ctx: ScoreContext,
  ): ScoreResult | null {
    if (athlete.status !== 'CUT') return null;
    if (!ctx.courseCutoffMs || athlete.chipTimeMs == null) return null;
    const marginMs = athlete.chipTimeMs - ctx.courseCutoffMs;
    const marginMin = marginMs / 60_000;
    if (marginMin < 0) return null; // finished within cutoff — not a cutoff anomaly
    let confidence: number = PATTERN_D_THRESHOLDS.CONFIDENCE_FAR;
    if (marginMin < PATTERN_D_THRESHOLDS.MARGIN_TIGHT_MIN) {
      confidence = PATTERN_D_THRESHOLDS.CONFIDENCE_TIGHT;
    } else if (marginMin < PATTERN_D_THRESHOLDS.MARGIN_LOOSE_MIN) {
      confidence = PATTERN_D_THRESHOLDS.CONFIDENCE_LOOSE;
    }
    confidence = this.clamp(confidence);
    return {
      pattern: 'D',
      confidence,
      tier: tierFromConfidence(confidence),
      evidence: { reason: 'CUTOFF marginal', marginMin },
    };
  }

  /** BR-AG-15 — Pattern E: duplicate finish read. */
  scorePatternE(athlete: NormalizedAthlete): ScoreResult | null {
    if (athlete.finishReadCount <= 1) return null;
    const confidence = this.clamp(PATTERN_E_CONFIDENCE);
    return {
      pattern: 'E',
      confidence,
      tier: tierFromConfidence(confidence),
      evidence: {
        reason: 'Duplicate finish chip reads',
        finishReadCount: athlete.finishReadCount,
      },
    };
  }

  /** BR-AG-17 — Pattern F: wave start mismatch. */
  scorePatternF(
    _athlete: NormalizedAthlete,
    ctx: ScoreContext,
  ): ScoreResult | null {
    if (
      ctx.expectedWaveStartMsSinceStart == null ||
      ctx.chipStartMsSinceStart == null
    ) {
      return null;
    }
    const diffMs =
      ctx.chipStartMsSinceStart -
      ctx.expectedWaveStartMsSinceStart -
      PATTERN_F_THRESHOLDS.WAVE_START_TOLERANCE_SEC * 1000;
    if (diffMs >= 0) return null; // chip start within tolerance
    const discrepancyMin = Math.abs(diffMs) / 60_000;
    let confidence: number = PATTERN_F_THRESHOLDS.CONFIDENCE_LOW;
    if (discrepancyMin > PATTERN_F_THRESHOLDS.DISCREPANCY_HIGH_MIN) {
      confidence = PATTERN_F_THRESHOLDS.CONFIDENCE_HIGH;
    }
    confidence = this.clamp(confidence);
    return {
      pattern: 'F',
      confidence,
      tier: tierFromConfidence(confidence),
      evidence: { reason: 'Wave start mismatch', discrepancyMin },
    };
  }

  /** BR-AG-18 — Pattern G: pace impossibility. */
  scorePatternG(
    athlete: NormalizedAthlete,
    ctx: ScoreContext,
  ): ScoreResult | null {
    if (athlete.paceSecPerKm == null || athlete.paceSecPerKm <= 0) return null;
    const courseType = ctx.courseType ?? 'road';
    const lower = PATTERN_G_LOWER_BOUNDS_SEC_PER_KM[courseType];
    if (athlete.paceSecPerKm >= lower) return null; // pace plausible
    // Confidence scaled: how far below lower? 0–10% below = 0.5; 10-30% = 0.8; >30% = 0.95
    const ratio = athlete.paceSecPerKm / lower;
    let confidence = 0.5;
    if (ratio < 0.7) confidence = 0.95;
    else if (ratio < 0.9) confidence = 0.8;
    // Apply F-010 confidence multiplier if present (BR-AG-18 reuse F-010 paceBuffer/confidence).
    if (typeof ctx.confidenceMultiplier === 'number' && ctx.confidenceMultiplier > 0) {
      confidence = confidence * (1 + ctx.confidenceMultiplier * 0.1);
    }
    confidence = this.clamp(confidence);
    return {
      pattern: 'G',
      confidence,
      tier: tierFromConfidence(confidence),
      evidence: {
        reason: 'Pace impossibility',
        paceSecPerKm: athlete.paceSecPerKm,
        lowerBoundSecPerKm: lower,
        ratio,
      },
    };
  }

  /** Validation entrypoint (BR-AG-20). */
  validateConfidence(c: number): boolean {
    return Number.isFinite(c) && c >= 0 && c <= 1;
  }

  /** Re-export tier helper for clean external API. */
  tierFromConfidence(c: number): Tier {
    return tierFromConfidence(c);
  }

  static get THRESHOLDS() {
    return TIER_THRESHOLDS;
  }
}
