/**
 * FEATURE-048 Phase 1B — BulkSyncOrchestratorService unit tests.
 *
 * Coverage: state machine + reason validation + concurrent prevent + race selection.
 */

import { BulkSyncOrchestratorService, BulkSyncStage } from './bulk-sync-orchestrator.service';

function makeRedis(initialState: BulkSyncStage = 'idle') {
  const store = new Map<string, string>();
  if (initialState) store.set('athlete:bulksync-state', initialState);
  return {
    store,
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    setex: jest.fn(async (k: string, _ttl: number, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    del: jest.fn(async (k: string) => {
      store.delete(k);
      return 1;
    }),
  };
}

function makeSyncService() {
  return {
    fullSyncRace: jest.fn().mockResolvedValue({ _id: 'log-id' }),
    deltaSyncRace: jest.fn().mockResolvedValue({ _id: 'log-id' }),
  };
}

function makeRaceRepo(races: Array<{ raceId: number }> = []) {
  return {
    find: jest.fn().mockResolvedValue(races),
    count: jest.fn().mockResolvedValue(races.length),
  };
}

function makeAthleteModel(syncedCount = 0) {
  return {
    distinct: jest.fn().mockResolvedValue(
      Array.from({ length: syncedCount }, (_, i) => i + 1),
    ),
  };
}

describe('BulkSyncOrchestratorService (FEATURE-048 Phase 1B)', () => {
  let service: BulkSyncOrchestratorService;
  let redis: ReturnType<typeof makeRedis>;
  let syncService: ReturnType<typeof makeSyncService>;
  let mysqlRepo: ReturnType<typeof makeRaceRepo>;
  let athleteModel: ReturnType<typeof makeAthleteModel>;
  let loggerLog: jest.SpyInstance;

  beforeEach(() => {
    redis = makeRedis('idle');
    syncService = makeSyncService();
    mysqlRepo = makeRaceRepo([
      { raceId: 1 },
      { raceId: 2 },
      { raceId: 3 },
    ]);
    athleteModel = makeAthleteModel(50);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    service = new BulkSyncOrchestratorService(
      redis as any,
      syncService as any,
      mysqlRepo as any,
      athleteModel as any,
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */

    loggerLog = jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    loggerLog.mockRestore();
  });

  describe('triggerBulkSync() — staged_10', () => {
    it('staged_10 happy path returns runId + races count', async () => {
      const result = await service.triggerBulkSync('staged_10', 'admin-sub-1');
      expect(result.runId).toMatch(/^[a-f0-9-]+$/i);
      expect(result.mode).toBe('staged_10');
      expect(result.racesQueued).toBeGreaterThan(0);
      expect(result.estimatedDuration).toContain('phút');

      // State transitioned to running
      expect(await service.getCurrentStage()).toBe('staged_10_running');
    });
  });

  describe('triggerBulkSync() — state machine validation BR-48-09', () => {
    it('staged_50 BEFORE staged_10_done → rejected', async () => {
      // initial state = idle
      await expect(
        service.triggerBulkSync('staged_50', 'admin-1'),
      ).rejects.toThrow('staged_50 requires staged_10 to be done');
    });

    it('full BEFORE staged_50_done → rejected', async () => {
      redis.store.set('athlete:bulksync-state', 'staged_10_done');
      await expect(
        service.triggerBulkSync('full', 'admin-1', 'production rollout test 2026'),
      ).rejects.toThrow('full mode requires staged_50');
    });

    it('staged_50 AFTER staged_10_done → allowed', async () => {
      redis.store.set('athlete:bulksync-state', 'staged_10_done');
      const result = await service.triggerBulkSync('staged_50', 'admin-1');
      expect(result.mode).toBe('staged_50');
    });

    it('full AFTER staged_50_done WITH reason ≥10 → allowed', async () => {
      redis.store.set('athlete:bulksync-state', 'staged_50_done');
      const result = await service.triggerBulkSync(
        'full',
        'admin-1',
        'PROD backfill 195 races verified pilot stages',
      );
      expect(result.mode).toBe('full');
    });
  });

  describe('triggerBulkSync() — reason validation', () => {
    it('full mode without reason → rejected', async () => {
      redis.store.set('athlete:bulksync-state', 'staged_50_done');
      await expect(
        service.triggerBulkSync('full', 'admin-1'),
      ).rejects.toThrow('reason ≥10 ký tự bắt buộc');
    });

    it('full mode with short reason (<10 chars) → rejected', async () => {
      redis.store.set('athlete:bulksync-state', 'staged_50_done');
      await expect(
        service.triggerBulkSync('full', 'admin-1', 'short'),
      ).rejects.toThrow('reason ≥10 ký tự bắt buộc');
    });

    it('staged_10 + staged_50 do NOT require reason', async () => {
      const r1 = await service.triggerBulkSync('staged_10', 'admin-1');
      expect(r1.mode).toBe('staged_10');
    });
  });

  describe('triggerBulkSync() — concurrent prevention', () => {
    it('cannot trigger sync while another is running', async () => {
      redis.store.set('athlete:bulksync-state', 'staged_10_running');
      await expect(
        service.triggerBulkSync('staged_10', 'admin-1'),
      ).rejects.toThrow('Sync đang chạy');
    });
  });

  describe('getSyncStatus()', () => {
    it('returns null for non-existent runId', async () => {
      const status = await service.getSyncStatus('nonexistent-uuid');
      expect(status).toBeNull();
    });

    it('returns progress data for valid runId', async () => {
      const runId = 'test-run-1';
      const progress = {
        runId,
        mode: 'staged_10' as const,
        status: 'running' as const,
        progress: { current: 3, total: 10, percent: 30 },
        startedAt: '2026-05-20T10:00:00Z',
        triggeredBy: 'admin-1',
        errors: [],
        racesSucceeded: 3,
        racesFailed: 0,
      };
      redis.store.set(`athlete:bulksync-progress:${runId}`, JSON.stringify(progress));
      const result = await service.getSyncStatus(runId);
      expect(result).toEqual(progress);
    });
  });

  describe('getOverallStatus()', () => {
    it('returns stage + coverage stats', async () => {
      redis.store.set('athlete:bulksync-state', 'staged_50_done');
      mysqlRepo.count.mockResolvedValue(200);
      athleteModel.distinct.mockResolvedValue([1, 2, 3, 4, 5]); // 5 synced

      const status = await service.getOverallStatus();
      expect(status.stage).toBe('staged_50_done');
      expect(status.raceCoverage.total).toBe(200);
      expect(status.raceCoverage.synced).toBe(5);
      expect(status.raceCoverage.percent).toBe(3); // 5/200 = 2.5% rounded to 3
    });

    it('handles total=0 gracefully (no division by zero)', async () => {
      mysqlRepo.count.mockResolvedValue(0);
      const status = await service.getOverallStatus();
      expect(status.raceCoverage.percent).toBe(0);
    });
  });
});
