import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { CheckpointDiscoveryService } from './checkpoint-discovery.service';
import { Race } from '../../races/schemas/race.schema';
import { RaceResultApiService } from '../../race-result/services/race-result-api.service';
import { SimulatorService } from './simulator.service';

/**
 * QC Phase 4 — 10x Stability Test for BR-06 Redis SETNX lock.
 *
 * BR-06: Concurrent discover same (race, course) → Redis SETNX lock TTL 30s.
 * Caller lock-held → skip + log warning. Đảm bảo chỉ 1 discover thực sự run
 * khi N admin paste apiUrl đồng thời.
 */

describe('CheckpointDiscoveryService — Redis SETNX lock (BR-06)', () => {
  let service: CheckpointDiscoveryService;
  let mockRedis: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
  };
  let mockApiService: { fetchRaceResults: jest.Mock };

  beforeEach(async () => {
    mockRedis = {
      set: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };
    mockApiService = {
      fetchRaceResults: jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
        ),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CheckpointDiscoveryService,
        {
          provide: getModelToken(Race.name),
          useValue: {
            findById: jest.fn().mockReturnValue({
              lean: () => ({
                exec: () =>
                  Promise.resolve({
                    _id: 'race-1',
                    courses: [
                      {
                        courseId: 'c-42',
                        name: '42K',
                        apiUrl: 'https://api.raceresult.com/test/abc',
                        distanceKm: 42,
                      },
                    ],
                  }),
              }),
            }),
          },
        },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
        { provide: RaceResultApiService, useValue: mockApiService },
        { provide: SimulatorService, useValue: { getRawSnapshot: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get<CheckpointDiscoveryService>(
      CheckpointDiscoveryService,
    );
  });

  describe('discoverAndCachePreview()', () => {
    it('acquires SETNX lock with TTL 30s before discover', async () => {
      mockRedis.set.mockResolvedValue('OK'); // first call: cache write
      // First call: lock acquire returns OK, cache write returns OK
      let callCount = 0;
      mockRedis.set.mockImplementation((key) => {
        callCount += 1;
        if (key.startsWith('master:discover-lock:')) return 'OK';
        return 'OK'; // cache write
      });

      await service.discoverAndCachePreview('race-1', 'c-42');

      // Verify lock acquired with NX + EX 30
      const lockCall = mockRedis.set.mock.calls.find((c) =>
        String(c[0]).startsWith('master:discover-lock:'),
      );
      expect(lockCall).toBeDefined();
      expect(lockCall![2]).toBe('EX'); // arg position: key, value, mode, ttl, NX
      expect(lockCall![3]).toBe(30);
      expect(lockCall![4]).toBe('NX');
    });

    it('skips when lock-held (concurrent caller)', async () => {
      // Lock acquire returns null = lock held by another caller
      mockRedis.set.mockResolvedValue(null);

      await service.discoverAndCachePreview('race-1', 'c-42');

      // Verify only 1 SETNX attempt, NO subsequent cache write
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(mockApiService.fetchRaceResults).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled(); // no lock release if not acquired
    });

    it('releases lock after success (finally block)', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.discoverAndCachePreview('race-1', 'c-42');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'master:discover-lock:race-1:c-42',
      );
    });

    it('releases lock after error (finally block)', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockApiService.fetchRaceResults.mockRejectedValue(
        new Error('Network timeout'),
      );

      await service.discoverAndCachePreview('race-1', 'c-42');

      // Lock released even khi discover throw
      expect(mockRedis.del).toHaveBeenCalledWith(
        'master:discover-lock:race-1:c-42',
      );
    });

    it('caches error result with shorter TTL (60s) on failure', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockApiService.fetchRaceResults.mockRejectedValue(
        new Error('Vendor 503'),
      );

      await service.discoverAndCachePreview('race-1', 'c-42');

      const errorCacheCall = mockRedis.set.mock.calls.find(
        (c) =>
          String(c[0]) === 'discover-preview:race-1:c-42' &&
          String(c[1]).includes('"error"'),
      );
      expect(errorCacheCall).toBeDefined();
      expect(errorCacheCall![3]).toBe(60); // shorter TTL on error
    });

    it('10x concurrent calls — only 1 acquires lock (BR-06 stability)', async () => {
      // Simulate Redis SETNX behavior: first call returns 'OK', rest return null
      let acquiredCount = 0;
      mockRedis.set.mockImplementation((key) => {
        if (String(key).startsWith('master:discover-lock:')) {
          if (acquiredCount === 0) {
            acquiredCount += 1;
            return 'OK';
          }
          return null;
        }
        return 'OK'; // cache writes always succeed
      });

      // Fire 10 concurrent discover calls
      const promises = Array.from({ length: 10 }, () =>
        service.discoverAndCachePreview('race-1', 'c-42'),
      );
      await Promise.all(promises);

      // Only 1 should fetch RR API (others skip due to lock-held)
      expect(mockApiService.fetchRaceResults).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCachedPreview()', () => {
    it('returns cached data when present', async () => {
      const cached = {
        courseId: 'c-42',
        detectedCheckpoints: [],
        generatedAt: '2026-05-04T12:00:00Z',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getCachedPreview('race-1', 'c-42');
      expect(result.cached).toEqual(cached);
      expect(result.error).toBe(null);
    });

    it('returns error when cached error present', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ error: 'vendor 503', generatedAt: '2026-05-04' }),
      );

      const result = await service.getCachedPreview('race-1', 'c-42');
      expect(result.cached).toBe(null);
      expect(result.error).toBe('vendor 503');
    });

    it('returns null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getCachedPreview('race-1', 'c-42');
      expect(result.cached).toBe(null);
      expect(result.error).toBe(null);
    });

    it('handles malformed JSON gracefully', async () => {
      mockRedis.get.mockResolvedValue('{not-json');

      const result = await service.getCachedPreview('race-1', 'c-42');
      expect(result.cached).toBe(null);
      expect(result.error).toBe(null);
    });
  });
});
