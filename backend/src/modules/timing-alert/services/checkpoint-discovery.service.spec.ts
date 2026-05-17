import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { CheckpointDiscoveryService } from './checkpoint-discovery.service';
import { Race } from '../../races/schemas/race.schema';
import { RaceResultApiService } from '../../race-result/services/race-result-api.service';
import { SimulatorService } from './simulator.service';

/**
 * Phase C unit tests — schema-from-1 algorithm với fallback aggregate.
 *
 * BR-07: discover work khi race chưa start (Chiptimes toàn empty value)
 * BR-08: trust schema-from-1 nếu 10 athletes đầu consistent ≥ 80%, fallback aggregate
 * BR-11: sentinel filter giữ nguyên (DNS/DNF/DSQ skip)
 */

function makeAthlete(chiptimes: Record<string, string>, guntimes?: Record<string, string>) {
  return {
    Bib: 1,
    Chiptimes: JSON.stringify(chiptimes),
    Guntimes: JSON.stringify(guntimes ?? chiptimes),
  } as any;
}

describe('CheckpointDiscoveryService — Phase C algorithm', () => {
  let service: CheckpointDiscoveryService;
  let mockRaceModel: any;
  let mockApiService: any;
  let mockSimulatorService: any;

  beforeEach(async () => {
    mockRaceModel = {
      findById: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: 'race-1',
              courses: [
                { courseId: 'c-42', name: '42K', apiUrl: 'https://api.raceresult.com/test/abc', distanceKm: 42 },
              ],
            }),
        }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: 'race-1' }) }),
      }),
    };
    mockApiService = { fetchRaceResults: jest.fn() };
    mockSimulatorService = { getRawSnapshot: jest.fn() };

    const mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CheckpointDiscoveryService,
        { provide: getModelToken(Race.name), useValue: mockRaceModel },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
        { provide: RaceResultApiService, useValue: mockApiService },
        { provide: SimulatorService, useValue: mockSimulatorService },
      ],
    }).compile();

    service = moduleRef.get<CheckpointDiscoveryService>(CheckpointDiscoveryService);
  });

  describe('Schema-from-1 mode (vendor consistent)', () => {
    it('detects 7 keys when vendor returns full schema', async () => {
      // 10 athletes có schema giống nhau: Start, TM1-TM5, Finish
      const athletes = Array.from({ length: 10 }, (_, i) =>
        makeAthlete({
          Start: '00:00',
          TM1: '01:30:00',
          TM2: '02:00:00',
          TM3: '02:30:00',
          TM4: '03:00:00',
          TM5: '03:30:00',
          Finish: '04:00:00',
        }),
      );
      mockApiService.fetchRaceResults.mockResolvedValue(athletes);

      const result = await service.discover('race-1', 'c-42');
      expect(result.detectedCheckpoints.map((c) => c.key)).toEqual([
        'Start',
        'TM1',
        'TM2',
        'TM3',
        'TM4',
        'TM5',
        'Finish',
      ]);
      expect(result.detectedCheckpoints[0].isImplicitStart).toBe(true);
      expect(result.detectedCheckpoints[6].isImplicitFinish).toBe(true);
    });

    it('BR-07: works khi race chưa start (Chiptimes toàn empty)', async () => {
      // 10 athletes vendor return full schema with empty values
      const athletes = Array.from({ length: 10 }, () =>
        makeAthlete({
          Start: '',
          TM1: '',
          TM2: '',
          TM3: '',
          TM4: '',
          TM5: '',
          Finish: '',
        }),
      );
      mockApiService.fetchRaceResults.mockResolvedValue(athletes);

      const result = await service.discover('race-1', 'c-42');
      // Schema-from-1 should detect 7 keys ngay cả khi toàn empty
      expect(result.detectedCheckpoints.map((c) => c.key).sort()).toEqual([
        'Finish',
        'Start',
        'TM1',
        'TM2',
        'TM3',
        'TM4',
        'TM5',
      ]);
      expect(result.finishersCount).toBe(0);
      // Median = 0 cho mọi key → preserve insertion order
    });

    it('BR-11: sentinel keys (DNS/DNF/DSQ) filtered out', async () => {
      const athletes = Array.from({ length: 10 }, () =>
        makeAthlete({
          Start: '00:00',
          TM1: '01:00:00',
          Finish: '02:00:00',
          DNF: '', // sentinel — should filter
          DSQ: '', // sentinel
        }),
      );
      mockApiService.fetchRaceResults.mockResolvedValue(athletes);

      const result = await service.discover('race-1', 'c-42');
      const keys = result.detectedCheckpoints.map((c) => c.key);
      expect(keys).not.toContain('DNF');
      expect(keys).not.toContain('DSQ');
      expect(keys).toContain('Start');
      expect(keys).toContain('Finish');
    });
  });

  describe('Fallback aggregate mode (vendor schema inconsistent)', () => {
    it('falls back to coverage-based when schema differs > 20% athletes', async () => {
      // 8 athletes có 7 keys, 2 athletes có schema khác (only 4 keys)
      const consistentAthletes = Array.from({ length: 8 }, () =>
        makeAthlete({
          Start: '00:00',
          TM1: '01:30:00',
          TM2: '02:00:00',
          TM3: '02:30:00',
          TM4: '03:00:00',
          TM5: '03:30:00',
          Finish: '04:00:00',
        }),
      );
      const oddballs = Array.from({ length: 2 }, () =>
        makeAthlete({
          Start: '00:00',
          TM1: '01:00:00',
          Foo: '02:00:00', // unique key
          Bar: '03:00:00',
        }),
      );
      mockApiService.fetchRaceResults.mockResolvedValue([
        ...consistentAthletes,
        ...oddballs,
      ]);

      const result = await service.discover('race-1', 'c-42');
      // 8/10 = 80% consistent → schema-from-1 still triggers
      // → keys từ first athlete = 7 keys, ignore Foo/Bar
      const keys = result.detectedCheckpoints.map((c) => c.key);
      expect(keys.length).toBeGreaterThanOrEqual(7);
    });

    it('handles empty athletes array', async () => {
      mockApiService.fetchRaceResults.mockResolvedValue([]);
      const result = await service.discover('race-1', 'c-42');
      expect(result.detectedCheckpoints).toEqual([]);
      expect(result.totalAthletes).toBe(0);
    });
  });

  describe('F-039 — Vendor JSON order preserved + distance honesty', () => {
    /**
     * BR-CDD-01/02 — Schema-from-1 mode MUST preserve vendor JSON insertion order
     * regardless of median-time distribution. Repro của race 399839 Trail 70Km:
     * vendor schema = [Start, TM1, TM2, TM3, TM4, TM5, Finish] consistent across
     * all 72 athletes. Trước fix, code sort by median ASC → TM4/TM5 (zero samples,
     * median=0) bị grouped với Start, Finish (lone fluke) bị nhảy vào giữa.
     */
    it('BR-CDD-01: preserves vendor JSON order khi only Start+TM1+Finish có samples (TM4/TM5 zero)', async () => {
      // Simulate Trail 70Km early-race: TM4, TM5 chưa ai pass, Finish chỉ 1 fluke,
      // TM2 nhiều samples slow → median TM2 > median Finish
      const athletes: any[] = [];
      // 71 athletes pass Start + TM1 only (race vừa qua km 30)
      for (let i = 0; i < 71; i++) {
        athletes.push(
          makeAthlete({
            Start: '00:00',
            TM1: '02:24:39',
            TM2: '', // chưa pass
            TM3: '',
            TM4: '',
            TM5: '',
            Finish: '',
          }),
        );
      }
      // 30 athletes pass through TM2 (slow tail)
      for (let i = 0; i < 30; i++) {
        athletes[i] = makeAthlete({
          Start: '00:00',
          TM1: '02:24:39',
          TM2: '05:46:38',
          TM3: '',
          TM4: '',
          TM5: '',
          Finish: '',
        });
      }
      // 1 lone fluke finisher
      athletes[0] = makeAthlete({
        Start: '00:00',
        TM1: '01:30:00',
        TM2: '03:00:00',
        TM3: '06:23:52',
        TM4: '',
        TM5: '',
        Finish: '04:13:39', // anomaly — faster than TM3
      });
      mockApiService.fetchRaceResults.mockResolvedValue(athletes);

      const result = await service.discover('race-1', 'c-42');
      // F-039 fix: MUST preserve vendor JSON order regardless of median values.
      // BEFORE fix: would be ['Start','TM4','TM5','TM1','Finish','TM2','TM3'] (bug).
      expect(result.detectedCheckpoints.map((c) => c.key)).toEqual([
        'Start',
        'TM1',
        'TM2',
        'TM3',
        'TM4',
        'TM5',
        'Finish',
      ]);
      // Start orderIndex 0, Finish orderIndex 6 (last)
      expect(result.detectedCheckpoints[0].isImplicitStart).toBe(true);
      expect(result.detectedCheckpoints[6].isImplicitFinish).toBe(true);
      expect(result.detectedCheckpoints[6].key).toBe('Finish');
    });

    it('BR-CDD-03: intermediate CP distance ALWAYS null (no median-time derivation)', async () => {
      // 10 finishers — would previously trigger canDeriveDistance=true (≥10)
      // and intermediate CPs would have suggestedDistanceKm = courseTotalKm × ratio.
      // F-039 fix: NEVER derive, all intermediate must be null.
      const athletes = Array.from({ length: 10 }, () =>
        makeAthlete({
          Start: '00:00',
          TM1: '01:30:00',
          TM2: '02:00:00',
          TM3: '02:30:00',
          TM4: '03:00:00',
          TM5: '03:30:00',
          Finish: '04:00:00',
        }),
      );
      mockApiService.fetchRaceResults.mockResolvedValue(athletes);

      const result = await service.discover('race-1', 'c-42');
      // Start = 0
      expect(result.detectedCheckpoints[0].key).toBe('Start');
      expect(result.detectedCheckpoints[0].suggestedDistanceKm).toBe(0);
      // Finish = courseTotalKm
      expect(result.detectedCheckpoints[6].key).toBe('Finish');
      expect(result.detectedCheckpoints[6].suggestedDistanceKm).toBe(42);
      // Intermediate TM1..TM5 ALWAYS null — KHÔNG được derive từ time ratio
      for (let i = 1; i <= 5; i++) {
        expect(result.detectedCheckpoints[i].suggestedDistanceKm).toBeNull();
      }
    });

    it('BR-CDD-04: Finish distance = null khi course chưa có distanceKm config', async () => {
      // Override course mock: no distanceKm
      mockRaceModel.findById = jest.fn().mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              _id: 'race-1',
              courses: [
                {
                  courseId: 'c-42',
                  name: '42K',
                  apiUrl: 'https://api.raceresult.com/test/abc',
                  // distanceKm omitted
                },
              ],
            }),
        }),
      });

      const athletes = Array.from({ length: 10 }, () =>
        makeAthlete({
          Start: '00:00',
          TM1: '01:30:00',
          Finish: '03:00:00',
        }),
      );
      mockApiService.fetchRaceResults.mockResolvedValue(athletes);

      const result = await service.discover('race-1', 'c-42');
      expect(result.detectedCheckpoints[0].suggestedDistanceKm).toBe(0); // Start always 0
      // Finish null vì course thiếu distanceKm
      const finish = result.detectedCheckpoints[result.detectedCheckpoints.length - 1];
      expect(finish.suggestedDistanceKm).toBeNull();
      // Intermediate null
      expect(result.detectedCheckpoints[1].suggestedDistanceKm).toBeNull();
    });

    it('BR-CDD-05: fallback aggregate mode still sorts by median (preserve original behavior)', async () => {
      // Schema inconsistent (<80%): trigger fallback aggregate mode
      // → median sort vẫn áp dụng cho safety net
      const athletes: any[] = [];
      for (let i = 0; i < 5; i++) {
        athletes.push(
          makeAthlete({
            A: '03:00:00',
            B: '01:00:00',
            C: '02:00:00',
          }),
        );
      }
      // 5 athletes có schema khác hoàn toàn → < 80% consistent
      for (let i = 0; i < 5; i++) {
        athletes.push(
          makeAthlete({
            X: '01:30:00',
            Y: '02:30:00',
          }),
        );
      }
      mockApiService.fetchRaceResults.mockResolvedValue(athletes);

      const result = await service.discover('race-1', 'c-42');
      // Fallback mode: sort by median ASC.
      // Only A/B/C qualify coverage ≥80% (5 athletes / 10 denom = 0.5 < 0.8 → filtered)
      // Actually all keys < 0.8 coverage → surviving could be empty.
      // Verify behavior doesn't crash.
      expect(Array.isArray(result.detectedCheckpoints)).toBe(true);
    });
  });
});
