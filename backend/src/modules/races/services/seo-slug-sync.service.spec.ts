import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { Race } from '../schemas/race.schema';
import { SeoSyncLog } from '../schemas/seo-sync-log.schema';
import { SeoSlugSyncService } from './seo-slug-sync.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('SeoSlugSyncService', () => {
  let service: SeoSlugSyncService;
  let raceModel: {
    find: jest.Mock;
    exists: jest.Mock;
    updateOne: jest.Mock;
  };
  let logModelCtor: jest.Mock;
  let logSave: jest.Mock;
  let logModelFind: jest.Mock;
  let redis: { set: jest.Mock; del: jest.Mock };
  let httpService: { post: jest.Mock };

  beforeEach(async () => {
    process.env.FRONTEND_REVALIDATE_GIAICHAY_URL =
      'http://test-frontend/api/revalidate-giai-chay';
    process.env.REVALIDATE_TOKEN = 'test-token';

    raceModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      exists: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) }),
    };

    // logModel must be a constructor-callable mock: `new logModel(...).save()`
    logSave = jest.fn().mockResolvedValue({});
    logModelFind = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
    logModelCtor = jest.fn().mockImplementation((doc: Record<string, unknown>) => ({
      ...doc,
      save: logSave,
    }));
    // attach static methods (find) onto constructor function
    (logModelCtor as unknown as { find: jest.Mock }).find = logModelFind;
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    httpService = {
      post: jest.fn().mockReturnValue(of({ status: 200, data: { ok: true } })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeoSlugSyncService,
        { provide: getModelToken(Race.name), useValue: raceModel },
        { provide: getModelToken(SeoSyncLog.name), useValue: logModelCtor },
        { provide: REDIS_TOKEN, useValue: redis },
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<SeoSlugSyncService>(SeoSlugSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncSlugs() — happy path', () => {
    it('generates slugs for 3 races with slug=null and triggers revalidate', async () => {
      raceModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'r1', title: 'Race One', startDate: '2026-01-15', status: 'pre_race', slug: null },
          { _id: 'r2', title: 'Đà Lạt Trail', startDate: '2026-03-01', status: 'live', slug: '' },
          { _id: 'r3', title: 'HCM Marathon', startDate: '2025-12-01', status: 'ended', slug: null },
        ]),
      });

      const result = await service.syncSlugs('cron');

      expect(result.racesScanned).toBe(3);
      expect(result.slugsGenerated).toBe(3);
      expect(result.errors).toEqual([]);
      expect(result.lockSkipped).toBe(false);
      expect(raceModel.updateOne).toHaveBeenCalledTimes(3);
      expect(httpService.post).toHaveBeenCalled();
      expect(logModelCtor).toHaveBeenCalled();
      expect(logSave).toHaveBeenCalled();
    });

    it('does NOT revalidate when 0 slugs generated', async () => {
      const result = await service.syncSlugs('cron');
      expect(result.slugsGenerated).toBe(0);
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });

  describe('syncSlugs() — uniqueness collision (BR-03)', () => {
    it('appends -2 suffix when slug already exists', async () => {
      raceModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'r1', title: 'Marathon', startDate: '2026-01-01', status: 'pre_race', slug: null },
        ]),
      });
      // First exists check returns true → collision, second returns null → free
      raceModel.exists
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue({ _id: 'other' }) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

      await service.syncSlugs('cron');

      expect(raceModel.updateOne).toHaveBeenCalledWith(
        { _id: 'r1' },
        { $set: { slug: 'marathon-2026-2' } },
      );
    });
  });

  describe('syncSlugs() — concurrent lock', () => {
    it('returns lockSkipped=true when lock not acquired (cron)', async () => {
      redis.set.mockResolvedValueOnce(null);

      const result = await service.syncSlugs('cron');

      expect(result.lockSkipped).toBe(true);
      expect(result.slugsGenerated).toBe(0);
      expect(raceModel.find).not.toHaveBeenCalled();
    });

    it('throws ConflictException when lock not acquired (manual)', async () => {
      redis.set.mockResolvedValueOnce(null);

      await expect(service.syncSlugs('manual', 'admin-user')).rejects.toThrow(
        'Một lần sync khác đang chạy. Thử lại sau vài giây.',
      );
    });
  });

  describe('syncSlugs() — edge cases', () => {
    it('skips races with empty/null title (log warning)', async () => {
      raceModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'r1', title: '', startDate: '2026-01-01', status: 'pre_race', slug: null },
          { _id: 'r2', title: '@@@', startDate: '2026-01-01', status: 'pre_race', slug: null },
        ]),
      });

      const result = await service.syncSlugs('cron');

      expect(result.racesScanned).toBe(2);
      expect(result.slugsGenerated).toBe(0);
      expect(result.errors.length).toBe(2);
      expect(raceModel.updateOne).not.toHaveBeenCalled();
    });

    it('continues on individual race error', async () => {
      raceModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'r1', title: 'Race A', startDate: '2026-01-01', status: 'pre_race', slug: null },
          { _id: 'r2', title: 'Race B', startDate: '2026-01-01', status: 'pre_race', slug: null },
        ]),
      });
      raceModel.updateOne
        .mockReturnValueOnce({ exec: jest.fn().mockRejectedValue(new Error('DB err')) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });

      const result = await service.syncSlugs('cron');

      expect(result.racesScanned).toBe(2);
      expect(result.slugsGenerated).toBe(1);
      expect(result.errors.length).toBe(1);
    });
  });

  describe('syncSlugs() — revalidate retry (BR-06)', () => {
    it('retries revalidate 3x on failure', async () => {
      raceModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'r1', title: 'Race', startDate: '2026-01-01', status: 'pre_race', slug: null },
        ]),
      });
      // Mock the sleep helper to be instantaneous
      jest.spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue();
      httpService.post
        .mockReturnValueOnce(throwError(() => new Error('Conn refused')))
        .mockReturnValueOnce(throwError(() => new Error('Conn refused')))
        .mockReturnValueOnce(of({ status: 200, data: { ok: true } }));

      const result = await service.syncSlugs('cron');

      expect(result.errors).toEqual([]);
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('reports error after 3 failed retries', async () => {
      raceModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'r1', title: 'Race', startDate: '2026-01-01', status: 'pre_race', slug: null },
        ]),
      });
      jest.spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue();
      httpService.post.mockReturnValue(throwError(() => new Error('Conn refused')));

      const result = await service.syncSlugs('cron');

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Revalidate failed');
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });
  });

  describe('audit log', () => {
    it('writes log with triggeredBy=cron when called by cron', async () => {
      await service.syncSlugs('cron');
      expect(logModelCtor).toHaveBeenCalledWith(
        expect.objectContaining({ triggeredBy: 'cron' }),
      );
    });

    it('writes log with triggeredBy=manual + userId', async () => {
      await service.syncSlugs('manual', 'admin-123');
      expect(logModelCtor).toHaveBeenCalledWith(
        expect.objectContaining({ triggeredBy: 'manual', userId: 'admin-123' }),
      );
    });
  });
});
