/**
 * F-081 — ICT date utilities boundary tests.
 *
 * Critical boundary: ICT 00:00–06:59 sáng = UTC 17:00–23:59 NGÀY TRƯỚC.
 * Đây chính là window gây mọi bug TZ (F-079 hotfix4 order 200029493
 * paid UTC 2026-06-08 21:14 = ICT 2026-06-09 04:14).
 */
import {
  toIctDateString,
  startOfMonthIct,
  startOfDayIct,
  toUtcSqlDatetime,
  ictDayRangeUtc,
} from './ict-date.util';

describe('ict-date.util (F-081)', () => {
  describe('toIctDateString', () => {
    it('UTC 2026-06-08 21:14 → ICT 2026-06-09 (order 200029493 case)', () => {
      expect(toIctDateString(new Date('2026-06-08T21:14:31Z'))).toBe(
        '2026-06-09',
      );
    });

    it('UTC 2026-06-09 08:00 → ICT 2026-06-09 (same day, 15:00 ICT)', () => {
      expect(toIctDateString(new Date('2026-06-09T08:00:00Z'))).toBe(
        '2026-06-09',
      );
    });

    it('UTC 2026-06-09 16:59:59 → ICT 2026-06-09 (23:59 ICT — last second)', () => {
      expect(toIctDateString(new Date('2026-06-09T16:59:59Z'))).toBe(
        '2026-06-09',
      );
    });

    it('UTC 2026-06-09 17:00:00 → ICT 2026-06-10 (00:00 ICT next day)', () => {
      expect(toIctDateString(new Date('2026-06-09T17:00:00Z'))).toBe(
        '2026-06-10',
      );
    });

    it('năm boundary: UTC 2025-12-31 18:00 → ICT 2026-01-01', () => {
      expect(toIctDateString(new Date('2025-12-31T18:00:00Z'))).toBe(
        '2026-01-01',
      );
    });
  });

  describe('startOfMonthIct', () => {
    it('UTC 2026-06-09 08:00 → 2026-05-31T17:00:00Z (= ICT 1/6 00:00)', () => {
      const r = startOfMonthIct(new Date('2026-06-09T08:00:00Z'));
      expect(r.toISOString()).toBe('2026-05-31T17:00:00.000Z');
    });

    it('UTC 2026-05-31 18:00 (= ICT 1/6 01:00 — đã sang tháng 6 ICT) → tháng 6', () => {
      const r = startOfMonthIct(new Date('2026-05-31T18:00:00Z'));
      expect(r.toISOString()).toBe('2026-05-31T17:00:00.000Z');
    });

    it('UTC 2026-05-31 16:00 (= ICT 31/5 23:00 — vẫn tháng 5 ICT) → tháng 5', () => {
      const r = startOfMonthIct(new Date('2026-05-31T16:00:00Z'));
      expect(r.toISOString()).toBe('2026-04-30T17:00:00.000Z');
    });
  });

  describe('startOfDayIct', () => {
    it('UTC 2026-06-08 21:14 (= ICT 9/6 04:14) → 2026-06-08T17:00:00Z', () => {
      const r = startOfDayIct(new Date('2026-06-08T21:14:31Z'));
      expect(r.toISOString()).toBe('2026-06-08T17:00:00.000Z');
    });
  });

  describe('toUtcSqlDatetime', () => {
    it('formats YYYY-MM-DD HH:mm:ss', () => {
      expect(toUtcSqlDatetime(new Date('2026-05-31T17:00:00Z'))).toBe(
        '2026-05-31 17:00:00',
      );
    });
  });

  describe('ictDayRangeUtc', () => {
    it("'2026-06-09' → [2026-06-08 17:00:00, 2026-06-09 17:00:00)", () => {
      const r = ictDayRangeUtc('2026-06-09');
      expect(r.fromUtc).toBe('2026-06-08 17:00:00');
      expect(r.toUtcExclusive).toBe('2026-06-09 17:00:00');
    });

    it('order 200029493 (UTC 06-08 21:14) NẰM TRONG range ngày ICT 06-09', () => {
      const r = ictDayRangeUtc('2026-06-09');
      const paid = '2026-06-08 21:14:31';
      expect(paid >= r.fromUtc).toBe(true);
      expect(paid < r.toUtcExclusive).toBe(true);
    });
  });
});
