import { Injectable } from '@nestjs/common';
import {
  PREDICTED_RANK_DISPLAY_TOP_N,
  PREDICTED_RANK_ERROR_MARGIN_MIN,
} from '../constants/awards-thresholds';
import { NormalizedAthlete } from './normalize-vendor-quirks.service';
import { AthleteForRanking } from './ag-bracket-calc.service';

export interface PredictedRankItem {
  athleteId: string;
  bib: string;
  name?: string;
  courseId: string;
  ageGroup: string;
  gender: string;
  predictedRank: number;
  estimatedFinishSec: number;
  remainingKm: number;
  lastSplitDistanceKm: number;
  errorMarginMin: number;
  pattern: 'A';
  confidence: number;
}

export interface PredictionInput {
  athlete: NormalizedAthlete;
  /** Athletes already in this AG bucket (sorted by chipTimeMs ASC). */
  bucketAthletes: AthleteForRanking[];
  ageGroup: string;
  totalDistanceKm: number;
  raceType: 'marathon' | 'half_marathon' | 'ultra_trail' | 'default';
  /** Confidence carried over from Pattern A scorer. */
  patternConfidence: number;
}

/**
 * F-019 BR-AG-29..32 — Section B §5 algorithm.
 *
 * Compute virtual finish time = lastSplitElapsed + remainingKm × avgPace.
 * Insert virtual athlete into AG bucket sorted list, find rank.
 * Filter to predictedRank ≤ top-3 (BR-AG-29 LOCKED).
 */
@Injectable()
export class PredictedRankService {
  predictForAthlete(input: PredictionInput): PredictedRankItem | null {
    const { athlete, bucketAthletes, ageGroup, totalDistanceKm, raceType } =
      input;
    if (athlete.hasFinishChipRead) return null; // already finished
    if (athlete.lastSplitDistanceKm == null || athlete.lastSplitElapsedSec == null) {
      return null;
    }
    if (athlete.lastSplitDistanceKm <= 0 || athlete.lastSplitElapsedSec <= 0) {
      return null;
    }
    if (totalDistanceKm <= athlete.lastSplitDistanceKm) return null;

    const avgPaceSecPerKm =
      athlete.lastSplitElapsedSec / athlete.lastSplitDistanceKm;
    const remainingKm = totalDistanceKm - athlete.lastSplitDistanceKm;
    const estimatedFinishSec =
      athlete.lastSplitElapsedSec + remainingKm * avgPaceSecPerKm;
    const estimatedFinishMs = estimatedFinishSec * 1000;

    // Build virtual + bucket sorted list.
    const sortedTimes = [
      ...bucketAthletes
        .filter((a) => a.chipTimeMs != null && a.chipTimeMs > 0)
        .map((a) => ({ bib: a.bib, t: a.chipTimeMs as number, virtual: false })),
      { bib: athlete.bib, t: estimatedFinishMs, virtual: true },
    ].sort((a, b) => a.t - b.t);

    const idx = sortedTimes.findIndex((x) => x.virtual);
    const predictedRank = idx >= 0 ? idx + 1 : -1;
    if (predictedRank < 1) return null;

    // BR-AG-29 — only display ≤ top-3.
    if (predictedRank > PREDICTED_RANK_DISPLAY_TOP_N) return null;

    return {
      athleteId: athlete.raceId + ':' + athlete.bib, // synthetic id (no PII)
      bib: athlete.bib,
      name: athlete.name,
      courseId: athlete.courseId,
      ageGroup,
      gender: athlete.gender ?? 'M',
      predictedRank,
      estimatedFinishSec,
      remainingKm,
      lastSplitDistanceKm: athlete.lastSplitDistanceKm,
      errorMarginMin: PREDICTED_RANK_ERROR_MARGIN_MIN[raceType] ??
        PREDICTED_RANK_ERROR_MARGIN_MIN.default,
      pattern: 'A',
      confidence: input.patternConfidence,
    };
  }
}
