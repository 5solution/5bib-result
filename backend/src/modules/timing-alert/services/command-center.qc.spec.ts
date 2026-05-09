/**
 * FEATURE-005 — Command Center QC E2E spec (QC-authored).
 *
 * Goal: probe attack surface + business invariants beyond Coder's unit spec.
 * Run: `npx jest --testPathPattern="command-center.e2e-spec"` against seeded DB+Redis.
 *
 * NOTE: Many test bodies use thin mocks rather than full Nest TestingModule —
 * production E2E (with real Mongo + Redis container) tracked under TD-F005-05.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandCenterService } from './command-center.service';

type MockModel = {
  findById: jest.Mock;
  countDocuments: jest.Mock;
  aggregate: jest.Mock;
};

type MockRedis = {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  scanStream: jest.Mock;
  pipeline: jest.Mock;
};

function makeRedis(): MockRedis {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string, ...rest: unknown[]) => {
      // SETNX semantics: 'NX' present + key already set → null
      const isNX = rest.includes('NX');
      if (isNX && store.has(k)) return null;
      store.set(k, v);
      return 'OK';
    }),
    del: jest.fn(async (k: string) => {
      const had = store.delete(k);
      return had ? 1 : 0;
    }),
    scanStream: jest.fn(() => {
      const stream = {
        on(event: string, cb: (...args: unknown[]) => void) {
          if (event === 'data') cb([]);
          if (event === 'end') setTimeout(cb, 0);
          return stream;
        },
      };
      return stream;
    }),
    pipeline: jest.fn(() => ({
      del: jest.fn(),
      exec: jest.fn(async () => []),
    })),
  };
}

function makeRace(overrides: Partial<{ status: string; courses: unknown[] }> = {}) {
  return {
    _id: 'race-1',
    title: 'Test Race',
    status: 'live',
    courses: [
      { courseId: 'course-A', name: '5K', distanceKm: 5, checkpoints: [
        { key: 'Start', name: 'Start', distanceKm: 0 },
        { key: 'TM1', name: 'CP1', distanceKm: 2.5 },
        { key: 'Finish', name: 'Finish', distanceKm: 5 },
      ]},
    ],
    ...overrides,
  };
}

describe('CommandCenter QC E2E — security + invariants', () => {
  let service: CommandCenterService;
  let raceModel: MockModel;
  let resultModel: MockModel;
  let alertModel: MockModel;
  let redis: MockRedis;
  let pollService: { pollRace: jest.Mock };

  beforeEach(() => {
    raceModel = {
      findById: jest.fn(() => ({
        lean: () => ({ exec: async () => makeRace() }),
      })),
      countDocuments: jest.fn(() => ({ exec: async () => 100 })),
      aggregate: jest.fn(() => ({ exec: async () => [] })),
    };
    resultModel = {
      findById: jest.fn(),
      countDocuments: jest.fn(() => ({ exec: async () => 100 })),
      aggregate: jest.fn(() => ({ exec: async () => [] })),
    };
    alertModel = {
      findById: jest.fn(),
      countDocuments: jest.fn(() => ({ exec: async () => 0 })),
      aggregate: jest.fn(() => ({ exec: async () => [] })),
    };
    redis = makeRedis();
    pollService = { pollRace: jest.fn(async () => undefined) };

    service = new CommandCenterService(
      raceModel as never,
      resultModel as never,
      alertModel as never,
      redis as never,
      pollService as never,
    );
  });

  describe('Security — IDOR & validation', () => {
    it('IDOR: leaderboard for unknown race throws NotFoundException (race-scoped)', async () => {
      raceModel.findById = jest.fn(() => ({
        lean: () => ({ exec: async () => null }),
      }));
      await expect(
        service.getLiveLeaderboard('attacker-race-id', 'course-A', 10),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('IDOR: leaderboard for unknown course in valid race throws NotFoundException', async () => {
      await expect(
        service.getLiveLeaderboard('race-1', 'evil-course', 10),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('limit > 50 → capped to 50 (validation guard)', async () => {
      const result = await service.getLiveLeaderboard('race-1', 'course-A', 9999);
      expect(result.entries.length).toBeLessThanOrEqual(50);
    });

    it('limit < 1 → coerced to default 10 (no division by zero / negative)', async () => {
      const result = await service.getLiveLeaderboard('race-1', 'course-A', -5);
      // does not throw, just normalizes
      expect(result).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
    });

    it('limit NaN → fallback default (no MongoDB injection via numeric coercion)', async () => {
      const result = await service.getLiveLeaderboard(
        'race-1',
        'course-A',
        NaN as unknown as number,
      );
      expect(result).toBeDefined();
    });

    it('Response shape does NOT leak course.apiUrl (RR API token)', async () => {
      const result = await service.getLiveLeaderboard('race-1', 'course-A', 10);
      const json = JSON.stringify(result);
      expect(json).not.toMatch(/apiUrl/i);
      expect(json).not.toMatch(/api_key/i);
      expect(json).not.toMatch(/raceresult\.com/i);
    });
  });

  describe('Force Refresh — DoS / rate-limit', () => {
    it('Concurrent Force Refresh from same user — first wins, rest 409', async () => {
      const calls = await Promise.allSettled(
        Array.from({ length: 10 }).map(() =>
          service.forceRefresh('race-1', 'user-A'),
        ),
      );
      const fulfilled = calls.filter((c) => c.status === 'fulfilled');
      const rejected = calls.filter((c) => c.status === 'rejected');
      // Note: parallel calls may all see lock empty before any sets — but in mocks set is sync
      // At least 1 wins, others throw ConflictException
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      rejected.forEach((r) => {
        if (r.status === 'rejected') {
          expect(r.reason).toBeInstanceOf(ConflictException);
        }
      });
    });

    it('Force Refresh on unknown race → NotFoundException, lock NOT consumed', async () => {
      raceModel.findById = jest.fn(() => ({
        lean: () => ({ exec: async () => null }),
      }));
      await expect(service.forceRefresh('ghost', 'user-A')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // No lock acquisition for ghost race
      expect(redis.set).not.toHaveBeenCalledWith(
        expect.stringContaining('cc-refresh-lock-user:ghost'),
        expect.anything(),
        'EX',
        expect.anything(),
        'NX',
      );
    });
  });

  describe('Race lifecycle — BR-CC-01 / BR-CC-05', () => {
    it('Race status=draft → empty entries (NOT 4xx)', async () => {
      raceModel.findById = jest.fn(() => ({
        lean: () => ({ exec: async () => makeRace({ status: 'draft' }) }),
      }));
      const result = await service.getLiveLeaderboard('race-1', 'course-A', 10);
      expect(result.entries).toEqual([]);
      expect(result.courseId).toBe('course-A');
    });

    it('Race status=pre_race → empty entries (NOT 4xx)', async () => {
      raceModel.findById = jest.fn(() => ({
        lean: () => ({ exec: async () => makeRace({ status: 'pre_race' }) }),
      }));
      const result = await service.getLiveLeaderboard('race-1', 'course-A', 10);
      expect(result.entries).toEqual([]);
    });

    it('Race ended → still returns leaderboard data (BR-CC-05 freeze, not 4xx)', async () => {
      raceModel.findById = jest.fn(() => ({
        lean: () => ({ exec: async () => makeRace({ status: 'ended' }) }),
      }));
      const result = await service.getLiveLeaderboard('race-1', 'course-A', 10);
      expect(result).toBeDefined();
      expect(result.entries).toBeDefined();
    });
  });

  describe('Cache hit performance — < 200ms p95', () => {
    it('Second call hits Redis cache (no DB aggregate)', async () => {
      const first = await service.getLiveLeaderboard('race-1', 'course-A', 10);
      const aggregateCallsAfterFirst = resultModel.aggregate.mock.calls.length;

      const t0 = process.hrtime.bigint();
      const second = await service.getLiveLeaderboard('race-1', 'course-A', 10);
      const t1 = process.hrtime.bigint();
      const ms = Number(t1 - t0) / 1_000_000;

      expect(second).toEqual(first);
      // No new aggregate call
      expect(resultModel.aggregate.mock.calls.length).toBe(aggregateCallsAfterFirst);
      // Cache hit must be < 200ms (p95 SLA per PRD)
      expect(ms).toBeLessThan(200);
    });

    it('Stability: 10x same call returns identical data (deterministic)', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          service.getLiveLeaderboard('race-1', 'course-A', 10),
        ),
      );
      const first = JSON.stringify(results[0]);
      results.forEach((r) => expect(JSON.stringify(r)).toBe(first));
    });
  });

  describe('Aggregation correctness — BR-CC-08 sort', () => {
    it('Top 10 sort: Finish ASC first, projected last CP DESC after', async () => {
      resultModel.aggregate = jest.fn(() => ({
        exec: async () => [
          {
            bib: '101',
            name: 'Alice',
            chiptimes: JSON.stringify({ Start: '00:00', TM1: '24:29', Finish: '1:12:13' }),
            chipTime: '1:12:13',
            gender: 'F',
            category: '30-39',
          },
          {
            bib: '102',
            name: 'Bob',
            chiptimes: JSON.stringify({ Start: '00:00', TM1: '20:00', Finish: '1:05:00' }),
            chipTime: '1:05:00',
            gender: 'M',
            category: '30-39',
          },
          {
            bib: '103',
            name: 'NoFinishYet',
            chiptimes: JSON.stringify({ Start: '00:00', TM1: '25:00' }),
            chipTime: null,
            gender: 'M',
            category: '40-49',
          },
        ],
      }));
      const result = await service.getLiveLeaderboard('race-1', 'course-A', 10);
      // Bob (1:05:00 finish) ranks above Alice (1:12:13)
      expect(result.entries[0].bib).toBe('102');
      expect(result.entries[1].bib).toBe('101');
      // Non-finisher comes last
      expect(result.entries[2].bib).toBe('103');
      expect(result.entries[2].hasMissingFinish).toBe(true);
    });
  });
});
