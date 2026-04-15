import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { RaceResultService } from '../race-result/services/race-result.service';
import { RacesService } from '../races/races.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('AdminService', () => {
  let service: AdminService;
  let mockRaceResultService: any;
  let mockRacesService: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockRaceResultService = {
      getSyncLogs: jest.fn(),
      syncSingleCourse: jest.fn(),
      deleteResultsByCourse: jest.fn(),
      getClaims: jest.fn(),
      resolveClaim: jest.fn(),
      purgeCache: jest.fn(),
    };

    mockRacesService = {
      getRaceById: jest.fn(),
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: RaceResultService, useValue: mockRaceResultService },
        { provide: RacesService, useValue: mockRacesService },
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getSyncLogs ──────────────────────────────────────────────

  describe('getSyncLogs', () => {
    it('should return paginated sync logs', async () => {
      const mockLogs = {
        data: [{ _id: 'log1', raceId: 'r1', status: 'success' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };
      mockRaceResultService.getSyncLogs.mockResolvedValue(mockLogs);

      const result = await service.getSyncLogs(1, 20);

      expect(mockRaceResultService.getSyncLogs).toHaveBeenCalledWith(1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should handle different page sizes', async () => {
      const mockLogs = {
        data: [],
        pagination: { page: 3, pageSize: 5, total: 12, totalPages: 3 },
      };
      mockRaceResultService.getSyncLogs.mockResolvedValue(mockLogs);

      const result = await service.getSyncLogs(3, 5);

      expect(mockRaceResultService.getSyncLogs).toHaveBeenCalledWith(3, 5);
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  // ─── forceSync ────────────────────────────────────────────────

  describe('forceSync', () => {
    it('should trigger sync for a specific course', async () => {
      mockRacesService.getRaceById.mockResolvedValue({
        data: {
          _id: 'race1',
          courses: [
            {
              courseId: 'c708',
              name: '42km',
              distance: '42km',
              apiUrl: 'https://api.raceresult.com/708',
            },
          ],
        },
      });
      mockRaceResultService.syncSingleCourse.mockResolvedValue(150);

      const result = await service.forceSync('race1', 'c708');

      expect(mockRaceResultService.syncSingleCourse).toHaveBeenCalledWith(
        'race1',
        'c708',
        '42km',
        'https://api.raceresult.com/708',
      );
      expect(result.resultCount).toBe(150);
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when race not found', async () => {
      mockRacesService.getRaceById.mockResolvedValue({ data: null });

      await expect(
        service.forceSync('nonexistent', 'c708'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when course not found', async () => {
      mockRacesService.getRaceById.mockResolvedValue({
        data: { _id: 'race1', courses: [] },
      });

      await expect(
        service.forceSync('race1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when course has no apiUrl', async () => {
      mockRacesService.getRaceById.mockResolvedValue({
        data: {
          _id: 'race1',
          courses: [{ courseId: 'c708', name: '42km' }],
        },
      });

      await expect(
        service.forceSync('race1', 'c708'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── resetData ────────────────────────────────────────────────

  describe('resetData', () => {
    it('should delete all results for a course', async () => {
      mockRaceResultService.deleteResultsByCourse.mockResolvedValue(250);

      const result = await service.resetData('race1', 'c708');

      expect(mockRaceResultService.deleteResultsByCourse).toHaveBeenCalledWith(
        'c708',
      );
      expect(result.deletedCount).toBe(250);
      expect(result.success).toBe(true);
    });

    it('should handle zero deletions', async () => {
      mockRaceResultService.deleteResultsByCourse.mockResolvedValue(0);

      const result = await service.resetData('race1', 'empty-course');

      expect(result.deletedCount).toBe(0);
    });
  });

  // ─── resolveClaim ─────────────────────────────────────────────

  describe('resolveClaim', () => {
    it('should resolve a claim', async () => {
      const resolved = {
        _id: 'claim1',
        status: 'resolved',
        adminNote: 'Verified',
      };
      mockRaceResultService.resolveClaim.mockResolvedValue(resolved);

      const result = await service.resolveClaim(
        'claim1',
        'approved',
        'Verified',
        'admin-test',
      );

      expect(mockRaceResultService.resolveClaim).toHaveBeenCalledWith(
        'claim1',
        'approved',
        'Verified',
        'admin-test',
      );
      expect(result.data.status).toBe('resolved');
      expect(result.success).toBe(true);
    });

    it('should reject a claim', async () => {
      const rejected = {
        _id: 'claim2',
        status: 'rejected',
        adminNote: 'Invalid claim',
      };
      mockRaceResultService.resolveClaim.mockResolvedValue(rejected);

      const result = await service.resolveClaim(
        'claim2',
        'rejected',
        'Invalid claim',
        'admin-test',
      );

      expect(result.data.status).toBe('rejected');
    });

    it('should throw NotFoundException when claim not found', async () => {
      mockRaceResultService.resolveClaim.mockResolvedValue(null);

      await expect(
        service.resolveClaim('nonexistent', 'approved', '', 'admin-test'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── purgeCache ───────────────────────────────────────────────

  describe('purgeCache', () => {
    it('should purge Redis cache keys for a course', async () => {
      mockRaceResultService.purgeCache.mockResolvedValue(5);

      const result = await service.purgeCache('c708');

      expect(mockRaceResultService.purgeCache).toHaveBeenCalledWith('c708');
      expect(result.deletedKeys).toBe(5);
      expect(result.success).toBe(true);
    });

    it('should handle zero keys deleted', async () => {
      mockRaceResultService.purgeCache.mockResolvedValue(0);

      const result = await service.purgeCache('empty-course');

      expect(result.deletedKeys).toBe(0);
    });
  });
});
