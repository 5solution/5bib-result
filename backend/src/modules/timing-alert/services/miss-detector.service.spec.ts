import { Test, TestingModule } from '@nestjs/testing';
import { MissDetectorService } from './miss-detector.service';
import { CourseCheckpoint } from '../utils/parsed-athlete';
import { ParsedAthlete } from '../utils/parsed-athlete';

const CP_42KM: CourseCheckpoint[] = [
  { key: 'Start', distance_km: 0 },
  { key: 'TM1', distance_km: 10 },
  { key: 'TM2', distance_km: 21 },
  { key: 'TM3', distance_km: 32 },
  { key: 'Finish', distance_km: 42.195 },
];

function athlete(overrides: Partial<ParsedAthlete>): ParsedAthlete {
  return {
    bib: '98898',
    fullName: 'Đặng Đức',
    contest: '42KM',
    ageGroup: 'Nam 40-49',
    gender: 'Male',
    checkpointTimes: {},
    lastSeenPoint: null,
    lastSeenTime: null,
    raw: {} as any,
    ...overrides,
  };
}

describe('MissDetectorService', () => {
  let service: MissDetectorService;

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [MissDetectorService],
    }).compile();
    service = mod.get(MissDetectorService);
  });

  describe('detect()', () => {
    it('TA-5 Phantom Runner: TM2 seen, TM3 missing past threshold', () => {
      const a = athlete({
        lastSeenPoint: 'TM2',
        lastSeenTime: '02:00:00', // 2h elapsed at 21km → 5:42 pace
        checkpointTimes: { Start: '00:00:00', TM1: '00:55:00', TM2: '02:00:00' },
      });
      // expected at TM3 (32km): pace * 32 * 1.05 = (2*3600/21) * 32 * 1.05 = 11520s = 3h12m
      // gap = 11520 - 7200 = 4320s = 72 min → over threshold 30min
      const result = service.detect(a, CP_42KM, 30);
      expect(result).not.toBeNull();
      expect(result!.isPhantom).toBe(true);
      expect(result!.lastSeenPoint).toBe('TM2');
      expect(result!.missingPoint).toBe('TM3');
      expect(result!.isMissingFinish).toBe(false);
      expect(result!.overdueMinutes).toBeGreaterThanOrEqual(30);
      // Projected finish: pace × 42.195 × 1.05
      // = (2h/21km) × 42.195 × 1.05 = 4.219h ≈ 04:13:?? Some seconds.
      expect(result!.projectedFinishTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('TA-6 SYNTHETIC BIB 98898: Missing FINISH after TM2 (case fix race 192)', () => {
      // Synthetic fixture mô phỏng state lúc sự cố (Finish = empty)
      const a = athlete({
        bib: '98898',
        ageGroup: 'Nam 40-49',
        lastSeenPoint: 'TM3', // last point have time
        lastSeenTime: '03:30:00',
        checkpointTimes: {
          Start: '00:00:00',
          TM1: '01:00:00',
          TM2: '02:00:00',
          TM3: '03:30:00',
          Finish: '', // empty — vendor format khi miss Finish
        },
      });
      // pace at TM3 = 3.5h/32km → expected Finish = pace × 42.195 × 1.05 ≈ 4:51:??
      // gap from TM3 = expected - lastSeenSeconds = 4.85*3600 - 3.5*3600 = 4860s = 81min
      const result = service.detect(a, CP_42KM, 30);
      expect(result).not.toBeNull();
      expect(result!.missingPoint).toBe('Finish');
      expect(result!.isMissingFinish).toBe(true);
      expect(result!.overdueMinutes).toBeGreaterThanOrEqual(30);
    });

    it('returns null for athlete who finished (last seen IS Finish)', () => {
      const a = athlete({
        lastSeenPoint: 'Finish',
        lastSeenTime: '04:30:00',
        checkpointTimes: { Finish: '04:30:00' },
      });
      const result = service.detect(a, CP_42KM, 30);
      expect(result).toBeNull();
    });

    it('returns null for athlete with NO checkpoint times (DNS)', () => {
      const a = athlete({ lastSeenPoint: null, lastSeenTime: null });
      const result = service.detect(a, CP_42KM, 30);
      expect(result).toBeNull();
    });

    it('returns null for Start-only athlete (no pace baseline)', () => {
      const a = athlete({
        lastSeenPoint: 'Start',
        lastSeenTime: '06:00:00',
        checkpointTimes: { Start: '06:00:00' },
      });
      // distance_km=0 → cannot derive pace
      const result = service.detect(a, CP_42KM, 30);
      expect(result).toBeNull();
    });

    it('does NOT flag if overdue below threshold', () => {
      // Fast pace — expected TM3 close to lastSeen, gap < 30min
      const a = athlete({
        lastSeenPoint: 'TM2',
        lastSeenTime: '01:30:00', // 1.5h at 21km → ~4:17 pace
        checkpointTimes: { TM2: '01:30:00' },
      });
      // Expected TM3 = 1.5h/21 × 32 × 1.05 = 8640s = 2:24
      // Gap = 2:24 - 1:30 = 54 min > 30 min threshold
      // So this WILL flag. Adjust to test threshold guard:
      const result = service.detect(a, CP_42KM, 60); // threshold 60min
      // 54 min < 60 min → no flag
      expect(result).toBeNull();
    });
  });

  describe('classifySeverity()', () => {
    const baseDetection = {
      isPhantom: true,
      isMissingFinish: true,
      lastSeenPoint: 'TM3',
      lastSeenTime: '03:30:00',
      missingPoint: 'Finish',
      overdueMinutes: 45,
      projectedFinishTime: '04:30:00',
      projectedFinishSeconds: 16200,
    };

    it('CRITICAL when projected age group rank ≤ topN', () => {
      const result = service.classifySeverity(
        baseDetection,
        { overallRank: 15, ageGroupRank: 2, confidence: 0.9, totalFinishers: 100 },
        3, // topN
      );
      expect(result.severity).toBe('CRITICAL');
      expect(result.reason).toMatch(/Top 2 age group/);
      expect(result.reason).toMatch(/miss FINISH/);
    });

    it('CRITICAL when projected overall rank ≤ topN', () => {
      const result = service.classifySeverity(
        baseDetection,
        { overallRank: 1, ageGroupRank: 50, confidence: 0.9, totalFinishers: 100 },
        3,
      );
      expect(result.severity).toBe('CRITICAL');
      expect(result.reason).toMatch(/Top 1 overall/);
    });

    it('HIGH when rank ≤ 10', () => {
      const result = service.classifySeverity(
        baseDetection,
        { overallRank: 7, ageGroupRank: 8, confidence: 0.9, totalFinishers: 100 },
        3,
      );
      expect(result.severity).toBe('HIGH');
    });

    it('WARNING when missing finish but not top 10', () => {
      const result = service.classifySeverity(
        baseDetection,
        { overallRank: 50, ageGroupRank: 30, confidence: 0.9, totalFinishers: 100 },
        3,
      );
      expect(result.severity).toBe('WARNING');
    });

    it('INFO when phantom non-finish + not top 10', () => {
      const phantom = { ...baseDetection, isMissingFinish: false, missingPoint: 'TM3' };
      const result = service.classifySeverity(
        phantom,
        { overallRank: 100, ageGroupRank: 50, confidence: 0.5, totalFinishers: 50 },
        3,
      );
      expect(result.severity).toBe('INFO');
    });

    it('WARNING degraded when projectedRank null + missing finish', () => {
      const result = service.classifySeverity(baseDetection, null, 3);
      expect(result.severity).toBe('WARNING');
      expect(result.reason).toMatch(/projected rank unavailable/);
    });

    it('INFO degraded when projectedRank null + phantom non-finish', () => {
      const phantom = { ...baseDetection, isMissingFinish: false };
      const result = service.classifySeverity(phantom, null, 3);
      expect(result.severity).toBe('INFO');
    });
  });
});
