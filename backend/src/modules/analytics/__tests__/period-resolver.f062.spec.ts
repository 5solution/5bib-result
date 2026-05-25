/**
 * F-062 Wave 1 Foundation (Manager Adjustment #1 v3) — Period Resolver test extensions.
 *
 * Tests cho 3 changes của v3:
 * 1. NEW `GranularityKind` enum + `resolveBucketSize()` helper
 * 2. EXTEND `CompareKind` thêm `'wow' | 'mom'` (giữ `'prev' | 'yoy' | 'custom' | 'none'`)
 * 3. REGRESSION: F-026 6 endpoint cũ vẫn pass với PeriodKind cũ 6 values
 *
 * File này SEPARATE từ `period-resolver.spec.ts` cũ (F-026) để Manager dễ track v3 changes.
 */

import {
  resolvePeriod,
  resolveCompare,
  resolveBucketSize,
  calcDeltaPercent,
  buildMetricCacheKey,
  shiftMonthClamped,
  type GranularityKind,
  type CompareKind,
  type PeriodKind,
} from '../services/period-resolver';

const FIXED_NOW = new Date('2026-05-22T10:00:00Z'); // Thứ năm

describe('Period Resolver — F-062 v3 (Adj #1 GranularityKind + CompareKind extend)', () => {
  // ────────────────────────────────────────────────────────────────────
  // SECTION 1 — resolveBucketSize() helper (BR-SA-01 new enum)
  // ────────────────────────────────────────────────────────────────────

  describe('resolveBucketSize() — NEW helper', () => {
    it('returns DATE(payment_on) sqlGroupExpr cho "daily"', () => {
      const result = resolveBucketSize('daily');
      expect(result.sqlGroupExpr).toBe('DATE(payment_on)');
      expect(result.labelFormat).toBe('DD/MM');
      expect(result.bucketKeyFormat).toBe('YYYY-MM-DD');
    });

    it('returns YEARWEEK(payment_on, 3) ISO 8601 cho "weekly"', () => {
      const result = resolveBucketSize('weekly');
      expect(result.sqlGroupExpr).toBe('YEARWEEK(payment_on, 3)');
      expect(result.labelFormat).toBe('Tuần WW');
      expect(result.bucketKeyFormat).toBe('YYYY-Www');
    });

    it('returns DATE_FORMAT calendar month cho "monthly"', () => {
      const result = resolveBucketSize('monthly');
      expect(result.sqlGroupExpr).toBe("DATE_FORMAT(payment_on, '%Y-%m')");
      expect(result.labelFormat).toBe('Tháng MM/YYYY');
      expect(result.bucketKeyFormat).toBe('YYYY-MM');
    });

    it('throws for invalid kind (exhaustiveness check)', () => {
      expect(() =>
        resolveBucketSize('quarterly' as GranularityKind),
      ).toThrow(/kind không hợp lệ/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // SECTION 1B — shiftMonthClamped() (NEW helper, Wave 2A fix TD-F062-MOM-BOUNDARY-ROLLOVER)
  // ────────────────────────────────────────────────────────────────────

  describe('shiftMonthClamped() — NEW (Wave 2A fix, public helper)', () => {
    it('preserves day when target month has enough days (May 22 → April 22)', () => {
      const result = shiftMonthClamped(new Date('2026-05-22T00:00:00Z'), -1);
      expect(result.toISOString()).toBe('2026-04-22T00:00:00.000Z');
    });

    it('clamps day to last-day-of-target-month (May 31 → April 30, the Manager bug case)', () => {
      const result = shiftMonthClamped(new Date('2026-05-31T00:00:00Z'), -1);
      expect(result.toISOString()).toBe('2026-04-30T00:00:00.000Z');
    });

    it('handles cross-year backward (Jan 31 → Dec 31, no clamp because Dec has 31)', () => {
      const result = shiftMonthClamped(new Date('2026-01-31T00:00:00Z'), -1);
      expect(result.toISOString()).toBe('2025-12-31T00:00:00.000Z');
    });

    it('handles leap year (Mar 29 → Feb 29 in 2024)', () => {
      const result = shiftMonthClamped(new Date('2024-03-29T00:00:00Z'), -1);
      expect(result.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    });

    it('handles non-leap year clamp (Mar 29 → Feb 28 in 2025)', () => {
      const result = shiftMonthClamped(new Date('2025-03-29T00:00:00Z'), -1);
      expect(result.toISOString()).toBe('2025-02-28T00:00:00.000Z');
    });

    it('handles positive shift (+1 month)', () => {
      const result = shiftMonthClamped(new Date('2026-01-31T00:00:00Z'), 1);
      expect(result.toISOString()).toBe('2026-02-28T00:00:00.000Z'); // Feb 28 (non-leap clamp)
    });

    it('preserves time components (HH/MM/SS/MS)', () => {
      const result = shiftMonthClamped(new Date('2026-05-22T23:59:59.123Z'), -1);
      expect(result.toISOString()).toBe('2026-04-22T23:59:59.123Z');
    });

    it('handles 0 months shift (no-op)', () => {
      const result = shiftMonthClamped(new Date('2026-05-22T10:00:00Z'), 0);
      expect(result.toISOString()).toBe('2026-05-22T10:00:00.000Z');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // SECTION 2 — resolveCompare() extend với wow + mom (BR-SA-04 v3)
  // ────────────────────────────────────────────────────────────────────

  describe('resolveCompare() — wow/mom NEW kinds', () => {
    const current30d = resolvePeriod({ kind: '30d', now: FIXED_NOW });

    it('wow: shifts current range lùi 7 ngày', () => {
      const result = resolveCompare(current30d, { kind: 'wow' });
      expect(result).not.toBeNull();
      const curFromMs = new Date(current30d.fromIso).getTime();
      const prevFromMs = new Date(result!.fromIso).getTime();
      const diffDays = (curFromMs - prevFromMs) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBe(7);
      expect(result!.periodKey).toContain('wow:');
    });

    it('mom: shifts current range lùi 1 calendar month', () => {
      // April → May 2026 (30d period ending May 22)
      // Current period 30d: 23/04 → 23/05 (exclusive)
      // MoM: 23/03 → 23/04 (exclusive)
      const result = resolveCompare(current30d, { kind: 'mom' });
      expect(result).not.toBeNull();
      const curFromDate = new Date(current30d.fromIso);
      const prevFromDate = new Date(result!.fromIso);
      // Setting UTCMonth -1 từ ngày 23/04 → 23/03
      expect(prevFromDate.getUTCMonth()).toBe(curFromDate.getUTCMonth() - 1);
      expect(prevFromDate.getUTCDate()).toBe(curFromDate.getUTCDate());
      expect(result!.periodKey).toContain('mom:');
    });

    // F-062 Wave 2A NEW (TD-F062-MOM-BOUNDARY-ROLLOVER fix 2026-05-22 Manager finding):
    // verify shiftMonthClamped pattern KHÔNG có rollover bug khi day > target month days.
    it('mom: May 31 → April 30 WITHOUT rollover (Manager bug case)', () => {
      const periodEndMay31 = resolvePeriod({
        kind: 'custom',
        from: '2026-05-31',
        to: '2026-05-31',
      });
      const result = resolveCompare(periodEndMay31, { kind: 'mom' });
      expect(result).not.toBeNull();
      // Naive setUTCMonth(-1) from May 31 → April 31 (NOT exist) → JS rolls May 1
      // shiftMonthClamped clamps day to April 30 (last day of April)
      expect(result!.fromIso.slice(0, 10)).toBe('2026-04-30');
      // Verify NOT rolled over to May (would be bug)
      expect(result!.fromIso.slice(5, 7)).not.toBe('05');
    });

    it('mom: Jan 31 → Dec 31 (cross-year, no clamp because Dec has 31)', () => {
      const periodJan31 = resolvePeriod({
        kind: 'custom',
        from: '2026-01-31',
        to: '2026-01-31',
      });
      const result = resolveCompare(periodJan31, { kind: 'mom' });
      expect(result!.fromIso.slice(0, 10)).toBe('2025-12-31');
    });

    it('mom: Mar 29 → Feb 29 LEAP YEAR (2024, no clamp)', () => {
      const periodMar29Leap = resolvePeriod({
        kind: 'custom',
        from: '2024-03-29',
        to: '2024-03-29',
      });
      const result = resolveCompare(periodMar29Leap, { kind: 'mom' });
      expect(result!.fromIso.slice(0, 10)).toBe('2024-02-29');
    });

    it('mom: Mar 29 → Feb 28 NON-leap year (2025, CLAMP to 28)', () => {
      const periodMar29NonLeap = resolvePeriod({
        kind: 'custom',
        from: '2025-03-29',
        to: '2025-03-29',
      });
      const result = resolveCompare(periodMar29NonLeap, { kind: 'mom' });
      expect(result!.fromIso.slice(0, 10)).toBe('2025-02-28');
    });

    it('mom: Mar 31 → Feb 29 LEAP YEAR (2024, CLAMP from 31 to 29)', () => {
      const periodMar31Leap = resolvePeriod({
        kind: 'custom',
        from: '2024-03-31',
        to: '2024-03-31',
      });
      const result = resolveCompare(periodMar31Leap, { kind: 'mom' });
      expect(result!.fromIso.slice(0, 10)).toBe('2024-02-29');
    });

    it('yoy: shifts current range lùi 1 calendar year (regression — F-026 backward compat)', () => {
      const result = resolveCompare(current30d, { kind: 'yoy' });
      expect(result).not.toBeNull();
      const curFromDate = new Date(current30d.fromIso);
      const prevFromDate = new Date(result!.fromIso);
      expect(prevFromDate.getUTCFullYear()).toBe(curFromDate.getUTCFullYear() - 1);
      expect(result!.periodKey).toContain('yoy:');
    });

    it('prev: shifts by period length (regression — F-026 backward compat)', () => {
      const result = resolveCompare(current30d, { kind: 'prev' });
      expect(result).not.toBeNull();
      // For 30d period, prev should also be ~30 days backward
      const curFromMs = new Date(current30d.fromIso).getTime();
      const prevFromMs = new Date(result!.fromIso).getTime();
      const diffMs = curFromMs - prevFromMs;
      const curRangeMs =
        new Date(current30d.toIso).getTime() - new Date(current30d.fromIso).getTime();
      expect(diffMs).toBe(curRangeMs); // exactly 1 period length back
      expect(result!.periodKey).toContain('prev:');
    });

    it('none: returns null (regression)', () => {
      const result = resolveCompare(current30d, { kind: 'none' });
      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // SECTION 3 — REGRESSION: F-026 PeriodKind 6 values vẫn pass
  // ────────────────────────────────────────────────────────────────────

  describe('PeriodKind — F-026 regression (KHÔNG break 6 endpoint cũ)', () => {
    const validKinds: PeriodKind[] = ['7d', '30d', 'quarter', 'year', 'custom', 'rolling12m'];

    validKinds.forEach((kind) => {
      if (kind === 'custom') {
        it(`"${kind}" requires from + to params (existing behavior)`, () => {
          expect(() => resolvePeriod({ kind, now: FIXED_NOW })).toThrow(/custom kind cần/);
        });
      } else {
        it(`"${kind}" resolves to valid range without breaking`, () => {
          const result = resolvePeriod({ kind, now: FIXED_NOW });
          expect(result.fromIso).toBeDefined();
          expect(result.toIso).toBeDefined();
          expect(result.periodKey).toBeTruthy();
          // Verify from < to
          expect(new Date(result.fromIso).getTime()).toBeLessThan(
            new Date(result.toIso).getTime(),
          );
        });
      }
    });

    it('KHÔNG accept "weekly" or "monthly" trong PeriodKind (v3 — chúng là GranularityKind)', () => {
      // Type-level test: TS sẽ reject ở compile time. Runtime test cho documentation.
      // @ts-expect-error — 'weekly' KHÔNG phải PeriodKind
      const invalid: PeriodKind = 'weekly';
      // Runtime fallback: resolvePeriod sẽ throw cho invalid kind
      expect(() => resolvePeriod({ kind: invalid, now: FIXED_NOW })).toThrow(/không hợp lệ/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // SECTION 4 — calcDeltaPercent + buildMetricCacheKey unchanged (sanity)
  // ────────────────────────────────────────────────────────────────────

  describe('Existing helpers unchanged (sanity check)', () => {
    it('calcDeltaPercent guards base=0 with null', () => {
      expect(calcDeltaPercent(100, 0)).toBeNull();
    });

    it('calcDeltaPercent rounds 2 decimals', () => {
      expect(calcDeltaPercent(110, 100)).toBe(10);
      expect(calcDeltaPercent(105.5, 100)).toBe(5.5);
    });

    it('buildMetricCacheKey format consistent', () => {
      const key = buildMetricCacheKey('weekly-revenue', 'platform', 'wk:2026-W21');
      expect(key).toBe('analytics:metric:weekly-revenue:platform:wk:2026-W21');
    });

    it('buildMetricCacheKey với scope race:<raceId>', () => {
      const key = buildMetricCacheKey('runner-summary', { raceId: 104 }, '30d:2026-04-22');
      expect(key).toBe('analytics:metric:runner-summary:race:104:30d:2026-04-22');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // SECTION 5 — CompareKind type completeness (BR-SA-01 v3)
  // ────────────────────────────────────────────────────────────────────

  describe('CompareKind v3 — 6 values total (prev/yoy/custom/none + wow/mom)', () => {
    const allKinds: CompareKind[] = ['prev', 'yoy', 'custom', 'none', 'wow', 'mom'];
    const current = resolvePeriod({ kind: '30d', now: FIXED_NOW });

    allKinds.forEach((kind) => {
      if (kind === 'custom') {
        it(`"${kind}" requires from + to`, () => {
          expect(() => resolveCompare(current, { kind })).toThrow(/custom cần/);
        });
      } else if (kind === 'none') {
        it(`"${kind}" returns null`, () => {
          expect(resolveCompare(current, { kind })).toBeNull();
        });
      } else {
        it(`"${kind}" returns valid ResolvedRange`, () => {
          const result = resolveCompare(current, { kind });
          expect(result).not.toBeNull();
          expect(result!.fromIso).toBeDefined();
          expect(result!.toIso).toBeDefined();
          expect(result!.periodKey).toContain(`${kind}:`);
        });
      }
    });
  });
});
