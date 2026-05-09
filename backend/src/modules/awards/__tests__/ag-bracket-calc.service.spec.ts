/**
 * F-019 — AGBracketCalcService unit tests.
 *
 * Coverage (12 cases):
 *  - happy: WA TR9 boundary (đúng tuổi 30 → bracket 30-39)
 *  - edge: missing DOB without vendorAgeGroup → excluded
 *  - edge: vendor age group string fallback (Path B)
 *  - happy: tie ex-aequo (BR-AG-10) — 2 athletes share rank, skip next
 *  - happy: compounding mode WA-style (top overall vẫn eligible AG)
 *  - happy: mutually_exclusive mode (overall top excluded)
 *  - edge: WA boundary 'lower' override
 *  - edge: athlete < min bracket → excluded (under 18)
 *  - edge: athlete > max bracket → assigned highest "60+"
 *  - edge: DOB leap-day (2/29/1996) vs race-day (2/28/2026 non-leap) → tính theo 1/3 (Bộ luật Dân sự VN Đ.30)
 *  - validation: invalid input rejected gracefully
 *  - happy: bib tie-breaker numeric vs string fallback
 */

import { AGBracketCalcService } from '../services/ag-bracket-calc.service';
import { VN_ROAD_DEFAULT_PRESET } from '../constants/ag-presets';

const svc = new AGBracketCalcService();

describe('AGBracketCalcService — BR-AG-01..10', () => {
  describe('computeAge (BR-AG-01)', () => {
    it('returns full year diff khi birthday đã qua trong race year', () => {
      const dob = new Date(Date.UTC(1995, 2, 15)); // 15 Mar 1995
      const raceDay = new Date(Date.UTC(2026, 4, 9)); // 9 May 2026
      expect(svc.computeAge(dob, raceDay)).toBe(31);
    });

    it('returns year diff - 1 khi race-day trước birthday trong race year (BR-AG-01)', () => {
      const dob = new Date(Date.UTC(1995, 5, 15)); // 15 Jun 1995
      const raceDay = new Date(Date.UTC(2026, 4, 9)); // 9 May 2026 — chưa qua birthday
      expect(svc.computeAge(dob, raceDay)).toBe(30);
    });

    it('handles leap-day DOB 29/2/1996 vs race-day 28/2/2026 (BR-AG-02)', () => {
      const dob = new Date(Date.UTC(1996, 1, 29));
      const raceDay = new Date(Date.UTC(2026, 1, 28));
      // Bộ luật Dân sự VN Điều 30 — tính theo 01/03 → tuổi 29
      expect(svc.computeAge(dob, raceDay)).toBe(29);
    });
  });

  describe('assignBracket (BR-AG-03)', () => {
    it('đúng tuổi 30 → bracket 30-39 (WA TR9 upper boundary inclusive)', () => {
      const b = svc.assignBracket(30, 'M', VN_ROAD_DEFAULT_PRESET);
      expect(b?.label).toBe('Nam 30-39');
    });

    it('age 29 → bracket 18-29 (boundary inclusive lower)', () => {
      const b = svc.assignBracket(29, 'M', VN_ROAD_DEFAULT_PRESET);
      expect(b?.label).toBe('Nam 18-29');
    });

    it('age 17 → null (BR-AG-04 dưới min bracket excluded)', () => {
      const b = svc.assignBracket(17, 'M', VN_ROAD_DEFAULT_PRESET);
      expect(b).toBeNull();
    });

    it('age 75 → bracket 60+ (BR-AG-04 cao nhất)', () => {
      const b = svc.assignBracket(75, 'F', VN_ROAD_DEFAULT_PRESET);
      expect(b?.label).toBe('Nữ 60+');
    });
  });

  describe('parseVendorAgeGroup (BR-AG-39 Path B fallback)', () => {
    it('parses "Nam 30-39" → bracket M_30-39', () => {
      const b = svc.parseVendorAgeGroup('Nam 30-39', 'M', VN_ROAD_DEFAULT_PRESET);
      expect(b?.label).toBe('Nam 30-39');
    });

    it('parses "Nữ 60+" → bracket F_60+', () => {
      const b = svc.parseVendorAgeGroup('Nữ 60+', 'F', VN_ROAD_DEFAULT_PRESET);
      expect(b?.label).toBe('Nữ 60+');
    });

    it('returns null for unparseable string', () => {
      const b = svc.parseVendorAgeGroup('Open', 'M', VN_ROAD_DEFAULT_PRESET);
      expect(b).toBeNull();
    });
  });

  describe('rankAthletes (BR-AG-10 + WA TR25 tie-breaker)', () => {
    it('sorts by chipTimeMs ASC + ex-aequo skip rank', () => {
      const ranked = svc.rankAthletes(
        [
          { bib: '1', gender: 'M', chipTimeMs: 7200000, gunTimeMs: 7200000 },
          { bib: '2', gender: 'M', chipTimeMs: 7200000, gunTimeMs: 7200000 },
          { bib: '3', gender: 'M', chipTimeMs: 7300000, gunTimeMs: 7300000 },
        ],
        3,
      );
      // 2 tied at rank 1, next rank skips to 3
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(1);
      expect(ranked[2].rank).toBe(3);
      expect(ranked[0].tied).toBe(true);
      expect(ranked[1].tied).toBe(true);
    });

    it('falls back to gunTimeMs when chipTimeMs match', () => {
      const ranked = svc.rankAthletes(
        [
          { bib: '1', gender: 'M', chipTimeMs: 7200000, gunTimeMs: 7300000 },
          { bib: '2', gender: 'M', chipTimeMs: 7200000, gunTimeMs: 7200000 },
        ],
        3,
      );
      expect(ranked[0].bib).toBe('2');
    });

    it('falls back to bib numeric when chip+gun match', () => {
      const ranked = svc.rankAthletes(
        [
          { bib: '5', gender: 'M', chipTimeMs: 7200000, gunTimeMs: 7200000 },
          { bib: '1', gender: 'M', chipTimeMs: 7200000, gunTimeMs: 7200000 },
        ],
        3,
      );
      expect(ranked[0].bib).toBe('1');
    });

    it('excludes athletes without chipTimeMs', () => {
      const ranked = svc.rankAthletes(
        [
          { bib: '1', gender: 'M', chipTimeMs: null, gunTimeMs: null },
          { bib: '2', gender: 'M', chipTimeMs: 7200000, gunTimeMs: 7200000 },
        ],
        3,
      );
      expect(ranked.length).toBe(1);
      expect(ranked[0].bib).toBe('2');
    });
  });

  describe('computeAGBuckets — full pipeline', () => {
    const raceDay = new Date(Date.UTC(2026, 4, 9));

    it('groups athletes by AG × gender via Path B vendorAgeGroup', () => {
      // F-019 v2 — Path B requires bracketSource='vendor' or 'hybrid' (default '5bib' chỉ Path A).
      const buckets = svc.computeAGBuckets(
        [
          { bib: '1', gender: 'M', vendorAgeGroup: 'Nam 30-39', chipTimeMs: 7200000, gunTimeMs: 7200000 },
          { bib: '2', gender: 'M', vendorAgeGroup: 'Nam 30-39', chipTimeMs: 7300000, gunTimeMs: 7300000 },
          { bib: '3', gender: 'F', vendorAgeGroup: 'Nữ 30-39', chipTimeMs: 7400000, gunTimeMs: 7400000 },
        ],
        { presetKey: 'vn_road_default', raceDay, agTopN: 3, compoundingMode: 'compounding', bracketSource: 'vendor' },
      );
      expect(buckets.length).toBe(2);
      const m = buckets.find((b) => b.gender === 'M');
      expect(m?.athletes.length).toBe(2);
      expect(m?.athletes[0].rank).toBe(1);
    });

    it('mutually_exclusive mode excludes overall top from AG buckets', () => {
      const buckets = svc.computeAGBuckets(
        [
          { bib: '1', gender: 'M', vendorAgeGroup: 'Nam 30-39', chipTimeMs: 7000000, gunTimeMs: 7000000 },
          { bib: '2', gender: 'M', vendorAgeGroup: 'Nam 30-39', chipTimeMs: 7100000, gunTimeMs: 7100000 },
          { bib: '3', gender: 'M', vendorAgeGroup: 'Nam 30-39', chipTimeMs: 7200000, gunTimeMs: 7200000 },
          { bib: '4', gender: 'M', vendorAgeGroup: 'Nam 30-39', chipTimeMs: 7300000, gunTimeMs: 7300000 },
          { bib: '5', gender: 'M', vendorAgeGroup: 'Nam 30-39', chipTimeMs: 7400000, gunTimeMs: 7400000 },
        ],
        {
          presetKey: 'vn_road_default',
          raceDay,
          agTopN: 3,
          compoundingMode: 'mutually_exclusive',
          excludeOverallTopN: 3,
          bracketSource: 'vendor',
        },
      );
      const m = buckets.find((b) => b.gender === 'M');
      // Top 3 overall (bib 1/2/3) excluded; AG = bib 4/5
      const bibs = m!.athletes.map((a) => a.bib).sort();
      expect(bibs).toEqual(['4', '5']);
    });

    it('excludes athletes without DOB and without vendorAgeGroup (hybrid mode)', () => {
      // F-019 v2 — must explicitly use hybrid mode để Path B fallback kick in.
      // Default '5bib' mode KHÔNG fallback Path B (PAUSE-RACE-V2-C LOCKED).
      const buckets = svc.computeAGBuckets(
        [
          { bib: '1', gender: 'M', chipTimeMs: 7200000, gunTimeMs: 7200000 }, // no DOB no vendor AG
          { bib: '2', gender: 'M', vendorAgeGroup: 'Nam 30-39', chipTimeMs: 7300000, gunTimeMs: 7300000 },
        ],
        { presetKey: 'vn_road_default', raceDay, bracketSource: 'hybrid' },
      );
      const m = buckets.find((b) => b.gender === 'M');
      expect(m?.athletes.length).toBe(1);
      expect(m?.athletes[0].bib).toBe('2');
    });
  });

  // ── F-019 v2 NEW tests — gender normalize + whitespace trim + bracketSource ──
  describe('F-019 v2 — gender normalize + whitespace + bracketSource', () => {
    const raceDay = new Date(Date.UTC(2026, 4, 9));

    it('accepts vendor gender "Male"/"Female" (was filter bug v1)', () => {
      const buckets = svc.computeAGBuckets(
        [
          {
            bib: '1',
            gender: 'Male' as unknown as 'M',
            vendorAgeGroup: 'Nam 30-39',
            chipTimeMs: 7_200_000,
            gunTimeMs: null,
          },
          {
            bib: '2',
            gender: 'female' as unknown as 'F',
            vendorAgeGroup: 'Nu 30-39',
            chipTimeMs: 8_000_000,
            gunTimeMs: null,
          },
        ],
        { presetKey: 'vn_road_default', raceDay, bracketSource: 'vendor' },
      );
      // Both athletes should be accepted with normalized gender → 2 buckets.
      expect(buckets.length).toBe(2);
      expect(buckets.find((b) => b.gender === 'M')?.athletes[0].bib).toBe('1');
      expect(buckets.find((b) => b.gender === 'F')?.athletes[0].bib).toBe('2');
    });

    it('accepts VN gender "Nam"/"Nữ"', () => {
      const buckets = svc.computeAGBuckets(
        [
          {
            bib: '1',
            gender: 'Nam' as unknown as 'M',
            vendorAgeGroup: 'Nam 30-39',
            chipTimeMs: 7_200_000,
            gunTimeMs: null,
          },
        ],
        { presetKey: 'vn_road_default', raceDay, bracketSource: 'vendor' },
      );
      expect(buckets.length).toBe(1);
    });

    it('whitespace-only vendor category (Giải Công An bug) → excluded khi không có age', () => {
      const buckets = svc.computeAGBuckets(
        [
          {
            bib: '1',
            gender: 'M',
            vendorAgeGroup: ' ',
            chipTimeMs: 7_200_000,
            gunTimeMs: null,
          },
          {
            bib: '2',
            gender: 'M',
            vendorAgeGroup: '',
            chipTimeMs: 7_300_000,
            gunTimeMs: null,
          },
        ],
        { presetKey: 'vn_road_default', raceDay, bracketSource: 'vendor' },
      );
      // Both whitespace/empty → no Path B fallback → no bucket.
      expect(buckets.length).toBe(0);
    });

    it('bracketSource=5bib uses ageOnRaceDay primary (Path A)', () => {
      const buckets = svc.computeAGBuckets(
        [
          {
            bib: '1',
            gender: 'M',
            ageOnRaceDay: 35,
            vendorAgeGroup: 'WrongCategory', // ignored cho 5bib mode
            chipTimeMs: 7_200_000,
            gunTimeMs: null,
          },
        ],
        { presetKey: 'vn_road_default', raceDay, bracketSource: '5bib' },
      );
      expect(buckets.length).toBe(1);
      expect(buckets[0].ageGroup).toBe('30-39');
      expect(buckets[0].athletes[0].ageOnRaceDay).toBe(35);
    });

    it('bracketSource=hybrid: Path A first, fallback Path B', () => {
      const buckets = svc.computeAGBuckets(
        [
          {
            bib: 'has-age',
            gender: 'M',
            ageOnRaceDay: 45,
            chipTimeMs: 7_200_000,
            gunTimeMs: null,
          },
          {
            bib: 'no-age',
            gender: 'M',
            vendorAgeGroup: 'Nam 30-39',
            chipTimeMs: 7_300_000,
            gunTimeMs: null,
          },
        ],
        { presetKey: 'vn_road_default', raceDay, bracketSource: 'hybrid' },
      );
      // hashAge → bracket 40-49, no-age → vendor parse → 30-39. 2 buckets.
      expect(buckets.length).toBe(2);
    });

    it('bracketSource=5bib excludes athlete thiếu DOB (no fallback)', () => {
      const buckets = svc.computeAGBuckets(
        [
          {
            bib: '1',
            gender: 'M',
            vendorAgeGroup: 'Nam 30-39', // ignored bởi 5bib mode
            chipTimeMs: 7_200_000,
            gunTimeMs: null,
          },
        ],
        { presetKey: 'vn_road_default', raceDay, bracketSource: '5bib' },
      );
      expect(buckets.length).toBe(0);
    });
  });

  // ── F-019 v2.1 NEW tests — VN amateur compounding rule (Path A ageOnRaceDay) ──
  describe('F-019 v2.1 — VN amateur compounding rule (mutually_exclusive default)', () => {
    const raceDay = new Date(Date.UTC(2026, 4, 9));

    it('mutually_exclusive: top 3 overall EXCLUDED khỏi AG buckets (VN convention)', () => {
      const buckets = svc.computeAGBuckets(
        [
          { bib: 'A', name: 'A', gender: 'M', ageOnRaceDay: 30, chipTimeMs: 1000, gunTimeMs: 1000 },
          { bib: 'B', name: 'B', gender: 'F', ageOnRaceDay: 25, chipTimeMs: 1100, gunTimeMs: 1100 },
          { bib: 'C', name: 'C', gender: 'M', ageOnRaceDay: 45, chipTimeMs: 1200, gunTimeMs: 1200 },
          { bib: 'D', name: 'D', gender: 'M', ageOnRaceDay: 35, chipTimeMs: 1300, gunTimeMs: 1300 },
          { bib: 'E', name: 'E', gender: 'M', ageOnRaceDay: 35, chipTimeMs: 1400, gunTimeMs: 1400 },
          { bib: 'F', name: 'F', gender: 'M', ageOnRaceDay: 35, chipTimeMs: 1500, gunTimeMs: 1500 },
        ],
        {
          presetKey: 'vn_road_default',
          raceDay,
          agTopN: 3,
          compoundingMode: 'mutually_exclusive',
          bracketSource: '5bib',
        },
      );
      const bucketM3039 = buckets.find((b) => b.ageGroupKey === 'M_30-39');
      // A (top 1 overall) bị exclude → top AG M_30-39 chỉ còn D, E, F
      expect(bucketM3039?.athletes.map((a) => a.bib)).toEqual(['D', 'E', 'F']);
    });

    it('compounding (WA TR9): top 3 overall VẪN được tính trong AG buckets', () => {
      const buckets = svc.computeAGBuckets(
        [
          { bib: 'A', name: 'A', gender: 'M', ageOnRaceDay: 35, chipTimeMs: 1000, gunTimeMs: 1000 },
          { bib: 'D', name: 'D', gender: 'M', ageOnRaceDay: 35, chipTimeMs: 1300, gunTimeMs: 1300 },
          { bib: 'E', name: 'E', gender: 'M', ageOnRaceDay: 35, chipTimeMs: 1400, gunTimeMs: 1400 },
          { bib: 'F', name: 'F', gender: 'M', ageOnRaceDay: 35, chipTimeMs: 1500, gunTimeMs: 1500 },
        ],
        {
          presetKey: 'vn_road_default',
          raceDay,
          agTopN: 3,
          compoundingMode: 'compounding',
          bracketSource: '5bib',
        },
      );
      const bucketM3039 = buckets.find((b) => b.ageGroupKey === 'M_30-39');
      // A vẫn lên top 1 AG (compounding mode)
      expect(bucketM3039?.athletes.map((a) => a.bib)).toEqual(['A', 'D', 'E']);
    });
  });
});
