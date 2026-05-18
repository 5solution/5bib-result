import { slugify, slugifyWithYear } from './slugify';

describe('slugify util', () => {
  describe('slugify()', () => {
    it('strips Vietnamese diacritics', () => {
      expect(slugify('Đà Lạt')).toBe('da-lat');
      expect(slugify('Hồ Chí Minh')).toBe('ho-chi-minh');
      expect(slugify('Huế')).toBe('hue');
    });

    it('handles đ/Đ Vietnamese-specific', () => {
      expect(slugify('Đông Đô')).toBe('dong-do');
      expect(slugify('đường')).toBe('duong');
    });

    it('lowercases and kebab-cases', () => {
      expect(slugify('VnExpress Marathon HCM')).toBe(
        'vnexpress-marathon-hcm',
      );
    });

    it('collapses special chars to single dash', () => {
      expect(slugify('Test@2026!')).toBe('test-2026');
      expect(slugify('a   b  c')).toBe('a-b-c');
    });

    it('collapses consecutive dashes', () => {
      expect(slugify('test--abc')).toBe('test-abc');
      expect(slugify('a---b')).toBe('a-b');
    });

    it('trims leading/trailing dashes', () => {
      expect(slugify('-test-')).toBe('test');
      expect(slugify('---hello---')).toBe('hello');
    });

    it('truncates at 80 chars', () => {
      const longTitle = 'a'.repeat(100);
      expect(slugify(longTitle).length).toBeLessThanOrEqual(80);
    });

    it('returns empty for null/undefined/empty', () => {
      expect(slugify(null)).toBe('');
      expect(slugify(undefined)).toBe('');
      expect(slugify('')).toBe('');
    });

    it('returns empty for only special chars', () => {
      expect(slugify('@@@!!!###')).toBe('');
    });
  });

  describe('slugifyWithYear()', () => {
    it('appends year from startDate', () => {
      expect(
        slugifyWithYear('VnExpress Marathon HCM', '2026-01-15T00:00:00Z'),
      ).toBe('vnexpress-marathon-hcm-2026');
    });

    it('returns base slug when no startDate', () => {
      expect(slugifyWithYear('Hello World', null)).toBe('hello-world');
    });

    it('returns empty when title empty', () => {
      expect(slugifyWithYear('', '2026-01-15')).toBe('');
    });

    it('handles Date object', () => {
      expect(slugifyWithYear('Race', new Date('2025-06-01'))).toBe('race-2025');
    });
  });
});
