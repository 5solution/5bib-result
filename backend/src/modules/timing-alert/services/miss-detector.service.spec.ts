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

/** Course với 6 CP cho gap test (Start, TM1, TM2, TM3, TM4, Finish). */
const CP_42KM_6PTS: CourseCheckpoint[] = [
  { key: 'Start', distance_km: 0 },
  { key: 'TM1', distance_km: 8 },
  { key: 'TM2', distance_km: 16 },
  { key: 'TM3', distance_km: 24 },
  { key: 'TM4', distance_km: 32 },
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
      const results = service.detect(a, CP_42KM, 30);
      const phantom = results.find((r) => r.type === 'PHANTOM');
      expect(phantom).toBeDefined();
      expect(phantom!.isPhantom).toBe(true);
      expect(phantom!.lastSeenPoint).toBe('TM2');
      expect(phantom!.missingPoint).toBe('TM3');
      expect(phantom!.isMissingFinish).toBe(false);
      expect(phantom!.overdueMinutes).toBeGreaterThanOrEqual(30);
      expect(phantom!.projectedFinishTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
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
      const results = service.detect(a, CP_42KM, 30);
      const phantom = results.find((r) => r.type === 'PHANTOM');
      expect(phantom).toBeDefined();
      expect(phantom!.missingPoint).toBe('Finish');
      expect(phantom!.isMissingFinish).toBe(true);
      expect(phantom!.overdueMinutes).toBeGreaterThanOrEqual(30);
    });

    it('returns empty for athlete who finished (last seen IS Finish)', () => {
      const a = athlete({
        lastSeenPoint: 'Finish',
        lastSeenTime: '04:30:00',
        checkpointTimes: { Finish: '04:30:00' },
      });
      const results = service.detect(a, CP_42KM, 30);
      // No middle gaps (Start là idx 0, skipped) + no phantom (lastSeen=Finish)
      expect(results.filter((r) => r.type === 'PHANTOM')).toHaveLength(0);
    });

    it('returns empty for athlete with NO checkpoint times (DNS)', () => {
      const a = athlete({ lastSeenPoint: null, lastSeenTime: null });
      const results = service.detect(a, CP_42KM, 30);
      expect(results).toHaveLength(0);
    });

    it('returns empty for Start-only athlete (no pace baseline)', () => {
      const a = athlete({
        lastSeenPoint: 'Start',
        lastSeenTime: '06:00:00',
        checkpointTimes: { Start: '06:00:00' },
      });
      const results = service.detect(a, CP_42KM, 30);
      expect(results.filter((r) => r.type === 'PHANTOM')).toHaveLength(0);
    });

    it('does NOT flag PHANTOM if overdue below threshold', () => {
      const a = athlete({
        lastSeenPoint: 'TM2',
        lastSeenTime: '01:30:00',
        checkpointTimes: { TM2: '01:30:00' },
      });
      const results = service.detect(a, CP_42KM, 60);
      expect(results.filter((r) => r.type === 'PHANTOM')).toHaveLength(0);
    });

    // ─── Phase 3 — Middle gap detection ───

    it('TM2 → TM4 missing TM3 → 1 MIDDLE_GAP at TM3', () => {
      const a = athlete({
        lastSeenPoint: 'TM4',
        lastSeenTime: '04:00:00',
        checkpointTimes: {
          Start: '00:00:00',
          TM1: '01:00:00',
          TM2: '02:00:00',
          TM4: '04:00:00', // skip TM3
        },
      });
      const results = service.detect(a, CP_42KM_6PTS, 30);
      const gaps = results.filter((r) => r.type === 'MIDDLE_GAP');
      expect(gaps).toHaveLength(1);
      expect(gaps[0].missingPoint).toBe('TM3');
      expect(gaps[0].lastSeenPoint).toBe('TM4');
    });

    it('TM1+TM4 only (skip TM2+TM3) → 2 MIDDLE_GAPs', () => {
      const a = athlete({
        lastSeenPoint: 'TM4',
        lastSeenTime: '04:00:00',
        checkpointTimes: {
          Start: '00:00:00',
          TM1: '01:00:00',
          TM4: '04:00:00',
        },
      });
      const results = service.detect(a, CP_42KM_6PTS, 30);
      const gaps = results
        .filter((r) => r.type === 'MIDDLE_GAP')
        .map((g) => g.missingPoint)
        .sort();
      expect(gaps).toEqual(['TM2', 'TM3']);
    });

    it('Start không bao giờ bị flag là middle gap (idx 0 skipped)', () => {
      const a = athlete({
        lastSeenPoint: 'TM2',
        lastSeenTime: '02:00:00',
        checkpointTimes: { TM1: '01:00:00', TM2: '02:00:00' }, // Start empty
      });
      const results = service.detect(a, CP_42KM, 30);
      const gaps = results.filter((r) => r.type === 'MIDDLE_GAP');
      expect(gaps.find((g) => g.missingPoint === 'Start')).toBeUndefined();
    });
  });

  describe('classifySeverity()', () => {
    const baseDetection = {
      type: 'PHANTOM' as const,
      isPhantom: true,
      isMissingFinish: true,
      lastSeenPoint: 'TM3',
      lastSeenTime: '03:30:00',
      missingPoint: 'Finish',
      overdueMinutes: 45,
      projectedFinishTime: '04:30:00',
      projectedFinishSeconds: 16200,
    };

    it('MIDDLE_GAP → severity INFO when not Top N', () => {
      const result = service.classifySeverity(
        { ...baseDetection, type: 'MIDDLE_GAP', missingPoint: 'TM3', lastSeenPoint: 'TM4', isMissingFinish: false },
        { overallRank: 50, ageGroupRank: 20, confidence: 0.9, totalFinishers: 100 },
        3,
      );
      expect(result.severity).toBe('INFO');
    });

    it('MIDDLE_GAP → severity WARNING when Top N (rank ≤ topNAlert)', () => {
      const result = service.classifySeverity(
        { ...baseDetection, type: 'MIDDLE_GAP', missingPoint: 'TM3', lastSeenPoint: 'TM4', isMissingFinish: false },
        { overallRank: 2, ageGroupRank: 1, confidence: 0.9, totalFinishers: 100 },
        3,
      );
      expect(result.severity).toBe('WARNING');
    });

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
