/**
 * F-019 — AnomalyDetectorService + ConfidenceScorerService unit tests.
 *
 * Coverage (8 cases):
 *  - Pattern A — confidence 0.9 / 0.6 / 0.3 buckets
 *  - Pattern B — DNF status conflict 0.95
 *  - Pattern C — DSQ pending re-check 0.7
 *  - Pattern D — CUTOFF marginal (margin < 2min = 0.85)
 *  - Pattern E — duplicate finish 0.9
 *  - Pattern F — wave start mismatch 0.85
 *  - Pattern G — pace impossibility (reuse F-010 paceBuffer)
 *  - BR-AG-21 compounding rule: combinedConfidence = max(individual)
 */

import { ConfidenceScorerService } from '../services/confidence-scorer.service';
import { AnomalyDetectorService } from '../services/anomaly-detector.service';
import { NormalizedAthlete } from '../services/normalize-vendor-quirks.service';

const baseAthlete: NormalizedAthlete = {
  bib: '1234',
  raceId: 'r',
  courseId: 'c',
  chipTimeMs: null,
  gunTimeMs: null,
  paceSecPerKm: null,
  status: 'LIVE',
  gender: 'M',
  hasFinishChipRead: false,
  lastSplitRank: null,
  lastSplitDistanceKm: null,
  lastSplitElapsedSec: null,
  splitsCount: 0,
  finishReadCount: 0,
  raw: {},
};

const scorer = new ConfidenceScorerService();
const detector = new AnomalyDetectorService(scorer);
const ctx = { raceDay: new Date('2026-05-09') };

describe('Pattern A — thiếu finish chip (BR-AG-11)', () => {
  it('lastSplitRank ≤ 3 → confidence 0.9 Mức 1 BLOCK', () => {
    const r = scorer.scorePatternA({
      ...baseAthlete,
      splitsCount: 4,
      lastSplitRank: 2,
    });
    expect(r?.confidence).toBeCloseTo(0.9);
    expect(r?.tier).toBe(1);
  });

  it('lastSplitRank ≤ 10 → confidence 0.6 Mức 2 FLAG', () => {
    const r = scorer.scorePatternA({
      ...baseAthlete,
      splitsCount: 4,
      lastSplitRank: 7,
    });
    expect(r?.confidence).toBeCloseTo(0.6);
    expect(r?.tier).toBe(2);
  });

  it('lastSplitRank > 10 → confidence 0.3 Mức 3 INFO', () => {
    const r = scorer.scorePatternA({
      ...baseAthlete,
      splitsCount: 4,
      lastSplitRank: 50,
    });
    expect(r?.confidence).toBeCloseTo(0.3);
    expect(r?.tier).toBe(3);
  });

  it('null when finish chip already present', () => {
    const r = scorer.scorePatternA({
      ...baseAthlete,
      hasFinishChipRead: true,
      chipTimeMs: 7200000,
      splitsCount: 4,
      lastSplitRank: 2,
    });
    expect(r).toBeNull();
  });
});

describe('Pattern B — DNF conflict (BR-AG-12)', () => {
  it('DNF status + has finish read → 0.95', () => {
    const r = scorer.scorePatternB({
      ...baseAthlete,
      status: 'DNF',
      chipTimeMs: 7200000,
      hasFinishChipRead: true,
    });
    expect(r?.confidence).toBeCloseTo(0.95);
    expect(r?.tier).toBe(1);
  });
});

describe('Pattern C — DSQ pending (BR-AG-13)', () => {
  it('reason chứa "đang xem xét" → 0.7 Mức 2', () => {
    const r = scorer.scorePatternC({
      ...baseAthlete,
      status: 'DSQ',
      dsqReasonText: 'Cần đang xem xét lại',
    });
    expect(r?.confidence).toBeCloseTo(0.7);
    expect(r?.tier).toBe(2);
  });

  it('null when reason không match keyword', () => {
    const r = scorer.scorePatternC({
      ...baseAthlete,
      status: 'DSQ',
      dsqReasonText: 'Final disqualification',
    });
    expect(r).toBeNull();
  });
});

describe('Pattern D — CUTOFF marginal (BR-AG-14)', () => {
  it('margin < 2 phút → 0.85 Mức 1', () => {
    // courseCutoff at 5h = 18000000ms; chipTime = 5h 1min = 18060000ms → margin 1min
    const r = scorer.scorePatternD(
      { ...baseAthlete, status: 'CUT', chipTimeMs: 18060000 },
      { ...ctx, courseCutoffMs: 18000000 },
    );
    expect(r?.confidence).toBeCloseTo(0.85);
    expect(r?.tier).toBe(1);
  });
});

describe('Pattern E — duplicate finish (BR-AG-15)', () => {
  it('finishReadCount > 1 → 0.9 Mức 1', () => {
    const r = scorer.scorePatternE({ ...baseAthlete, finishReadCount: 2 });
    expect(r?.confidence).toBeCloseTo(0.9);
    expect(r?.tier).toBe(1);
  });
});

describe('Pattern F — wave mismatch (BR-AG-17)', () => {
  it('discrepancy > 5min → 0.85 Mức 1', () => {
    // chip start at 0ms but expected wave at 600s = 600000ms.
    // diffMs = 0 - 600000 - 30000 = -630000 → discrepancy 630000ms / 60000 = 10.5min
    const r = scorer.scorePatternF(baseAthlete, {
      ...ctx,
      chipStartMsSinceStart: 0,
      expectedWaveStartMsSinceStart: 600000,
    });
    expect(r?.confidence).toBeCloseTo(0.85);
    expect(r?.tier).toBe(1);
  });
});

describe('Pattern G — pace impossibility (BR-AG-18)', () => {
  it('road pace 100 sec/km (sub 1:40/km — bất khả thi) → high confidence', () => {
    const r = scorer.scorePatternG(
      { ...baseAthlete, paceSecPerKm: 100, hasFinishChipRead: true, chipTimeMs: 1000000 },
      { ...ctx, courseType: 'road' },
    );
    expect(r?.confidence ?? 0).toBeGreaterThan(0.8);
    expect(r?.tier).toBe(1);
  });

  it('road pace 200 sec/km (3:20/km — elite plausible) → null', () => {
    const r = scorer.scorePatternG(
      { ...baseAthlete, paceSecPerKm: 200 },
      { ...ctx, courseType: 'road' },
    );
    expect(r).toBeNull();
  });
});

describe('detectAll + combinedConfidence (BR-AG-21)', () => {
  it('combines multiple patterns, returns max(individual) NOT sum', () => {
    const athlete: NormalizedAthlete = {
      ...baseAthlete,
      splitsCount: 4,
      lastSplitRank: 2, // Pattern A → 0.9
      finishReadCount: 2, // Pattern E → 0.9
    };
    const results = detector.detectAll(athlete, ctx);
    const combined = detector.combinedConfidence(results);
    expect(combined).toBeCloseTo(0.9);
    expect(combined).not.toBeCloseTo(1.8); // KHÔNG cộng dồn
  });

  it('returns blocking tier flag when at least 1 result tier=1', () => {
    const athlete = {
      ...baseAthlete,
      splitsCount: 4,
      lastSplitRank: 2,
    };
    const results = detector.detectAll(athlete, ctx);
    expect(detector.hasBlockingTier(results)).toBe(true);
  });
});

describe('confidence validation (BR-AG-20)', () => {
  it('clamps NaN → 0', () => {
    expect(scorer.validateConfidence(NaN)).toBe(false);
  });

  it('rejects out-of-range', () => {
    expect(scorer.validateConfidence(-0.1)).toBe(false);
    expect(scorer.validateConfidence(1.5)).toBe(false);
    expect(scorer.validateConfidence(0.5)).toBe(true);
  });
});
