import { parseDistanceKm } from './parse-distance-km';

describe('parseDistanceKm', () => {
  describe('meters → kilometers', () => {
    it('parses "200m" as 0.2', () => {
      expect(parseDistanceKm('200m')).toBe(0.2);
    });
    it('parses "400m" as 0.4', () => {
      expect(parseDistanceKm('400m')).toBe(0.4);
    });
    it('parses "800m" as 0.8', () => {
      expect(parseDistanceKm('800m')).toBe(0.8);
    });
    it('parses "1000m" as 1', () => {
      expect(parseDistanceKm('1000m')).toBe(1);
    });
  });

  describe('km suffix variants', () => {
    it.each(['5K', '5KM', '5km', '5Km'])('parses "%s" as 5', (s) => {
      expect(parseDistanceKm(s)).toBe(5);
    });
    it.each(['10K', '10KM', '10km', '10Km'])('parses "%s" as 10', (s) => {
      expect(parseDistanceKm(s)).toBe(10);
    });
    it('parses "21KM" as 21', () => {
      expect(parseDistanceKm('21KM')).toBe(21);
    });
    it('parses "100KM" as 100', () => {
      expect(parseDistanceKm('100KM')).toBe(100);
    });
    it('parses "1.5Km" as 1.5', () => {
      expect(parseDistanceKm('1.5Km')).toBe(1.5);
    });
    it('parses "4.8km" as 4.8', () => {
      expect(parseDistanceKm('4.8km')).toBe(4.8);
    });
    it('parses "7.2km" as 7.2', () => {
      expect(parseDistanceKm('7.2km')).toBe(7.2);
    });
  });

  describe('bare numeric (treated as km if 0 < n ≤ 300)', () => {
    it('parses "21" as 21', () => {
      expect(parseDistanceKm('21')).toBe(21);
    });
    it('parses "42" as 42', () => {
      expect(parseDistanceKm('42')).toBe(42);
    });
    it('parses "0.6" as 0.6', () => {
      expect(parseDistanceKm('0.6')).toBe(0.6);
    });
    it('parses "06" as 6', () => {
      expect(parseDistanceKm('06')).toBe(6);
    });
    it('parses "100" as 100', () => {
      expect(parseDistanceKm('100')).toBe(100);
    });
    it('rejects out-of-range bare "500"', () => {
      expect(parseDistanceKm('500')).toBeNull();
    });
  });

  describe('comma decimal (legacy vendor format)', () => {
    it('parses "6,8" as 6.8', () => {
      expect(parseDistanceKm('6,8')).toBe(6.8);
    });
  });

  describe('unknown / unparseable', () => {
    it.each(['', '   ', 'KID', 'KID ', 'AQUA TRAIL: 10K', '10 mile race'])(
      'returns null for "%s"',
      (s) => {
        expect(parseDistanceKm(s)).toBeNull();
      },
    );
    it('returns null for null/undefined', () => {
      expect(parseDistanceKm(null)).toBeNull();
      expect(parseDistanceKm(undefined)).toBeNull();
    });
  });

  describe('whitespace tolerance', () => {
    it('trims surrounding whitespace', () => {
      expect(parseDistanceKm('  200m  ')).toBe(0.2);
      expect(parseDistanceKm('  21KM ')).toBe(21);
    });
  });
});
