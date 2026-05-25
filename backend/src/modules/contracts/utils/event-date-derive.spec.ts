/**
 * F-064 — Unit tests for event-date-derive helpers.
 *
 * Covers:
 *   - parseRaceDateIso: ISO accept, free-form reject
 *   - deriveSetupDate / deriveExpoDate: math + null pass-through
 *   - deriveAthleteCount: override priority, regex match, fallback 0
 *   - formatVnDate: dd/mm/yyyy, empty for null/invalid
 */
import {
  deriveAthleteCount,
  deriveExpoDate,
  deriveSetupDate,
  formatVnDate,
  parseRaceDateIso,
} from './event-date-derive';

describe('F-064 event-date-derive helpers', () => {
  describe('parseRaceDateIso', () => {
    it('returns Date for ISO yyyy-mm-dd string', () => {
      const d = parseRaceDateIso('2026-05-31');
      expect(d).toBeInstanceOf(Date);
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(4); // 0-indexed
      expect(d?.getDate()).toBe(31);
    });

    it('returns null for free-format multi-day string', () => {
      expect(
        parseRaceDateIso('06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026'),
      ).toBeNull();
    });

    it('returns null for VN dd/mm/yyyy format', () => {
      expect(parseRaceDateIso('31/05/2026')).toBeNull();
    });

    it('returns null for null/undefined/empty', () => {
      expect(parseRaceDateIso(null)).toBeNull();
      expect(parseRaceDateIso(undefined)).toBeNull();
      expect(parseRaceDateIso('')).toBeNull();
    });

    it('passes through valid Date instance', () => {
      const d = new Date('2026-05-31');
      expect(parseRaceDateIso(d)).toBe(d);
    });

    it('returns null for invalid Date instance', () => {
      expect(parseRaceDateIso(new Date('not-a-date'))).toBeNull();
    });
  });

  describe('deriveSetupDate (raceDate - 3 days)', () => {
    it('returns raceDate - 3 days for ISO input', () => {
      const d = deriveSetupDate('2026-05-31');
      expect(d).toBeInstanceOf(Date);
      expect(formatVnDate(d)).toBe('28/05/2026');
    });

    it('returns null for free-format', () => {
      expect(deriveSetupDate('06:00 ngày 15/06/2026')).toBeNull();
    });

    it('returns null for missing input', () => {
      expect(deriveSetupDate(null)).toBeNull();
      expect(deriveSetupDate(undefined)).toBeNull();
    });
  });

  describe('deriveExpoDate (raceDate - 1 day)', () => {
    it('returns raceDate - 1 day for ISO input', () => {
      const d = deriveExpoDate('2026-05-31');
      expect(formatVnDate(d)).toBe('30/05/2026');
    });

    it('returns null for free-format', () => {
      expect(deriveExpoDate('multi-day text')).toBeNull();
    });
  });

  describe('deriveAthleteCount', () => {
    it('returns explicit override when > 0', () => {
      expect(deriveAthleteCount([], 5000)).toBe(5000);
      expect(deriveAthleteCount(null, 3500)).toBe(3500);
    });

    it('ignores explicit override when 0/null/undefined', () => {
      expect(
        deriveAthleteCount(
          [{ description: 'Bib chính thức', quantity: 1000 }],
          0,
        ),
      ).toBe(1000);
      expect(
        deriveAthleteCount(
          [{ description: 'Bib chính thức', quantity: 1000 }],
          null,
        ),
      ).toBe(1000);
    });

    it('sums quantity from line items matching athlete keywords', () => {
      const items = [
        { description: 'Bib chính thức', quantity: 5000 },
        { description: 'Racekit cao cấp', quantity: 200 },
        { description: 'Banner sponsor', quantity: 10 },
        { description: 'MC race day', quantity: 1 },
      ];
      // Matches: 'Bib' + 'Racekit' = 5000 + 200 = 5200
      expect(deriveAthleteCount(items)).toBe(5200);
    });

    it('matches Vietnamese "vận động viên"', () => {
      const items = [
        { description: 'Phí vận động viên trail', quantity: 800 },
        { description: 'Đồ ăn nước uống', quantity: 100 },
      ];
      expect(deriveAthleteCount(items)).toBe(800);
    });

    it('matches "vđv" abbreviation', () => {
      expect(
        deriveAthleteCount([{ description: 'Số VĐV đăng ký', quantity: 1500 }]),
      ).toBe(1500);
    });

    it('returns 0 for empty/null line items', () => {
      expect(deriveAthleteCount([])).toBe(0);
      expect(deriveAthleteCount(null)).toBe(0);
      expect(deriveAthleteCount(undefined)).toBe(0);
    });

    it('returns 0 when no line item matches keywords (no hardcoded 3000 leak)', () => {
      const items = [
        { description: 'MC race day', quantity: 1 },
        { description: 'Banner sponsor', quantity: 10 },
      ];
      expect(deriveAthleteCount(items)).toBe(0);
    });
  });

  describe('formatVnDate', () => {
    it('formats Date to dd/mm/yyyy VN', () => {
      expect(formatVnDate(new Date('2026-06-01'))).toBe('01/06/2026');
      expect(formatVnDate(new Date('2026-12-31'))).toBe('31/12/2026');
    });

    it('formats ISO string', () => {
      expect(formatVnDate('2026-05-31')).toBe('31/05/2026');
    });

    it('returns empty for null/undefined', () => {
      expect(formatVnDate(null)).toBe('');
      expect(formatVnDate(undefined)).toBe('');
    });

    it('returns empty for invalid Date', () => {
      expect(formatVnDate(new Date('not-a-date'))).toBe('');
      expect(formatVnDate('not-a-date-string')).toBe('');
    });
  });
});
