/**
 * F-020 — `computeOverallTopN` pure helper unit tests.
 *
 * Coverage (6 cases — theo Manager Plan §Unit test BẮT BUỘC):
 *  1. Happy path: 10 athletes có chipTime → trả về 3 đầu sort ASC.
 *  2. < 3 athletes → trả về tất cả (vd 2 athletes → 2 entries).
 *  3. 0 athletes có chipTime hợp lệ → array rỗng.
 *  4. Tie chipTime → stable (BIB ASC tie-break, ổn định trên nhiều lần gọi).
 *  5. chipTimeMs = null hoặc 0 → filter ra (không vào kết quả).
 *  6. chipTimeMs = -1 (vendor sentinel) → filter ra.
 */

import {
  AthleteForRanking,
  computeOverallTopN,
} from '../services/ag-bracket-calc.service';

const mk = (
  bib: string,
  chipTimeMs: number | null,
  extras: Partial<AthleteForRanking> = {},
): AthleteForRanking => ({
  bib,
  name: `Athlete ${bib}`,
  gender: 'M',
  chipTimeMs,
  gunTimeMs: chipTimeMs,
  ...extras,
});

describe('computeOverallTopN — F-020 BR-AG-50', () => {
  it('happy: 10 athletes có chipTime → top 3 đầu sort ASC', () => {
    const athletes: AthleteForRanking[] = Array.from({ length: 10 }).map(
      (_, i) => mk(String(1000 + i), (i + 1) * 60_000), // 60s, 120s, ..., 600s
    );
    const top = computeOverallTopN(athletes, 3);
    expect(top).toHaveLength(3);
    expect(top.map((a) => a.bib)).toEqual(['1000', '1001', '1002']);
    expect(top[0].chipTimeMs).toBe(60_000);
  });

  it('< 3 athletes → trả về tất cả còn lại', () => {
    const athletes: AthleteForRanking[] = [
      mk('200', 90_000),
      mk('201', 80_000),
    ];
    const top = computeOverallTopN(athletes, 3);
    expect(top).toHaveLength(2);
    expect(top.map((a) => a.bib)).toEqual(['201', '200']);
  });

  it('0 athletes có chipTime hợp lệ → trả về array rỗng', () => {
    const athletes: AthleteForRanking[] = [
      mk('300', null),
      mk('301', null),
      mk('302', 0),
    ];
    const top = computeOverallTopN(athletes, 3);
    expect(top).toEqual([]);
  });

  it('tie chipTime → stable (BIB ASC tiebreak)', () => {
    const athletes: AthleteForRanking[] = [
      mk('500', 50_000),
      mk('400', 50_000), // tie với 500 ở chipTime — BIB 400 nhỏ hơn → trước
      mk('600', 50_000),
      mk('700', 60_000),
    ];
    const topA = computeOverallTopN(athletes, 3);
    const topB = computeOverallTopN(athletes, 3); // gọi 2 lần — kết quả identical
    expect(topA.map((a) => a.bib)).toEqual(['400', '500', '600']);
    expect(topB.map((a) => a.bib)).toEqual(topA.map((a) => a.bib));
  });

  it('chipTimeMs = null hoặc 0 → filter ra', () => {
    const athletes: AthleteForRanking[] = [
      mk('800', null),
      mk('801', 0),
      mk('802', 70_000),
      mk('803', 80_000),
    ];
    const top = computeOverallTopN(athletes, 3);
    expect(top.map((a) => a.bib)).toEqual(['802', '803']);
    // Confirm null/0 không leak vào kết quả.
    expect(top.every((a) => a.chipTimeMs != null && a.chipTimeMs > 0)).toBe(
      true,
    );
  });

  it('chipTimeMs = -1 vendor sentinel → filter ra', () => {
    const athletes: AthleteForRanking[] = [
      mk('900', -1),
      mk('901', -1),
      mk('902', 100_000),
    ];
    const top = computeOverallTopN(athletes, 3);
    expect(top).toHaveLength(1);
    expect(top[0].bib).toBe('902');
  });
});
