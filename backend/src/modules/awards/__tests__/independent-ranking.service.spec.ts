/**
 * F-019 v2 — IndependentRankingService unit tests.
 */
import { IndependentRankingService } from '../services/independent-ranking.service';
import type { NormalizedAthlete } from '../services/normalize-vendor-quirks.service';

const baseAthlete = (overrides: Partial<NormalizedAthlete>): NormalizedAthlete => ({
  bib: '1',
  raceId: 'r1',
  courseId: 'c1',
  chipTimeMs: 0,
  gunTimeMs: null,
  paceSecPerKm: null,
  status: 'FIN',
  gender: 'M',
  hasFinishChipRead: true,
  lastSplitRank: null,
  lastSplitDistanceKm: null,
  lastSplitElapsedSec: null,
  splitsCount: 0,
  finishReadCount: 1,
  raw: {},
  ...overrides,
});

describe('IndependentRankingService', () => {
  let svc: IndependentRankingService;

  beforeEach(() => {
    svc = new IndependentRankingService();
  });

  it('happy path — sort by chipTime ASC + assign ranks', () => {
    const ranked = svc.rankCourse([
      baseAthlete({ bib: '1', chipTimeMs: 7_200_000 }),
      baseAthlete({ bib: '2', chipTimeMs: 6_900_000 }),
      baseAthlete({ bib: '3', chipTimeMs: 7_500_000 }),
    ]);
    expect(ranked.map((r) => r.bib)).toEqual(['2', '1', '3']);
    expect(ranked.map((r) => r.rank5bib)).toEqual([1, 2, 3]);
  });

  it('filter status !== FIN', () => {
    const ranked = svc.rankCourse([
      baseAthlete({ bib: '1', chipTimeMs: 7_200_000, status: 'FIN' }),
      baseAthlete({ bib: '2', chipTimeMs: 6_900_000, status: 'DSQ' }),
      baseAthlete({ bib: '3', chipTimeMs: 0, status: 'DNF' }),
    ]);
    expect(ranked.map((r) => r.bib)).toEqual(['1']);
    expect(ranked[0].rank5bib).toBe(1);
  });

  it('filter null/0 chipTime', () => {
    const ranked = svc.rankCourse([
      baseAthlete({ bib: '1', chipTimeMs: 7_200_000 }),
      baseAthlete({ bib: '2', chipTimeMs: null }),
      baseAthlete({ bib: '3', chipTimeMs: 0 }),
    ]);
    expect(ranked.map((r) => r.bib)).toEqual(['1']);
  });

  it('ex-aequo tie → same rank, both flagged tied', () => {
    const ranked = svc.rankCourse([
      baseAthlete({ bib: '1', chipTimeMs: 7_200_000 }),
      baseAthlete({ bib: '2', chipTimeMs: 7_200_000 }),
      baseAthlete({ bib: '3', chipTimeMs: 7_300_000 }),
    ]);
    expect(ranked[0].rank5bib).toBe(1);
    expect(ranked[1].rank5bib).toBe(1);
    expect(ranked[2].rank5bib).toBe(3);
    expect(ranked[0].tied).toBe(true);
    expect(ranked[1].tied).toBe(true);
    expect(ranked[2].tied).toBe(false);
  });

  it('filterByGender — only M', () => {
    const ranked = svc.rankCourse([
      baseAthlete({ bib: '1', chipTimeMs: 7_200_000, gender: 'M' }),
      baseAthlete({ bib: '2', chipTimeMs: 6_900_000, gender: 'F' }),
      baseAthlete({ bib: '3', chipTimeMs: 7_500_000, gender: 'M' }),
    ]);
    const men = svc.filterByGender(ranked, 'M');
    expect(men.map((r) => r.bib)).toEqual(['1', '3']);
  });
});
