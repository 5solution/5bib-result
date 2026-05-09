/**
 * F-019 — PredictedRankService unit tests.
 *
 * Coverage (5 cases):
 *  - happy: BR-AG-30 algorithm matches Section B §5
 *  - filter: returns null when athlete already has finish chip
 *  - filter: returns null when no lastSplit info
 *  - BR-AG-29: only display ≤ top-3 (predictedRank=4 → null)
 *  - BR-AG-31: error margin scales with race type
 */

import { PredictedRankService } from '../services/predicted-rank.service';
import { NormalizedAthlete } from '../services/normalize-vendor-quirks.service';
import { AthleteForRanking } from '../services/ag-bracket-calc.service';

const svc = new PredictedRankService();

const athleteAtSplit = (overrides: Partial<NormalizedAthlete> = {}): NormalizedAthlete => ({
  bib: '1234',
  name: 'Test',
  raceId: 'r',
  courseId: 'c',
  chipTimeMs: null,
  gunTimeMs: null,
  paceSecPerKm: null,
  status: 'LIVE',
  gender: 'M',
  hasFinishChipRead: false,
  lastSplitRank: 2,
  lastSplitDistanceKm: 30,
  lastSplitElapsedSec: 9000, // 2h30 at 30km → ~5min/km
  splitsCount: 5,
  finishReadCount: 0,
  raw: {},
  ...overrides,
});

describe('PredictedRankService.predictForAthlete (BR-AG-30)', () => {
  it('returns null when virtual finish would land outside top-3 (BR-AG-29 LOCKED)', () => {
    const athlete = athleteAtSplit();
    const bucket: AthleteForRanking[] = [
      { bib: '1', gender: 'M', chipTimeMs: 7100000, gunTimeMs: 7100000 }, // 1h58
      { bib: '2', gender: 'M', chipTimeMs: 7300000, gunTimeMs: 7300000 }, // 2h01
      { bib: '3', gender: 'M', chipTimeMs: 7600000, gunTimeMs: 7600000 }, // 2h06
    ];
    const result = svc.predictForAthlete({
      athlete,
      bucketAthletes: bucket,
      ageGroup: '30-39',
      totalDistanceKm: 42,
      raceType: 'marathon',
      patternConfidence: 0.9,
    });
    // Estimated finish = 9000s + (42-30)*300sec/km = 12600s = 12_600_000ms
    // > all 3 bucket times → predicted rank 4 → exceeds top-3 → null per BR-AG-29.
    expect(result).toBeNull();
  });

  it('returns rank 2 when virtual finish lands between bucket athletes', () => {
    const athlete = athleteAtSplit({
      lastSplitDistanceKm: 30,
      lastSplitElapsedSec: 6000, // 1h40 at 30km → ~3:20/km elite
    });
    // estimated = 6000 + (42-30)*200 = 6000+2400=8400s=8400000ms
    const bucket: AthleteForRanking[] = [
      { bib: '1', gender: 'M', chipTimeMs: 8000000, gunTimeMs: 8000000 },
      { bib: '2', gender: 'M', chipTimeMs: 8500000, gunTimeMs: 8500000 },
      { bib: '3', gender: 'M', chipTimeMs: 9000000, gunTimeMs: 9000000 },
    ];
    const result = svc.predictForAthlete({
      athlete,
      bucketAthletes: bucket,
      ageGroup: '30-39',
      totalDistanceKm: 42,
      raceType: 'marathon',
      patternConfidence: 0.9,
    });
    expect(result?.predictedRank).toBe(2);
  });

  it('returns null when athlete already has finish chip', () => {
    const result = svc.predictForAthlete({
      athlete: athleteAtSplit({ hasFinishChipRead: true, chipTimeMs: 7200000 }),
      bucketAthletes: [],
      ageGroup: '30-39',
      totalDistanceKm: 42,
      raceType: 'marathon',
      patternConfidence: 0.9,
    });
    expect(result).toBeNull();
  });

  it('returns null when athlete has no lastSplit info', () => {
    const result = svc.predictForAthlete({
      athlete: athleteAtSplit({
        lastSplitDistanceKm: null,
        lastSplitElapsedSec: null,
      }),
      bucketAthletes: [],
      ageGroup: '30-39',
      totalDistanceKm: 42,
      raceType: 'marathon',
      patternConfidence: 0.9,
    });
    expect(result).toBeNull();
  });

  it('returns errorMarginMin per raceType (BR-AG-31)', () => {
    const athlete = athleteAtSplit({
      lastSplitDistanceKm: 30,
      lastSplitElapsedSec: 6000,
    });
    const bucket: AthleteForRanking[] = [
      { bib: '1', gender: 'M', chipTimeMs: 8500000, gunTimeMs: 8500000 },
      { bib: '2', gender: 'M', chipTimeMs: 9000000, gunTimeMs: 9000000 },
    ];
    const ultra = svc.predictForAthlete({
      athlete,
      bucketAthletes: bucket,
      ageGroup: '30-39',
      totalDistanceKm: 42,
      raceType: 'ultra_trail',
      patternConfidence: 0.9,
    });
    expect(ultra?.errorMarginMin).toBe(10);

    const half = svc.predictForAthlete({
      athlete,
      bucketAthletes: bucket,
      ageGroup: '30-39',
      totalDistanceKm: 42,
      raceType: 'half_marathon',
      patternConfidence: 0.9,
    });
    expect(half?.errorMarginMin).toBe(1);
  });
});
