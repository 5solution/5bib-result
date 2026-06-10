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
  periodRangeUtc,
  ICT_PERIOD_CUTOVER,
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

/**
 * F-082 — periodRangeUtc cutover + seam continuity matrix.
 *
 * INVARIANT: startOf(P) = endOf(P-1) + 1s → zero gap, zero double-count
 * tại MỌI seam (kể cả cutover T5→T6).
 */
describe('periodRangeUtc (F-082 cutover)', () => {
  it('cutover constant = 2026-06 (Danny chốt 2026-06-10)', () => {
    expect(ICT_PERIOD_CUTOVER).toBe('2026-06');
  });

  it('kỳ CŨ T4/2026 — UTC boundary nguyên trạng (số đã ký không đổi)', () => {
    const r = periodRangeUtc('2026-04-01', '2026-04-30');
    expect(r.fromUtc).toBe('2026-04-01 00:00:00');
    expect(r.toUtc).toBe('2026-04-30 23:59:59');
  });

  it('kỳ CŨ T5/2026 — UTC boundary nguyên trạng', () => {
    const r = periodRangeUtc('2026-05-01', '2026-05-31');
    expect(r.fromUtc).toBe('2026-05-01 00:00:00');
    expect(r.toUtc).toBe('2026-05-31 23:59:59');
  });

  it('kỳ CUTOVER T6/2026 — SEAM: from giữ continuity UTC, to theo ICT', () => {
    const r = periodRangeUtc('2026-06-01', '2026-06-30');
    // from = end(T5 UTC) + 1s — KHÔNG phải ICT start 05-31 17:00 (tránh
    // double-count đơn 17:00-23:59:59 UTC 31/5 đã thuộc kỳ T5 đã ký)
    expect(r.fromUtc).toBe('2026-06-01 00:00:00');
    // to = 30/6 23:59:59 ICT = 30/6 16:59:59 UTC
    expect(r.toUtc).toBe('2026-06-30 16:59:59');
  });

  it('kỳ T7/2026 — FULL ICT cả 2 đầu', () => {
    const r = periodRangeUtc('2026-07-01', '2026-07-31');
    // from = end(T6 ICT) + 1s = 30/6 17:00:00 UTC = 1/7 00:00 ICT
    expect(r.fromUtc).toBe('2026-06-30 17:00:00');
    expect(r.toUtc).toBe('2026-07-31 16:59:59');
  });

  it('seam continuity: end(P) + 1s === start(P+1) cho chuỗi T4→T8', () => {
    const months = [
      ['2026-04-01', '2026-04-30'],
      ['2026-05-01', '2026-05-31'],
      ['2026-06-01', '2026-06-30'],
      ['2026-07-01', '2026-07-31'],
      ['2026-08-01', '2026-08-31'],
    ];
    for (let i = 0; i < months.length - 1; i++) {
      const cur = periodRangeUtc(months[i][0], months[i][1]);
      const next = periodRangeUtc(months[i + 1][0], months[i + 1][1]);
      const endMs = Date.parse(cur.toUtc.replace(' ', 'T') + 'Z');
      const nextStartMs = Date.parse(next.fromUtc.replace(' ', 'T') + 'Z');
      expect(nextStartMs - endMs).toBe(1000); // đúng 1 giây — zero gap/overlap
    }
  });

  it('đơn seam-window (31/5 17:00-23:59 UTC = 1/6 ICT sáng) CHỈ thuộc kỳ T5', () => {
    const t5 = periodRangeUtc('2026-05-01', '2026-05-31');
    const t6 = periodRangeUtc('2026-06-01', '2026-06-30');
    const paid = '2026-05-31 21:14:20'; // processed_on UTC thực tế seam-window
    const inT5 = paid >= t5.fromUtc && paid <= t5.toUtc;
    const inT6 = paid >= t6.fromUtc && paid <= t6.toUtc;
    expect(inT5).toBe(true);
    expect(inT6).toBe(false); // KHÔNG double-count
  });

  it('đơn ICT sáng sớm 1/7 (30/6 17:00+ UTC) thuộc kỳ T7 (full ICT semantics)', () => {
    const t6 = periodRangeUtc('2026-06-01', '2026-06-30');
    const t7 = periodRangeUtc('2026-07-01', '2026-07-31');
    const paid = '2026-06-30 21:00:00'; // = 1/7 04:00 ICT
    expect(paid >= t6.fromUtc && paid <= t6.toUtc).toBe(false);
    expect(paid >= t7.fromUtc && paid <= t7.toUtc).toBe(true);
  });

  it('multi-month range STRADDLE cutover T5→T7: from UTC, to ICT', () => {
    const r = periodRangeUtc('2026-05-01', '2026-07-31');
    expect(r.fromUtc).toBe('2026-05-01 00:00:00'); // theo tháng start (T5 UTC)
    expect(r.toUtc).toBe('2026-07-31 16:59:59'); // theo tháng end (T7 ICT)
  });

  it('year boundary: T12/2026 → T1/2027 continuity (full ICT)', () => {
    const dec = periodRangeUtc('2026-12-01', '2026-12-31');
    const jan = periodRangeUtc('2027-01-01', '2027-01-31');
    expect(dec.toUtc).toBe('2026-12-31 16:59:59');
    expect(jan.fromUtc).toBe('2026-12-31 17:00:00');
  });

  it('year boundary kỳ cũ: T12/2025 → T1/2026 (full UTC legacy)', () => {
    const dec = periodRangeUtc('2025-12-01', '2025-12-31');
    const jan = periodRangeUtc('2026-01-01', '2026-01-31');
    expect(dec.toUtc).toBe('2025-12-31 23:59:59');
    expect(jan.fromUtc).toBe('2026-01-01 00:00:00');
  });
});
