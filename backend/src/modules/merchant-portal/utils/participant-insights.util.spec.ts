/**
 * FEATURE-072 — unit tests for participant-insights util (TC-01..08).
 * Jest (backend). Pure functions, messy-data defensive.
 */
import {
  parseAge,
  ageGroupWA,
  normalizeNationality,
  normalizeGender,
  aggregateParticipants,
  sizeSortIndex,
  UNKNOWN_LABEL,
  type RawParticipantRow,
} from './participant-insights.util';

const RACE_DAY = new Date('2026-06-08T00:00:00Z');

describe('participant-insights util', () => {
  describe('TC-01 parseAge', () => {
    it('parses YYYY-MM-DD / DD/MM/YYYY / YYYY', () => {
      expect(parseAge('1990-05-01', RACE_DAY)).toBe(36);
      expect(parseAge('01/05/1990', RACE_DAY)).toBe(36);
      expect(parseAge('1990', RACE_DAY)).toBe(36);
    });
    it('respects birthday-not-yet-this-year', () => {
      expect(parseAge('1990-12-31', RACE_DAY)).toBe(35); // bday after Jun 8
    });
    it('returns null for garbage / empty / implausible', () => {
      expect(parseAge('abc', RACE_DAY)).toBeNull();
      expect(parseAge('', RACE_DAY)).toBeNull();
      expect(parseAge(null, RACE_DAY)).toBeNull();
      expect(parseAge('3000', RACE_DAY)).toBeNull(); // future → negative age
      expect(parseAge('1850', RACE_DAY)).toBeNull(); // age>100
    });
  });

  describe('TC-02 ageGroupWA', () => {
    it('maps ages to WA bands', () => {
      expect(ageGroupWA(17)).toBe('<18');
      expect(ageGroupWA(18)).toBe('18-24');
      expect(ageGroupWA(24)).toBe('18-24');
      expect(ageGroupWA(25)).toBe('25-29');
      expect(ageGroupWA(34)).toBe('30-34');
      expect(ageGroupWA(69)).toBe('65-69');
      expect(ageGroupWA(70)).toBe('70+');
      expect(ageGroupWA(85)).toBe('70+');
    });
    it('null → Không rõ', () => {
      expect(ageGroupWA(null)).toBe(UNKNOWN_LABEL);
    });
  });

  describe('TC-03 normalizeNationality', () => {
    it('folds VN variants → Việt Nam', () => {
      for (const v of ['VN', 'vietnam', 'Việt Nam', 'VIE', 'Vietnamese']) {
        expect(normalizeNationality(v)).toBe('Việt Nam');
      }
    });
    it('keeps other countries, empty → Không rõ', () => {
      expect(normalizeNationality('Cambodia')).toBe('Cambodia');
      expect(normalizeNationality('  ')).toBe(UNKNOWN_LABEL);
      expect(normalizeNationality(null)).toBe(UNKNOWN_LABEL);
    });
  });

  describe('TC-04 normalizeGender', () => {
    it('maps variants', () => {
      expect(normalizeGender('male')).toBe('Nam');
      expect(normalizeGender('M')).toBe('Nam');
      expect(normalizeGender('nam')).toBe('Nam');
      expect(normalizeGender('female')).toBe('Nữ');
      expect(normalizeGender('F')).toBe('Nữ');
      expect(normalizeGender('x')).toBe('Khác');
      expect(normalizeGender(null)).toBe('Khác');
    });
  });

  describe('TC-05 size order', () => {
    it('sorts S<M<L<XL<2XL, unknown last', () => {
      const labels = ['L', 'S', 'XXL', 'M', 'Free'].sort(
        (a, b) => sizeSortIndex(a) - sizeSortIndex(b),
      );
      // note: aggregate canonicalises XXL→2XL & Free→Khác; here raw indices
      expect(sizeSortIndex('S')).toBeLessThan(sizeSortIndex('M'));
      expect(sizeSortIndex('M')).toBeLessThan(sizeSortIndex('L'));
      expect(sizeSortIndex('Free')).toBeGreaterThan(sizeSortIndex('4XL')); // unknown → last
      expect(labels[0]).toBe('S');
    });
  });

  const mkRow = (o: Partial<RawParticipantRow>): RawParticipantRow => ({
    tshirt_size: null,
    gender: null,
    dob: null,
    nationality: null,
    city_province: null,
    ...o,
  });

  describe('TC-05b small sizes XXS/2XS/3XS canonicalised (QC fix)', () => {
    const rows = [
      mkRow({ tshirt_size: 'XXS' }),
      mkRow({ tshirt_size: '2XS' }),
      mkRow({ tshirt_size: 'XS' }),
      mkRow({ tshirt_size: 'M' }),
    ];
    const agg = aggregateParticipants(rows, RACE_DAY);
    it('XXS + 2XS merge to 2XS, ordered before XS/M, none → Khác', () => {
      expect(agg.shirtSizes.find((s) => s.label === '2XS')?.count).toBe(2);
      const order = agg.shirtSizes.map((s) => s.label);
      expect(order.indexOf('2XS')).toBeLessThan(order.indexOf('XS'));
      expect(order.indexOf('XS')).toBeLessThan(order.indexOf('M'));
      expect(agg.shirtSizes.find((s) => s.label === 'Khác')).toBeUndefined();
    });
  });

  describe('TC-06 aggregate counts + total + size canonical order', () => {
    const rows = [
      mkRow({ tshirt_size: 'M', gender: 'male', dob: '1990-01-01', nationality: 'VN', city_province: 'Hà Nội' }),
      mkRow({ tshirt_size: 'XXL', gender: 'female', dob: '2010-01-01', nationality: 'Vietnam', city_province: 'Hà Nội' }),
      mkRow({ tshirt_size: 'S', gender: 'm', dob: 'garbage', nationality: 'Laos', city_province: '' }),
    ];
    const agg = aggregateParticipants(rows, RACE_DAY);
    it('total = row count', () => expect(agg.totalParticipants).toBe(3));
    it('genders counted', () => {
      expect(agg.genders.find((g) => g.label === 'Nam')?.count).toBe(2);
      expect(agg.genders.find((g) => g.label === 'Nữ')?.count).toBe(1);
    });
    it('size canonical order S before M before 2XL', () => {
      const order = agg.shirtSizes.map((s) => s.label);
      expect(order.indexOf('S')).toBeLessThan(order.indexOf('M'));
      expect(order.indexOf('M')).toBeLessThan(order.indexOf('2XL'));
    });
    it('VN variants merged', () => {
      expect(agg.nationalities.find((n) => n.label === 'Việt Nam')?.count).toBe(2);
    });
    it('garbage dob → Không rõ age bucket', () => {
      expect(agg.ageGroups.find((a) => a.label === UNKNOWN_LABEL)?.count).toBe(1);
    });
    it('empty province → Không rõ', () => {
      expect(agg.provinces.find((p) => p.label === UNKNOWN_LABEL)?.count).toBe(1);
    });
  });

  describe('TC-07 nationalities top-8 + Khác', () => {
    const rows: RawParticipantRow[] = [];
    // 12 distinct countries, 1 each
    for (let i = 0; i < 12; i++) {
      rows.push(mkRow({ nationality: `Country${i}` }));
    }
    const agg = aggregateParticipants(rows, RACE_DAY);
    it('returns 8 + Khác (9 buckets), Khác folds 4', () => {
      expect(agg.nationalities.length).toBe(9);
      expect(agg.nationalities[8].label).toBe('Khác');
      expect(agg.nationalities[8].count).toBe(4);
    });
  });

  describe('TC-08 empty rows', () => {
    const agg = aggregateParticipants([], RACE_DAY);
    it('all empty, total 0', () => {
      expect(agg.totalParticipants).toBe(0);
      expect(agg.shirtSizes).toEqual([]);
      expect(agg.genders).toEqual([]);
      expect(agg.ageGroups).toEqual([]);
      expect(agg.nationalities).toEqual([]);
      expect(agg.provinces).toEqual([]);
    });
  });
});
