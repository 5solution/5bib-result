import {
  dateToWeekKey,
  dateToMonthKey,
  weekKeyToRange,
  monthKeyToRange,
  mysqlYearweekToWeekKey,
  isoWeekOf,
  labelForWeekKey,
  labelForMonthKey,
  normalizePaymentOn,
  ymdUtc,
} from '../services/bucket-helpers';

/**
 * F-062 Wave 2B-1 — bucket-helpers unit tests.
 *
 * Cover ISO 8601 week semantics edge cases:
 *   - Year boundary (Dec 31 / Jan 1 trong tuần khác year)
 *   - Week 53 (vd 2020-W53 vì 2020-12-31 là Thursday)
 *   - Leap year (Feb 29)
 *   - Month boundary (last day, day clamp)
 *
 * Match `YEARWEEK(d, 3)` MySQL behaviour:
 *   - Mode 3 = ISO 8601, Monday first, week 1 = first week ≥4 days new year
 */
describe('F-062 Wave 2B-1 bucket-helpers', () => {
  describe('isoWeekOf', () => {
    it('returns correct ISO week for mid-year Wednesday', () => {
      // 2026-05-20 = Wednesday, ISO week 21 of 2026
      const d = new Date('2026-05-20T00:00:00.000Z');
      expect(isoWeekOf(d)).toEqual({ isoYear: 2026, isoWeek: 21 });
    });

    it('handles year boundary — Jan 1 falls in previous year ISO week', () => {
      // 2026-01-01 = Thursday → ISO week 1 of 2026 (Thursday rule)
      const d = new Date('2026-01-01T00:00:00.000Z');
      expect(isoWeekOf(d)).toEqual({ isoYear: 2026, isoWeek: 1 });
    });

    it('handles year boundary — Dec 31 may fall in next year ISO week', () => {
      // 2024-12-31 = Tuesday → ISO week 1 of 2025
      const d = new Date('2024-12-31T00:00:00.000Z');
      expect(isoWeekOf(d)).toEqual({ isoYear: 2025, isoWeek: 1 });
    });

    it('handles ISO week 53 (2020 had 53 ISO weeks)', () => {
      // 2020-12-31 = Thursday → ISO week 53 of 2020
      const d = new Date('2020-12-31T00:00:00.000Z');
      expect(isoWeekOf(d)).toEqual({ isoYear: 2020, isoWeek: 53 });
    });

    it('handles leap year Feb 29', () => {
      // 2024-02-29 = Thursday → ISO week 9 of 2024
      const d = new Date('2024-02-29T00:00:00.000Z');
      expect(isoWeekOf(d)).toEqual({ isoYear: 2024, isoWeek: 9 });
    });
  });

  describe('dateToWeekKey', () => {
    it('formats as YYYY-Www with 2-digit week', () => {
      expect(dateToWeekKey(new Date('2026-05-20T00:00:00.000Z'))).toBe(
        '2026-W21',
      );
    });
    it('pads single-digit week to 2 chars', () => {
      // 2026-01-05 = Monday → ISO week 2
      expect(dateToWeekKey(new Date('2026-01-05T00:00:00.000Z'))).toBe(
        '2026-W02',
      );
    });
  });

  describe('dateToMonthKey', () => {
    it('formats as YYYY-MM padded', () => {
      expect(dateToMonthKey(new Date('2026-05-20T00:00:00.000Z'))).toBe(
        '2026-05',
      );
      expect(dateToMonthKey(new Date('2026-01-01T00:00:00.000Z'))).toBe(
        '2026-01',
      );
    });
  });

  describe('mysqlYearweekToWeekKey', () => {
    it('converts 6-digit YEARWEEK int to YYYY-Www', () => {
      expect(mysqlYearweekToWeekKey(202621)).toBe('2026-W21');
    });
    it('handles week 1', () => {
      expect(mysqlYearweekToWeekKey(202601)).toBe('2026-W01');
    });
    it('accepts string input from MySQL driver', () => {
      expect(mysqlYearweekToWeekKey('202621')).toBe('2026-W21');
    });
    it('throws on invalid input', () => {
      expect(() => mysqlYearweekToWeekKey(NaN)).toThrow();
      expect(() => mysqlYearweekToWeekKey(99999)).toThrow();
    });
  });

  describe('weekKeyToRange', () => {
    it('returns Monday/Sunday for mid-year ISO week', () => {
      // 2026-W21 = May 18 (Mon) – May 24 (Sun)
      expect(weekKeyToRange('2026-W21')).toEqual({
        weekStart: '2026-05-18',
        weekEnd: '2026-05-24',
      });
    });
    it('handles ISO week 1 starting in prev calendar year', () => {
      // 2026-W01 starts Mon 2025-12-29
      expect(weekKeyToRange('2026-W01')).toEqual({
        weekStart: '2025-12-29',
        weekEnd: '2026-01-04',
      });
    });
    it('handles ISO week 53 of 2020 (extra-long year)', () => {
      // 2020-W53 = Dec 28 (Mon) – Jan 3 2021 (Sun)
      expect(weekKeyToRange('2020-W53')).toEqual({
        weekStart: '2020-12-28',
        weekEnd: '2021-01-03',
      });
    });
    it('throws on malformed key', () => {
      expect(() => weekKeyToRange('not-a-week')).toThrow();
      expect(() => weekKeyToRange('2026-W54')).toThrow();
    });
  });

  describe('monthKeyToRange', () => {
    it('returns first/last day for 31-day month', () => {
      expect(monthKeyToRange('2026-05')).toEqual({
        monthStart: '2026-05-01',
        monthEnd: '2026-05-31',
      });
    });
    it('handles 30-day month', () => {
      expect(monthKeyToRange('2026-04')).toEqual({
        monthStart: '2026-04-01',
        monthEnd: '2026-04-30',
      });
    });
    it('handles Feb non-leap year (28 days)', () => {
      expect(monthKeyToRange('2025-02')).toEqual({
        monthStart: '2025-02-01',
        monthEnd: '2025-02-28',
      });
    });
    it('handles Feb leap year (29 days)', () => {
      expect(monthKeyToRange('2024-02')).toEqual({
        monthStart: '2024-02-01',
        monthEnd: '2024-02-29',
      });
    });
    it('throws on malformed key', () => {
      expect(() => monthKeyToRange('2026-13')).toThrow();
      expect(() => monthKeyToRange('not-a-month')).toThrow();
    });
  });

  describe('labels', () => {
    it('labelForWeekKey returns VN tuần format', () => {
      expect(labelForWeekKey('2026-W21')).toBe('Tuần 21');
      expect(labelForWeekKey('2026-W01')).toBe('Tuần 1');
    });
    it('labelForMonthKey returns VN tháng format', () => {
      expect(labelForMonthKey('2026-05')).toBe('Tháng 5 / 2026');
      expect(labelForMonthKey('2026-12')).toBe('Tháng 12 / 2026');
    });
    it('falls back to raw key on parse fail', () => {
      expect(labelForWeekKey('garbage')).toBe('garbage');
      expect(labelForMonthKey('garbage')).toBe('garbage');
    });
  });

  describe('normalizePaymentOn', () => {
    it('passes through Date instance unchanged', () => {
      const d = new Date('2026-05-20T08:30:00.000Z');
      expect(normalizePaymentOn(d)).toBe(d);
    });
    it('parses MySQL datetime string', () => {
      const parsed = normalizePaymentOn('2026-05-20 08:30:00');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getUTCFullYear()).toBe(2026);
    });
    it('parses ISO 8601 string', () => {
      const parsed = normalizePaymentOn('2026-05-20T08:30:00.000Z');
      expect(parsed.getUTCFullYear()).toBe(2026);
      expect(parsed.getUTCMonth()).toBe(4); // 0-indexed May
    });
  });

  describe('ymdUtc', () => {
    it('formats YYYY-MM-DD anchored UTC', () => {
      const d = new Date('2026-05-20T23:30:00.000Z');
      expect(ymdUtc(d)).toBe('2026-05-20');
    });
    it('pads single digit month/day', () => {
      const d = new Date('2026-01-05T00:00:00.000Z');
      expect(ymdUtc(d)).toBe('2026-01-05');
    });
  });

  describe('round-trip identity', () => {
    it('dateToWeekKey → weekKeyToRange.weekStart → dateToWeekKey identical', () => {
      const original = new Date('2026-05-20T00:00:00.000Z');
      const key = dateToWeekKey(original);
      const { weekStart } = weekKeyToRange(key);
      const roundtrip = dateToWeekKey(new Date(`${weekStart}T00:00:00.000Z`));
      expect(roundtrip).toBe(key);
    });
    it('dateToMonthKey → monthKeyToRange.monthStart → dateToMonthKey identical', () => {
      const original = new Date('2026-05-20T00:00:00.000Z');
      const key = dateToMonthKey(original);
      const { monthStart } = monthKeyToRange(key);
      const roundtrip = dateToMonthKey(new Date(`${monthStart}T00:00:00.000Z`));
      expect(roundtrip).toBe(key);
    });
  });
});
