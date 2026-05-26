/**
 * FEATURE-066 — Unit tests cho stripCompanyPrefix helper.
 * Coverage: 14 prefix variants + edge cases (empty, no prefix, whitespace).
 */
import { stripCompanyPrefix } from './strip-company-prefix.util';

describe('stripCompanyPrefix (F-066 BR-66-04)', () => {
  describe('CTCP variants', () => {
    it('strips CÔNG TY CỔ PHẦN full diacritics', () => {
      expect(stripCompanyPrefix('CÔNG TY CỔ PHẦN TÂM AN MEDIA')).toBe(
        'TAM AN MEDIA',
      );
    });
    it('strips CONG TY CO PHAN no diacritics', () => {
      expect(stripCompanyPrefix('Cong ty co phan ABC XYZ')).toBe('ABC XYZ');
    });
    it('strips CTCP abbreviation', () => {
      expect(stripCompanyPrefix('CTCP ABC')).toBe('ABC');
    });
    it('strips CTY CP variant', () => {
      expect(stripCompanyPrefix('CTY CP DEF GHI')).toBe('DEF GHI');
    });
  });

  describe('TNHH MTV variants (longest-match-first)', () => {
    it('strips CÔNG TY TNHH MỘT THÀNH VIÊN before TNHH', () => {
      expect(
        stripCompanyPrefix('CÔNG TY TNHH MỘT THÀNH VIÊN ABC XYZ'),
      ).toBe('ABC XYZ');
    });
    it('strips CTY TNHH MTV', () => {
      expect(stripCompanyPrefix('CTY TNHH MTV ABC')).toBe('ABC');
    });
    it('strips CTYTNHHMTV (no spaces)', () => {
      expect(stripCompanyPrefix('CTYTNHHMTV ABC')).toBe('ABC');
    });
  });

  describe('TNHH variants', () => {
    it('strips CÔNG TY TNHH', () => {
      expect(stripCompanyPrefix('CÔNG TY TNHH HOÀNG GIA')).toBe('HOANG GIA');
    });
    it('strips CTY TNHH', () => {
      expect(stripCompanyPrefix('CTY TNHH ABC')).toBe('ABC');
    });
  });

  describe('CTY / DNTN / HTX', () => {
    it('strips CÔNG TY (no TNHH/CP)', () => {
      expect(stripCompanyPrefix('CÔNG TY DUY ANH')).toBe('DUY ANH');
    });
    it('strips DNTN', () => {
      expect(stripCompanyPrefix('DNTN HOÀNG GIA')).toBe('HOANG GIA');
    });
    it('strips DOANH NGHIỆP TƯ NHÂN', () => {
      expect(stripCompanyPrefix('DOANH NGHIỆP TƯ NHÂN MAI ANH')).toBe(
        'MAI ANH',
      );
    });
    it('strips HỢP TÁC XÃ', () => {
      expect(stripCompanyPrefix('HỢP TÁC XÃ THÀNH CÔNG')).toBe('THANH CONG');
    });
    it('strips HTX', () => {
      expect(stripCompanyPrefix('HTX ABC')).toBe('ABC');
    });
  });

  describe('Edge cases', () => {
    it('empty string returns empty', () => {
      expect(stripCompanyPrefix('')).toBe('');
    });
    it('null returns empty', () => {
      expect(stripCompanyPrefix(null)).toBe('');
    });
    it('undefined returns empty', () => {
      expect(stripCompanyPrefix(undefined)).toBe('');
    });
    it('no prefix returns full ASCII uppercase', () => {
      expect(stripCompanyPrefix('Tâm An Media')).toBe('TAM AN MEDIA');
    });
    it('only prefix returns empty string (caller fallback CLIENT per BR-66-03)', () => {
      // "CÔNG TY TNHH" → matches CONG TY TNHH(\s+|$) → strip → "" → caller fallback CLIENT
      expect(stripCompanyPrefix('CÔNG TY TNHH')).toBe('');
      expect(stripCompanyPrefix('CTCP')).toBe('');
      expect(stripCompanyPrefix('DNTN  ')).toBe('');
    });
    it('does NOT strip recursively (CTCP CTCP ABC)', () => {
      expect(stripCompanyPrefix('CTCP CTCP ABC')).toBe('CTCP ABC');
    });
    it('collapses internal whitespace', () => {
      expect(stripCompanyPrefix('CTCP   ABC   XYZ')).toBe('ABC XYZ');
    });
  });
});
