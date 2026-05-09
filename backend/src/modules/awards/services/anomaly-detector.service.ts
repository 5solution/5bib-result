import { Injectable } from '@nestjs/common';
import { AnomalyPattern } from '../schemas/anomaly-warning.schema';
import {
  ConfidenceScorerService,
  ScoreContext,
  ScoreResult,
} from './confidence-scorer.service';
import { NormalizedAthlete } from './normalize-vendor-quirks.service';

/**
 * F-019 BR-AG-11..21 — orchestrator runs all 7 patterns and applies BR-AG-21
 * compounding rule (max of individual confidences, KHÔNG cộng dồn).
 */
@Injectable()
export class AnomalyDetectorService {
  constructor(private readonly scorer: ConfidenceScorerService) {}

  detectAll(
    athlete: NormalizedAthlete,
    ctx: ScoreContext,
  ): ScoreResult[] {
    const candidates: (ScoreResult | null)[] = [
      this.scorer.scorePatternA(athlete),
      this.scorer.scorePatternB(athlete),
      this.scorer.scorePatternC(athlete),
      this.scorer.scorePatternD(athlete, ctx),
      this.scorer.scorePatternE(athlete),
      this.scorer.scorePatternF(athlete, ctx),
      this.scorer.scorePatternG(athlete, ctx),
    ];
    const results = candidates.filter((c): c is ScoreResult => c != null);
    // BR-AG-20 — validate confidence range; reject malformed (defensive).
    return results.filter((r) => this.scorer.validateConfidence(r.confidence));
  }

  /**
   * BR-AG-21 — when multiple patterns trigger for cùng 1 athlete,
   * combined confidence = max(individual). KHÔNG cộng dồn.
   */
  combinedConfidence(results: ScoreResult[]): number {
    if (!results.length) return 0;
    return results.reduce(
      (acc, r) => (r.confidence > acc ? r.confidence : acc),
      0,
    );
  }

  hasBlockingTier(results: ScoreResult[]): boolean {
    return results.some((r) => r.tier === 1);
  }

  groupByPattern(
    results: ScoreResult[],
  ): Record<AnomalyPattern, ScoreResult[]> {
    const out: Record<AnomalyPattern, ScoreResult[]> = {
      A: [],
      B: [],
      C: [],
      D: [],
      E: [],
      F: [],
      G: [],
      H: [], // F-019 v2 — VENDOR_MISMATCH (5BIB vs vendor top-3 cross-check)
    };
    for (const r of results) {
      out[r.pattern].push(r);
    }
    return out;
  }
}
