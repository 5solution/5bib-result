/**
 * F-019 v2 — VendorMismatchDetectorService unit tests.
 *
 * Pattern H threshold:
 *   - Lệch 1 BIB → tier 2 WARNING.
 *   - Lệch 2+ BIB → tier 1 ALERT (block publish).
 *   - Bracket khác hẳn → tier 1 CRITICAL (data integrity).
 */
import { VendorMismatchDetectorService } from '../services/vendor-mismatch-detector.service';
import type { AGBucketResult } from '../services/ag-bracket-calc.service';
import type { NormalizedAthlete } from '../services/normalize-vendor-quirks.service';

const mkAthlete = (
  bib: string,
  category: string,
  chipMs: number,
): NormalizedAthlete => ({
  bib,
  raceId: 'r1',
  courseId: 'c1',
  chipTimeMs: chipMs,
  gunTimeMs: null,
  paceSecPerKm: null,
  status: 'FIN',
  gender: 'M',
  vendorAgeGroup: category,
  hasFinishChipRead: true,
  lastSplitRank: null,
  lastSplitDistanceKm: null,
  lastSplitElapsedSec: null,
  splitsCount: 0,
  finishReadCount: 1,
  raw: {},
});

const mkBucket = (bibs: string[]): AGBucketResult => ({
  ageGroupKey: '30-39',
  ageGroup: '30-39',
  ageGroupLabel: 'Nam 30-39',
  gender: 'M',
  athletes: bibs.map((bib, idx) => ({
    bib,
    rank: idx + 1,
    chipTimeMs: 7_200_000 + idx * 1000,
    gender: 'M',
    tied: false,
  })),
});

describe('VendorMismatchDetectorService', () => {
  let svc: VendorMismatchDetectorService;

  beforeEach(() => {
    svc = new VendorMismatchDetectorService();
  });

  it('happy path — top-3 identical → no mismatch', () => {
    const buckets = [mkBucket(['1', '2', '3'])];
    const athletes = [
      mkAthlete('1', 'Nam 30-39', 7_200_000),
      mkAthlete('2', 'Nam 30-39', 7_201_000),
      mkAthlete('3', 'Nam 30-39', 7_202_000),
    ];
    expect(svc.detectMismatches(buckets, athletes)).toEqual([]);
  });

  it('lệch 1 BIB → tier 2 WARNING', () => {
    const buckets = [mkBucket(['1', '2', '4'])];
    const athletes = [
      mkAthlete('1', 'Nam 30-39', 7_200_000),
      mkAthlete('2', 'Nam 30-39', 7_201_000),
      mkAthlete('3', 'Nam 30-39', 7_202_000),
      mkAthlete('4', 'Nam 30-39', 7_203_000),
    ];
    const results = svc.detectMismatches(buckets, athletes);
    expect(results).toHaveLength(1);
    expect(results[0].pattern).toBe('H');
    expect(results[0].tier).toBe(2);
    expect(results[0].evidence.severityLabel).toBe('WARNING');
  });

  it('lệch 2 BIB → tier 1 ALERT', () => {
    const buckets = [mkBucket(['1', '4', '5'])];
    const athletes = [
      mkAthlete('1', 'Nam 30-39', 7_200_000),
      mkAthlete('2', 'Nam 30-39', 7_201_000),
      mkAthlete('3', 'Nam 30-39', 7_202_000),
      mkAthlete('4', 'Nam 30-39', 7_203_000),
      mkAthlete('5', 'Nam 30-39', 7_204_000),
    ];
    const results = svc.detectMismatches(buckets, athletes);
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe(1);
    expect(results[0].evidence.severityLabel).toBe('ALERT');
  });

  it('bracket khác hẳn → tier 1 CRITICAL', () => {
    const buckets = [mkBucket(['100', '101', '102'])];
    const athletes = [
      // 5BIB tính M30-39 nhưng vendor mapping toàn bộ M40-49.
      mkAthlete('100', 'Nam 40-49', 7_200_000),
      mkAthlete('101', 'Nam 40-49', 7_201_000),
      mkAthlete('102', 'Nam 40-49', 7_202_000),
      // Vendor M30-39 hoàn toàn khác BIBs.
      mkAthlete('200', 'Nam 30-39', 7_300_000),
      mkAthlete('201', 'Nam 30-39', 7_301_000),
      mkAthlete('202', 'Nam 30-39', 7_302_000),
    ];
    const results = svc.detectMismatches(buckets, athletes);
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe(1);
    expect(results[0].evidence.severityLabel).toBe('CRITICAL');
    expect(results[0].evidence.bracketMismatch).toBe(true);
  });

  it('vendor không có bucket matching (Giải Công An " " whitespace) → skip emit', () => {
    const buckets = [mkBucket(['1', '2', '3'])];
    // Vendor đẩy whitespace category — buildVendorTop3PerBucket bỏ qua → no
    // matching bucket → no Pattern H emit (vendor data gap, không phải mismatch).
    const athletes = [
      mkAthlete('1', ' ', 7_200_000),
      mkAthlete('2', ' ', 7_201_000),
      mkAthlete('3', ' ', 7_202_000),
    ];
    expect(svc.detectMismatches(buckets, athletes)).toEqual([]);
  });
});
