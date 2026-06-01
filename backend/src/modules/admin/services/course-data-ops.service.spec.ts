import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { CourseDataOpsService } from './course-data-ops.service';
import { RaceResult } from '../../race-result/schemas/race-result.schema';
import { SyncLog } from '../../race-result/schemas/sync-log.schema';
import { RaceResultService } from '../../race-result/services/race-result.service';
import { RaceSyncCron } from '../../race-result/services/race-sync.cron';
import { RacesService } from '../../races/races.service';
import { AuditLogService } from '../../audit/services/audit-log.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';
const RACE_ID = 'r-2026-lets-run';
const COURSE_ID = '200m';
const FULL_API_URL =
  'https://api.raceresult.com/402892/KHV8RYDYB7EMEYGU0UGAMZGPJ4Q67MIH';
// head 8 of FULL_API_URL = 'https://', tail 8 = 'J4Q67MIH'
const FULL_API_URL_MASKED = 'https://...J4Q67MIH';

describe('CourseDataOpsService (F-068)', () => {
  let service: CourseDataOpsService;
  let mockResultModel: any;
  let mockSyncLogModel: any;
  let mockRedis: any;
  let mockRacesService: any;
  let mockRaceResultService: any;
  let mockRaceSyncCron: any;
  let mockAuditLog: any;

  const buildRace = (overrides: Partial<any> = {}) => ({
    _id: RACE_ID,
    title: "Let's run 2026",
    slug: 'lets-run-2026',
    status: 'ended',
    courses: [
      {
        courseId: COURSE_ID,
        name: '200m',
        apiUrl: FULL_API_URL,
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    mockResultModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(576) }),
      deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 576 }) }),
    };
    mockSyncLogModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              created_at: new Date('2026-05-31T02:45:15.000Z'),
              status: 'success',
              durationMs: 987,
            }),
          }),
        }),
      }),
    };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    mockRacesService = {
      getRaceById: jest.fn().mockResolvedValue({ data: buildRace() }),
      updateCourse: jest.fn().mockResolvedValue({ data: {}, success: true }),
    };
    mockRaceResultService = {
      deleteResultsByCourse: jest.fn().mockResolvedValue(576),
    };
    mockRaceSyncCron = {
      isCurrentlySync: jest.fn().mockReturnValue(false),
      getNextScheduledRunAt: jest
        .fn()
        .mockReturnValue(new Date('2026-05-31T02:55:00.000Z')),
    };
    mockAuditLog = { emit: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseDataOpsService,
        { provide: getModelToken(RaceResult.name), useValue: mockResultModel },
        { provide: getModelToken(SyncLog.name), useValue: mockSyncLogModel },
        { provide: REDIS_TOKEN, useValue: mockRedis },
        { provide: RacesService, useValue: mockRacesService },
        { provide: RaceResultService, useValue: mockRaceResultService },
        { provide: RaceSyncCron, useValue: mockRaceSyncCron },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<CourseDataOpsService>(CourseDataOpsService);
  });

  // ─── getStats ─────────────────────────────────────────────────

  describe('getStats() — TC-68-01..06', () => {
    it('TC-68-01 happy path with cache miss → fetch + cache SET', async () => {
      const result = await service.getStats(RACE_ID, COURSE_ID);

      expect(result.rowCount).toBe(576);
      expect(result.lastSyncedAt).toBe('2026-05-31T02:45:15.000Z');
      expect(result.lastSyncStatus).toBe('success');
      expect(result.lastSyncDurationMs).toBe(987);
      expect(result.hasApiUrl).toBe(true);
      expect(result.apiUrlMasked).toBe(FULL_API_URL_MASKED);
      expect(result.nextCronAt).toBe('2026-05-31T02:55:00.000Z');
      expect(result.cronStatus).toBe('scheduled');

      // Cache SET with TTL 5s
      expect(mockRedis.set).toHaveBeenCalledWith(
        `admin:course-stats:${RACE_ID}:${COURSE_ID}`,
        expect.any(String),
        'EX',
        5,
      );
    });

    it('TC-68-01 cache HIT → return cached payload without Mongo hit', async () => {
      const cached = {
        rowCount: 100,
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncDurationMs: null,
        hasApiUrl: false,
        apiUrlMasked: null,
        nextCronAt: null,
        cronStatus: 'disabled',
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getStats(RACE_ID, COURSE_ID);

      expect(result).toEqual(cached);
      expect(mockResultModel.countDocuments).not.toHaveBeenCalled();
      expect(mockSyncLogModel.findOne).not.toHaveBeenCalled();
    });

    it('TC-68-02 empty stats — no sync logs', async () => {
      mockSyncLogModel.findOne.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });
      mockResultModel.countDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(0),
      });
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({
          courses: [{ courseId: COURSE_ID, name: '200m', apiUrl: '' }],
        }),
      });

      const result = await service.getStats(RACE_ID, COURSE_ID);

      expect(result.rowCount).toBe(0);
      expect(result.lastSyncedAt).toBeNull();
      expect(result.lastSyncStatus).toBeNull();
      expect(result.hasApiUrl).toBe(false);
      expect(result.cronStatus).toBe('disabled');
      expect(result.nextCronAt).toBeNull();
    });

    it('TC-68-03 cron in_progress → cronStatus + nextCronAt null', async () => {
      mockRaceSyncCron.isCurrentlySync.mockReturnValueOnce(true);

      const result = await service.getStats(RACE_ID, COURSE_ID);

      expect(result.cronStatus).toBe('in_progress');
      expect(result.nextCronAt).toBeNull();
    });

    it('TC-68-04 race not found → 404', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({ data: null });
      await expect(service.getStats(RACE_ID, COURSE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('TC-68-05 course not found in race → 404', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({ courses: [{ courseId: '400m', name: '400m' }] }),
      });
      await expect(service.getStats(RACE_ID, COURSE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('BR-68-05 apiUrlMasked: head8+tail8 for long URL', async () => {
      const result = await service.getStats(RACE_ID, COURSE_ID);
      expect(result.apiUrlMasked).toMatch(/^.{8}\.\.\..{8}$/);
    });

    it('BR-68-05 + Danny chốt C: URL <16 chars → return raw (no mask)', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({
          courses: [{ courseId: COURSE_ID, name: '200m', apiUrl: 'abc.com' }],
        }),
      });
      const result = await service.getStats(RACE_ID, COURSE_ID);
      expect(result.apiUrlMasked).toBe('abc.com');
    });

    it('BR-68-04 empty-string apiUrl does NOT count as has apiUrl', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({
          courses: [{ courseId: COURSE_ID, name: '200m', apiUrl: '   ' }],
        }),
      });
      const result = await service.getStats(RACE_ID, COURSE_ID);
      expect(result.hasApiUrl).toBe(false);
      expect(result.apiUrlMasked).toBeNull();
      expect(result.cronStatus).toBe('disabled');
    });
  });

  // ─── clearApiUrl ──────────────────────────────────────────────

  describe('clearApiUrl() — TC-68-07..09', () => {
    it('TC-68-07 happy path: clears apiUrl, invalidates stats cache, emits audit', async () => {
      const result = await service.clearApiUrl(RACE_ID, COURSE_ID, {});

      expect(result.success).toBe(true);
      expect(result.prevApiUrlMasked).toBe(FULL_API_URL_MASKED);
      expect(mockRacesService.updateCourse).toHaveBeenCalledWith(
        RACE_ID,
        COURSE_ID,
        { apiUrl: undefined },
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        `admin:course-stats:${RACE_ID}:${COURSE_ID}`,
      );
      expect(mockAuditLog.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'course.apiUrl.cleared',
          metadata: expect.objectContaining({
            raceId: RACE_ID,
            courseId: COURSE_ID,
            prevApiUrl: FULL_API_URL,
            raceWasLive: false,
          }),
        }),
      );
    });

    it('TC-68-08 race=live without confirmedLive → 409 RACE_IS_LIVE_CONFIRM_REQUIRED', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({ status: 'live' }),
      });

      await expect(
        service.clearApiUrl(RACE_ID, COURSE_ID, {}),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'RACE_IS_LIVE_CONFIRM_REQUIRED',
        }),
      });
      expect(mockRacesService.updateCourse).not.toHaveBeenCalled();
      expect(mockAuditLog.emit).not.toHaveBeenCalled();
    });

    it('TC-68-09 race=live with confirmedLive=true → success + metadata marks raceWasLive', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({ status: 'live' }),
      });

      const result = await service.clearApiUrl(RACE_ID, COURSE_ID, {
        confirmedLive: true,
      });

      expect(result.success).toBe(true);
      expect(mockAuditLog.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ raceWasLive: true }),
        }),
      );
    });

    it('course not found → 404', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({ courses: [{ courseId: '400m', name: '400m' }] }),
      });
      await expect(service.clearApiUrl(RACE_ID, COURSE_ID, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── disableAndReset ──────────────────────────────────────────

  describe('disableAndReset() — TC-68-10..12', () => {
    it('TC-68-10 atomic order: clear apiUrl FIRST, then wait cron, then deleteMany', async () => {
      const callOrder: string[] = [];
      mockRacesService.updateCourse.mockImplementation(async () => {
        callOrder.push('updateCourse');
        return { data: {}, success: true };
      });
      mockRaceResultService.deleteResultsByCourse.mockImplementation(async () => {
        callOrder.push('deleteResultsByCourse');
        return 576;
      });

      const result = await service.disableAndReset(RACE_ID, COURSE_ID, {});

      expect(result.deletedCount).toBe(576);
      expect(result.hasApiUrl).toBe(false);
      expect(result.nextCronAt).toBeNull();
      expect(result.prevApiUrlMasked).toBe(FULL_API_URL_MASKED);
      // Order check: updateCourse MUST precede deleteResultsByCourse
      expect(callOrder).toEqual(['updateCourse', 'deleteResultsByCourse']);
    });

    it('TC-68-11 cron mid-flight wait — release after isSyncing flips false', async () => {
      jest.useFakeTimers();
      // First 2 polls return true, then false
      let inFlight = true;
      mockRaceSyncCron.isCurrentlySync.mockImplementation(() => inFlight);
      setTimeout(() => {
        inFlight = false;
      }, 500);

      const promise = service.disableAndReset(RACE_ID, COURSE_ID, {});
      await jest.advanceTimersByTimeAsync(600);
      const result = await promise;
      jest.useRealTimers();

      expect(result.success).toBe(true);
      expect(mockRaceResultService.deleteResultsByCourse).toHaveBeenCalled();
    });

    it('TC-68-12 cron stuck > 5s timeout — log warn + continue anyway', async () => {
      jest.useFakeTimers();
      mockRaceSyncCron.isCurrentlySync.mockReturnValue(true); // never flips
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const promise = service.disableAndReset(RACE_ID, COURSE_ID, {});
      await jest.advanceTimersByTimeAsync(6000);
      const result = await promise;
      jest.useRealTimers();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cron wait timeout exceeded'),
      );
      expect(result.success).toBe(true);
      expect(mockRaceResultService.deleteResultsByCourse).toHaveBeenCalled();
    });

    it('Danny chốt H: concurrent reset blocked by SETNX lock → 409 RESET_IN_PROGRESS', async () => {
      mockRedis.set.mockResolvedValueOnce(null); // SETNX fails (lock held)

      await expect(
        service.disableAndReset(RACE_ID, COURSE_ID, {}),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'RESET_IN_PROGRESS' }),
      });
      expect(mockRaceResultService.deleteResultsByCourse).not.toHaveBeenCalled();
    });

    it('race=live without confirmedLive → 409 + no lock acquired', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({ status: 'live' }),
      });

      await expect(
        service.disableAndReset(RACE_ID, COURSE_ID, {}),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'RACE_IS_LIVE_CONFIRM_REQUIRED',
        }),
      });
      // Lock SETNX must not be called because confirm check is before lock
      expect(mockRedis.set).not.toHaveBeenCalledWith(
        expect.stringContaining('reset-lock'),
        expect.anything(),
        'EX',
        expect.anything(),
        'NX',
      );
    });

    it('lock released even when delete throws', async () => {
      mockRaceResultService.deleteResultsByCourse.mockRejectedValueOnce(
        new Error('Mongo down'),
      );

      await expect(
        service.disableAndReset(RACE_ID, COURSE_ID, {}),
      ).rejects.toThrow('Mongo down');
      // Lock release attempted (DEL called on lock key)
      const delCalls = mockRedis.del.mock.calls.map((c: any[]) => c[0]);
      expect(delCalls.some((k: string) => k.startsWith('reset-lock:'))).toBe(
        true,
      );
    });
  });

  // ─── resetData ────────────────────────────────────────────────

  describe('resetData() — TC-68-13..16', () => {
    it('TC-68-13 EXTEND response shape includes nextCronAt + hasApiUrl + durationMs', async () => {
      const result = await service.resetData(RACE_ID, COURSE_ID, {});

      expect(result.message).toContain('Deleted 576');
      expect(result.deletedCount).toBe(576);
      expect(result.success).toBe(true);
      expect(result.hasApiUrl).toBe(true);
      expect(result.nextCronAt).toBe('2026-05-31T02:55:00.000Z');
      expect(typeof result.durationMs).toBe('number');
      expect(mockAuditLog.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'course.data_reset' }),
      );
    });

    it('TC-68-16 concurrent reset blocked by SETNX lock', async () => {
      mockRedis.set.mockResolvedValueOnce(null);
      await expect(
        service.resetData(RACE_ID, COURSE_ID, {}),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'RESET_IN_PROGRESS' }),
      });
    });

    it('race=live without confirmedLive → 409', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({ status: 'live' }),
      });
      await expect(
        service.resetData(RACE_ID, COURSE_ID, {}),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('race=live with confirmedLive=true → success + audit marks raceWasLive', async () => {
      mockRacesService.getRaceById.mockResolvedValueOnce({
        data: buildRace({ status: 'live' }),
      });
      const result = await service.resetData(RACE_ID, COURSE_ID, {
        confirmedLive: true,
      });
      expect(result.success).toBe(true);
      expect(mockAuditLog.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ raceWasLive: true }),
        }),
      );
    });
  });

  // ─── audit best-effort ────────────────────────────────────────

  describe('emitAudit best-effort (F-023 pattern)', () => {
    it('swallows AuditLogService throw without rolling back mutation', async () => {
      mockAuditLog.emit.mockRejectedValueOnce(new Error('Audit DB down'));
      const result = await service.clearApiUrl(RACE_ID, COURSE_ID, {});
      expect(result.success).toBe(true);
    });
  });
});
