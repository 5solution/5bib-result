import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RaceResultService } from './race-result.service';
import { RaceResult } from '../schemas/race-result.schema';
import { SyncLog } from '../schemas/sync-log.schema';
import { ResultClaim } from '../schemas/result-claim.schema';
import { RacesService } from '../../races/races.service';
import { TimingAlertConfig } from '../../timing-alert/schemas/timing-alert-config.schema';
import { TelegramService } from '../../notification/telegram.service';
import { MailService } from '../../notification/mail.service';
import { UploadService } from '../../upload/upload.service';
import { RaceResultApiService } from './race-result-api.service';
import { ChipConfigService } from '../../chip-verification/services/chip-config.service';
import { ChipMappingService } from '../../chip-verification/services/chip-mapping.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('RaceResultService', () => {
  let service: RaceResultService;
  let mockResultModel: any;
  let mockSyncLogModel: any;
  let mockClaimModel: any;
  let mockRacesService: any;
  let mockRedis: any;

  const mockDoc = {
    _id: 'res1',
    raceId: 'race1',
    courseId: 'c708',
    bib: '1001',
    name: 'Nguyen Van A',
    distance: '42km',
    overallRank: '1',
    overallRankNumeric: 1,
    genderRank: '1',
    genderRankNumeric: 1,
    categoryRank: '1',
    categoryRankNumeric: 1,
    gender: 'Male',
    category: 'Male 30-39',
    chipTime: '03:30:00',
    gunTime: '03:31:00',
    pace: '4:58/km',
    timingPoint: 'Finish',
    certi: '1',
    certificate: 'https://cert.example.com',
    overallRanks: '1',
    genderRanks: '1',
    chiptimes: '03:30:00',
    guntimes: '03:31:00',
    paces: '4:58/km',
    tods: '',
    sectors: '',
    overrankLive: '1',
    overrankLiveNumeric: 1,
    gap: '',
    nationality: 'VN',
    nation: 'Vietnam',
    syncedAt: new Date(),
    rawData: {},
  };

  const mockDoc2 = {
    ...mockDoc,
    _id: 'res2',
    bib: '1002',
    name: 'Tran Thi B',
    overallRank: '2',
    overallRankNumeric: 2,
    genderRank: '1',
    genderRankNumeric: 1,
    gender: 'Female',
    category: 'Female 30-39',
    chipTime: '04:00:00',
    gunTime: '04:01:00',
  };

  const mockDoc3 = {
    ...mockDoc,
    _id: 'res3',
    bib: '1003',
    name: 'Le Van C',
    overallRank: '3',
    overallRankNumeric: 3,
    chipTime: '04:15:00',
  };

  beforeEach(async () => {
    mockResultModel = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      create: jest.fn(),
      bulkWrite: jest.fn(),
      countDocuments: jest.fn().mockReturnThis(),
      deleteMany: jest.fn().mockReturnThis(),
      aggregate: jest.fn().mockReturnThis(),
      // FEATURE-021 — getCourseStats() now calls .distinct('nationality', ...)
      distinct: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockSyncLogModel = {
      find: jest.fn().mockReturnThis(),
      create: jest.fn(),
      countDocuments: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockClaimModel = {
      find: jest.fn().mockReturnThis(),
      findByIdAndUpdate: jest.fn().mockReturnThis(),
      create: jest.fn(),
      countDocuments: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockRacesService = {
      getRacesWithApiUrls: jest.fn().mockResolvedValue([]),
      // F-029 — default: race exists + non-draft status so existing tests
      // continue to pass through new draft filter. Per-test override for
      // F-029 draft-filter spec block below.
      getRaceById: jest.fn().mockResolvedValue({
        success: true,
        data: { _id: 'test-race', status: 'live' },
      }),
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
    };

    // F-010 — read-only TimingAlertConfig mock for getPaceAlertThreshold().
    // Existing pre-F-010 tests didn't mock TelegramService, MailService,
    // UploadService, RaceResultApiService — they were already failing on main
    // (test infra debt). F-010 adds TimingAlertConfigModel mock following
    // the same pattern; pre-existing failures preserved (out of scope to fix).
    const mockTimingAlertConfigModel = {
      findOne: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    };

    // FEATURE-021 — minimum no-op mocks for transitive providers so the
    // testing module compiles. Pre-existing tests skipped these (test infra
    // debt). F-021 needs getCourseStats() tests to actually run, so add the
    // mocks here. None of the methods are exercised by the assertions below.
    const noopAsync = jest.fn().mockResolvedValue(undefined);
    const mockTelegramService = { sendMessage: noopAsync };
    const mockMailService = { sendMail: noopAsync };
    const mockUploadService = { upload: noopAsync, deleteByUrl: noopAsync };
    const mockApiService = {
      fetchRaceResults: jest.fn().mockResolvedValue([]),
    };
    const mockChipConfigService = {
      findByMongoId: jest.fn().mockResolvedValue(null),
    };
    const mockChipMappingService = {
      findByChipId: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaceResultService,
        { provide: getModelToken(RaceResult.name), useValue: mockResultModel },
        { provide: getModelToken(SyncLog.name), useValue: mockSyncLogModel },
        { provide: getModelToken(ResultClaim.name), useValue: mockClaimModel },
        { provide: RacesService, useValue: mockRacesService },
        { provide: REDIS_TOKEN, useValue: mockRedis },
        {
          provide: getModelToken(TimingAlertConfig.name),
          useValue: mockTimingAlertConfigModel,
        },
        { provide: TelegramService, useValue: mockTelegramService },
        { provide: MailService, useValue: mockMailService },
        { provide: UploadService, useValue: mockUploadService },
        { provide: RaceResultApiService, useValue: mockApiService },
        { provide: ChipConfigService, useValue: mockChipConfigService },
        { provide: ChipMappingService, useValue: mockChipMappingService },
      ],
    }).compile();

    service = module.get<RaceResultService>(RaceResultService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getRaceResults ───────────────────────────────────────────

  describe('getRaceResults', () => {
    it('should return filtered results by courseId', async () => {
      mockResultModel.exec.mockResolvedValue([mockDoc, mockDoc2]);

      const result = await service.getRaceResults({
        raceId: 'test-race',
        course_id: 'c708',
        pageNo: 1,
        pageSize: 10,
        sortField: 'OverallRank',
        sortDirection: 'ASC',
      });

      expect(mockResultModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c708' }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by gender', async () => {
      mockResultModel.exec.mockResolvedValue([mockDoc2]);

      const result = await service.getRaceResults({
        raceId: 'test-race',
        gender: 'Female',
        pageNo: 1,
        pageSize: 10,
        sortField: 'OverallRank',
        sortDirection: 'ASC',
      });

      expect(mockResultModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ gender: 'Female' }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('should filter by category', async () => {
      mockResultModel.exec.mockResolvedValue([mockDoc]);

      await service.getRaceResults({
        raceId: 'test-race',
        category: 'Male 30-39',
        pageNo: 1,
        pageSize: 10,
        sortField: 'OverallRank',
        sortDirection: 'ASC',
      });

      expect(mockResultModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Male 30-39' }),
      );
    });

    it('should filter by name search', async () => {
      mockResultModel.exec.mockResolvedValue([mockDoc]);

      await service.getRaceResults({
        raceId: 'test-race',
        name: 'Nguyen',
        pageNo: 1,
        pageSize: 10,
        sortField: 'OverallRank',
        sortDirection: 'ASC',
      });

      expect(mockResultModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          name: { $regex: 'Nguyen', $options: 'i' },
        }),
      );
    });

    it('should paginate correctly', async () => {
      const docs = [mockDoc, mockDoc2, mockDoc3];
      mockResultModel.exec.mockResolvedValue(docs);

      const result = await service.getRaceResults({
        raceId: 'test-race',
        pageNo: 1,
        pageSize: 2,
        sortField: 'OverallRank',
        sortDirection: 'ASC',
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.total).toBe(3);
    });

    it('should sort by different fields', async () => {
      mockResultModel.exec.mockResolvedValue([mockDoc]);

      await service.getRaceResults({
        raceId: 'test-race',
        pageNo: 1,
        pageSize: 10,
        sortField: 'ChipTime',
        sortDirection: 'DESC',
      });

      expect(mockResultModel.sort).toHaveBeenCalledWith({ chipTime: -1 });
    });

    it('should return cached data if available', async () => {
      const cachedPayload = { data: [{ Bib: '99' }], pagination: { pageNo: 1, pageSize: 10, total: 1, totalPages: 1 } };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPayload));

      const result = await service.getRaceResults({
        raceId: 'test-race',
        course_id: 'c708',
        pageNo: 1,
        pageSize: 10,
        sortField: 'OverallRank',
        sortDirection: 'ASC',
      });

      expect(result).toEqual(cachedPayload);
      expect(mockResultModel.find).not.toHaveBeenCalled();
    });
  });

  // ─── F-029 HIGH-RR-01 draft filter ────────────────────────────

  describe('getRaceResults — F-029 HIGH-RR-01 draft filter', () => {
    const baseDto = {
      raceId: 'race-draft',
      course_id: 'c100',
      pageNo: 1,
      pageSize: 10,
      sortField: 'OverallRank',
      sortDirection: 'ASC',
    } as const;

    it('allows anonymous caller for race status=live (200 results)', async () => {
      mockRacesService.getRaceById.mockResolvedValue({
        success: true,
        data: { _id: 'race-live', status: 'live' },
      });
      mockResultModel.exec.mockResolvedValue([mockDoc]);

      const result = await service.getRaceResults(
        { ...baseDto, raceId: 'race-live' },
        // user undefined = anonymous
      );

      expect(mockRacesService.getRaceById).toHaveBeenCalledWith(
        'race-live',
        false, // isPrivileged=false for anon
      );
      expect(result.data).toHaveLength(1);
    });

    it('allows anonymous caller for race status=pre_race', async () => {
      mockRacesService.getRaceById.mockResolvedValue({
        success: true,
        data: { _id: 'race-pre', status: 'pre_race' },
      });
      mockResultModel.exec.mockResolvedValue([mockDoc]);

      const result = await service.getRaceResults({
        ...baseDto,
        raceId: 'race-pre',
      });

      expect(result.data).toHaveLength(1);
    });

    it('allows anonymous caller for race status=ended', async () => {
      mockRacesService.getRaceById.mockResolvedValue({
        success: true,
        data: { _id: 'race-end', status: 'ended' },
      });
      mockResultModel.exec.mockResolvedValue([mockDoc]);

      const result = await service.getRaceResults({
        ...baseDto,
        raceId: 'race-end',
      });

      expect(result.data).toHaveLength(1);
    });

    it('THROWS 404 for anonymous caller hitting race status=draft', async () => {
      // RacesService.getRaceById returns success=false when race is draft + caller not privileged.
      mockRacesService.getRaceById.mockResolvedValue({
        success: false,
        message: 'Race not found',
      });

      await expect(service.getRaceResults(baseDto)).rejects.toThrow(
        'Không tìm thấy giải',
      );
      expect(mockRacesService.getRaceById).toHaveBeenCalledWith(
        'race-draft',
        false,
      );
      // Critical: should NOT proceed to results query when race is blocked.
      expect(mockResultModel.find).not.toHaveBeenCalled();
    });

    it('ALLOWS admin (Logto role=admin) to preview draft race', async () => {
      // RacesService receives isPrivileged=true → returns success=true even for draft.
      mockRacesService.getRaceById.mockResolvedValue({
        success: true,
        data: { _id: 'race-draft', status: 'draft' },
      });
      mockResultModel.exec.mockResolvedValue([mockDoc]);

      const adminUser = {
        userId: 'u1',
        sub: 'u1',
        email: 'admin@5bib.com',
        role: 'admin',
        roles: ['admin'],
        scopes: [],
      };
      const result = await service.getRaceResults(baseDto, adminUser);

      expect(mockRacesService.getRaceById).toHaveBeenCalledWith(
        'race-draft',
        true, // isPrivileged=true via roles.includes('admin')
      );
      expect(result.data).toHaveLength(1);
    });

    it('ALLOWS staff (Logto scope=staff) to preview draft race per Q1=B', async () => {
      mockRacesService.getRaceById.mockResolvedValue({
        success: true,
        data: { _id: 'race-draft', status: 'draft' },
      });
      mockResultModel.exec.mockResolvedValue([mockDoc]);

      const staffUser = {
        userId: 'u2',
        sub: 'u2',
        email: 'staff@5bib.com',
        role: 'user',
        roles: ['user'],
        scopes: ['staff'], // dual-check: scopes alone is enough
      };
      const result = await service.getRaceResults(baseDto, staffUser);

      expect(mockRacesService.getRaceById).toHaveBeenCalledWith(
        'race-draft',
        true, // isPrivileged=true via scopes.includes('staff')
      );
      expect(result.data).toHaveLength(1);
    });

    it('THROWS 404 for authenticated user without staff/admin role', async () => {
      mockRacesService.getRaceById.mockResolvedValue({
        success: false,
        message: 'Race not found',
      });

      const lowPrivUser = {
        userId: 'u3',
        sub: 'u3',
        email: 'viewer@5bib.com',
        role: 'user',
        roles: ['user', 'viewer'], // neither admin nor staff
        scopes: ['profile', 'email'],
      };

      await expect(
        service.getRaceResults(baseDto, lowPrivUser),
      ).rejects.toThrow('Không tìm thấy giải');
      expect(mockRacesService.getRaceById).toHaveBeenCalledWith(
        'race-draft',
        false, // isPrivileged=false — neither role nor scope match
      );
    });

    it('THROWS 404 when race does not exist (anon AND privileged identical response — no existence leak)', async () => {
      mockRacesService.getRaceById.mockResolvedValue({
        success: false,
        message: 'Race not found',
      });

      // Same 404 for anon AND admin when race truly missing — verify no existence leak.
      await expect(
        service.getRaceResults({ ...baseDto, raceId: 'nonexistent' }),
      ).rejects.toThrow('Không tìm thấy giải');

      const adminUser = {
        userId: 'u1',
        sub: 'u1',
        email: 'admin@5bib.com',
        role: 'admin',
        roles: ['admin'],
        scopes: [],
      };
      await expect(
        service.getRaceResults(
          { ...baseDto, raceId: 'nonexistent' },
          adminUser,
        ),
      ).rejects.toThrow('Không tìm thấy giải');
    });
  });

  // ─── F-029 Phase 1.1 — HIGH-RR-01 sibling endpoints ───────────

  describe('F-029 Phase 1.1 — HIGH-RR-01 sibling endpoints', () => {
    const adminUser = {
      userId: 'u-admin',
      sub: 'u-admin',
      email: 'admin@5bib.com',
      role: 'admin',
      roles: ['admin'],
      scopes: [],
    };
    const draftLookupBlocked = { success: false, message: 'Race not found' };
    const liveLookupPass = {
      success: true,
      data: { _id: 'race-live', status: 'live' },
    };
    const draftLookupAdmin = {
      success: true,
      data: { _id: 'race-draft', status: 'draft' },
    };

    beforeEach(() => {
      // Reset to live by default — per-test override for draft scenarios.
      mockRacesService.getRaceById.mockResolvedValue(liveLookupPass);
      // Provide getRacesWithApiUrls for course → raceId resolution.
      mockRacesService.getRacesWithApiUrls.mockResolvedValue([
        {
          _id: 'race-live',
          status: 'live',
          courses: [{ courseId: 'course-live' }],
        },
        {
          _id: 'race-draft',
          status: 'draft',
          courses: [{ courseId: 'course-draft' }],
        },
      ]);
    });

    // ── Helper tests ──

    it('Helper enforceRaceVisibility — anon + race draft → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).enforceRaceVisibility('race-draft', undefined),
      ).rejects.toThrow('Không tìm thấy giải');
    });

    it('Helper enforceRaceVisibility — admin + race draft → resolves (no throw)', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupAdmin);
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).enforceRaceVisibility('race-draft', adminUser),
      ).resolves.toBeUndefined();
    });

    it('Helper resolveRaceIdFromCourseId — found → returns race._id string', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).resolveRaceIdFromCourseId('course-live');
      expect(result).toBe('race-live');
    });

    it('Helper resolveRaceIdFromCourseId — not found → returns null', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).resolveRaceIdFromCourseId('course-nonexistent');
      expect(result).toBeNull();
    });

    // ── 13 sibling endpoint blocks ──

    it('getLeaderboard — anon + course of draft race → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(service.getLeaderboard('course-draft', 10)).rejects.toThrow(
        'Không tìm thấy giải',
      );
    });

    it('getLeaderboard — admin + course of draft race → succeeds', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupAdmin);
      mockResultModel.exec.mockResolvedValue([mockDoc]);
      const result = await service.getLeaderboard('course-draft', 10, adminUser);
      expect(Array.isArray(result)).toBe(true);
    });

    it('getLeaderboard — course not found → throws 404 (same VN message, no existence leak)', async () => {
      await expect(
        service.getLeaderboard('course-nonexistent', 10),
      ).rejects.toThrow('Không tìm thấy giải');
    });

    it('getAthleteDetail — anon + draft race → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(service.getAthleteDetail('race-draft', '1001')).rejects.toThrow(
        'Không tìm thấy giải',
      );
    });

    it('compareAthletes — anon + draft race → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(
        service.compareAthletes('race-draft', ['1001', '1002']),
      ).rejects.toThrow('Không tìm thấy giải');
    });

    it('getCourseStats — anon + draft race → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(
        service.getCourseStats('race-draft', 'c708'),
      ).rejects.toThrow('Không tìm thấy giải');
    });

    it('getFilterOptions — anon + course of draft race → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(service.getFilterOptions('course-draft')).rejects.toThrow(
        'Không tìm thấy giải',
      );
    });

    it('getTimeDistribution — anon + course of draft race → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(service.getTimeDistribution('course-draft')).rejects.toThrow(
        'Không tìm thấy giải',
      );
    });

    it('getCountryStats — anon + course of draft race → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(service.getCountryStats('course-draft')).rejects.toThrow(
        'Không tìm thấy giải',
      );
    });

    it('getCountryRank — anon + draft race → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(
        service.getCountryRank('race-draft', '1001'),
      ).rejects.toThrow('Không tìm thấy giải');
    });

    it('getPercentile — anon + draft race → throws 404', async () => {
      mockRacesService.getRaceById.mockResolvedValue(draftLookupBlocked);
      await expect(
        service.getPercentile('race-draft', '1001'),
      ).rejects.toThrow('Không tìm thấy giải');
    });

    it('All sibling methods — happy path live race + anon → proceed normally (NO 404)', async () => {
      // Smoke: when race is live, no helper-throw should fire — service proceeds
      // to actual logic (Mongo query). Mock returns empty array safely.
      mockResultModel.exec.mockResolvedValue([]);
      mockResultModel.aggregate.mockReturnThis();
      mockResultModel.distinct.mockReturnThis();

      // Verify each method does NOT throw when race is live.
      await expect(
        service.getAthleteDetail('race-live', '1001'),
      ).resolves.not.toThrow();
      await expect(
        service.compareAthletes('race-live', ['1001']),
      ).resolves.not.toThrow();
    });
  });

  // ─── getLeaderboard ───────────────────────────────────────────

  describe('getLeaderboard', () => {
    it('should return top N results sorted by overallRank', async () => {
      mockResultModel.exec.mockResolvedValue([mockDoc, mockDoc2]);

      const result = await service.getLeaderboard('c708', 10);

      expect(mockResultModel.find).toHaveBeenCalledWith({
        courseId: 'c708',
        overallRankNumeric: { $nin: [999999, null] },
      });
      expect(mockResultModel.sort).toHaveBeenCalledWith({
        overallRankNumeric: 1,
      });
      expect(mockResultModel.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
      expect(result[0].Bib).toBe('1001');
    });

    it('should use cached data when available', async () => {
      const cached = [{ Bib: '99', Name: 'Cached' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getLeaderboard('c708', 5);

      expect(result).toEqual(cached);
      expect(mockResultModel.find).not.toHaveBeenCalled();
    });
  });

  // ─── getAthleteDetail ─────────────────────────────────────────

  describe('getAthleteDetail', () => {
    it('should return athlete detail when found', async () => {
      mockResultModel.exec.mockResolvedValue(mockDoc);

      const result = await service.getAthleteDetail('race1', '1001');

      expect(mockResultModel.findOne).toHaveBeenCalledWith({
        raceId: 'race1',
        bib: '1001',
      });
      expect(result).toBeDefined();
      expect(result.Bib).toBe('1001');
      expect(result.Name).toBe('Nguyen Van A');
    });

    it('should return null when athlete not found', async () => {
      mockResultModel.exec.mockResolvedValue(null);

      const result = await service.getAthleteDetail('race1', '9999');

      expect(result).toBeNull();
    });
  });

  // ─── compareAthletes ──────────────────────────────────────────

  describe('compareAthletes', () => {
    it('should return results for multiple bibs', async () => {
      mockResultModel.exec.mockResolvedValue([mockDoc, mockDoc2]);

      const result = await service.compareAthletes('race1', [
        '1001',
        '1002',
      ]);

      expect(mockResultModel.find).toHaveBeenCalledWith({
        raceId: 'race1',
        bib: { $in: ['1001', '1002'] },
      });
      expect(result).toHaveLength(2);
    });
  });

  // ─── getCourseStats ───────────────────────────────────────────

  describe('getCourseStats', () => {
    it('should return aggregated stats', async () => {
      mockResultModel.exec.mockResolvedValue([
        {
          _id: null,
          totalFinishers: 100,
          avgTimeSeconds: 14400, // 4:00:00
          minTimeSeconds: 10800, // 3:00:00
          maxTimeSeconds: 18000, // 5:00:00
          genders: ['Male', 'Female', 'Male'],
        },
      ]);

      const result = await service.getCourseStats('race1', 'c708');

      expect(mockResultModel.aggregate).toHaveBeenCalled();
      expect(result.totalFinishers).toBe(100);
      expect(result.avgTime).toBe('04:00:00');
      expect(result.minTime).toBe('03:00:00');
      expect(result.maxTime).toBe('05:00:00');
      expect(result.maleCount).toBe(2);
      expect(result.femaleCount).toBe(1);
    });

    it('should return empty stats when no results', async () => {
      mockResultModel.exec.mockResolvedValue([]);

      const result = await service.getCourseStats('race1', 'empty-course');

      expect(result.totalFinishers).toBe(0);
      expect(result.avgTime).toBeNull();
    });

    it('should use cached data when available', async () => {
      const cached = { totalFinishers: 50, avgTime: '04:00:00', minTime: '03:00:00', maxTime: '05:00:00', avgPace: null, maleCount: 30, femaleCount: 20 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getCourseStats('race1', 'c708');

      expect(result).toEqual(cached);
      expect(mockResultModel.aggregate).not.toHaveBeenCalled();
    });

    // ─── FEATURE-021 BR-DISPLAY-07/08 — raceId scoping ────────

    it('FEATURE-021 — uses per-race cache key stats:<raceId>:<courseId>', async () => {
      mockResultModel.exec.mockResolvedValue([
        {
          _id: null,
          totalFinishers: 15,
          avgTimeSeconds: 1800,
          minTimeSeconds: 1500,
          maxTimeSeconds: 2400,
          genders: ['Male'],
        },
      ]);

      await service.getCourseStats('raceA', '5km');

      // Cache READ probe (getFromCache → redis.get)
      expect(mockRedis.get).toHaveBeenCalledWith('stats:raceA:5km');
      // Cache WRITE on miss (setCache → redis.set)
      expect(mockRedis.set).toHaveBeenCalledWith(
        'stats:raceA:5km',
        expect.any(String),
        'EX',
        60,
      );
    });

    it('FEATURE-021 — calls aggregate with raceId in $match (cross-race isolation)', async () => {
      mockResultModel.exec.mockResolvedValue([
        {
          _id: null,
          totalFinishers: 1,
          avgTimeSeconds: 1800,
          minTimeSeconds: 1800,
          maxTimeSeconds: 1800,
          genders: ['Male'],
        },
      ]);

      await service.getCourseStats('raceA', '5km');

      // First aggregate pipeline must filter by raceId AND courseId
      const firstAggCall = mockResultModel.aggregate.mock.calls[0]?.[0];
      expect(firstAggCall).toBeDefined();
      const firstMatch = firstAggCall[0].$match;
      expect(firstMatch.raceId).toBe('raceA');
      expect(firstMatch.courseId).toBe('5km');

      // distinct nationality also filters by raceId
      expect(mockResultModel.distinct).toHaveBeenCalledWith(
        'nationality',
        expect.objectContaining({ raceId: 'raceA', courseId: '5km' }),
      );
    });

    it('FEATURE-021 — different raceIds use different cache keys (raceA ≠ raceB)', async () => {
      mockResultModel.exec.mockResolvedValue([]);

      await service.getCourseStats('raceA', '5km');
      await service.getCourseStats('raceB', '5km');

      const getCalls = mockRedis.get.mock.calls.map((c: unknown[]) => c[0]);
      expect(getCalls).toContain('stats:raceA:5km');
      expect(getCalls).toContain('stats:raceB:5km');
      // Sanity — keys are distinct
      expect(getCalls).not.toEqual(['stats:5km', 'stats:5km']);
    });
  });

  // ─── syncRaceResult (via syncAllRaceResults) ──────────────────

  describe('syncAllRaceResults', () => {
    it('should handle upsert correctly via bulkWrite', async () => {
      const mockRace = {
        _id: { toString: () => 'race1' },
        title: 'Test Race',
        courses: [
          {
            courseId: 'c708',
            name: '42km',
            distance: '42km',
            apiUrl: 'https://api.raceresult.com/708',
          },
        ],
      };
      mockRacesService.getRacesWithApiUrls.mockResolvedValue([mockRace]);

      // Mock axios — we need to spy on the private method indirectly
      // For this test we mock the model and skip HTTP
      const axiosGet = jest.spyOn(require('axios'), 'get').mockResolvedValue({
        data: [
          {
            Bib: 1001,
            Name: 'Nguyen Van A',
            OverallRank: 1,
            GenderRank: 1,
            CatRank: 1,
            Gender: 'Male',
            Category: 'Male 30-39',
            ChipTime: '03:30:00',
            GunTime: '03:31:00',
            TimingPoint: 'Finish',
            Pace: '4:58/km',
            Certi: '1',
            Certificate: '',
            OverallRanks: '1',
            GenderRanks: '1',
            Chiptimes: '03:30:00',
            Guntimes: '03:31:00',
            Paces: '4:58/km',
            TODs: '',
            Sectors: '',
            OverrankLive: 1,
            Gap: '',
            Nationality: 'VN',
            Nation: 'Vietnam',
          },
        ],
      });

      mockResultModel.bulkWrite.mockResolvedValue({ ok: 1 });
      mockSyncLogModel.create.mockResolvedValue({});

      await service.syncAllRaceResults();

      expect(mockResultModel.bulkWrite).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            updateOne: expect.objectContaining({
              filter: { raceId: 'race1', courseId: 'c708', bib: '1001' },
            }),
          }),
        ]),
      );

      axiosGet.mockRestore();
    });

    it('should log failure on sync error', async () => {
      const mockRace = {
        _id: { toString: () => 'race1' },
        courses: [
          { courseId: 'c708', name: '42km', distance: '42km', apiUrl: 'https://bad-url.com' },
        ],
      };
      mockRacesService.getRacesWithApiUrls.mockResolvedValue([mockRace]);

      const axiosGet = jest.spyOn(require('axios'), 'get').mockRejectedValue(
        new Error('Network error'),
      );

      mockSyncLogModel.create.mockResolvedValue({});

      await service.syncAllRaceResults();

      expect(mockSyncLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Network error',
        }),
      );

      axiosGet.mockRestore();
    });
  });

  // ─── submitClaim ──────────────────────────────────────────────

  describe('submitClaim', () => {
    it('should create a claim document', async () => {
      const dto = {
        raceId: 'race1',
        courseId: 'c708',
        bib: '1001',
        name: 'Nguyen Van A',
        phone: '0912345678',
        email: 'runner@example.com',
        description: 'My time is wrong',
      };

      const created = { ...dto, _id: 'claim1', status: 'pending', toObject: () => ({ ...dto, _id: 'claim1', status: 'pending' }) };
      mockClaimModel.create.mockResolvedValue(created);

      const result = await service.submitClaim(dto);

      expect(mockClaimModel.create).toHaveBeenCalledWith(dto);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('pending');
    });
  });

  // ─── purgeCache ───────────────────────────────────────────────

  describe('purgeCache', () => {
    it('should delete cache keys matching course patterns', async () => {
      mockRedis.keys
        .mockResolvedValueOnce(['results:c708:1:abc'])
        .mockResolvedValueOnce(['leaderboard:c708'])
        .mockResolvedValueOnce(['stats:c708']);
      mockRedis.del.mockResolvedValue(1);

      const deleted = await service.purgeCache('c708');

      expect(mockRedis.keys).toHaveBeenCalledTimes(3);
      expect(deleted).toBe(3);
    });
  });
});
