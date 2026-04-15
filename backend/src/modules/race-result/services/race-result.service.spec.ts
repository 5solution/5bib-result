import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RaceResultService } from './race-result.service';
import { RaceResult } from '../schemas/race-result.schema';
import { SyncLog } from '../schemas/sync-log.schema';
import { ResultClaim } from '../schemas/result-claim.schema';
import { RacesService } from '../../races/races.service';

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
      getRaceById: jest.fn(),
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaceResultService,
        { provide: getModelToken(RaceResult.name), useValue: mockResultModel },
        { provide: getModelToken(SyncLog.name), useValue: mockSyncLogModel },
        { provide: getModelToken(ResultClaim.name), useValue: mockClaimModel },
        { provide: RacesService, useValue: mockRacesService },
        { provide: REDIS_TOKEN, useValue: mockRedis },
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

      const result = await service.getCourseStats('c708');

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

      const result = await service.getCourseStats('empty-course');

      expect(result.totalFinishers).toBe(0);
      expect(result.avgTime).toBeNull();
    });

    it('should use cached data when available', async () => {
      const cached = { totalFinishers: 50, avgTime: '04:00:00', minTime: '03:00:00', maxTime: '05:00:00', avgPace: null, maleCount: 30, femaleCount: 20 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getCourseStats('c708');

      expect(result).toEqual(cached);
      expect(mockResultModel.aggregate).not.toHaveBeenCalled();
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
