import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { RacesService } from './races.service';
import { Race } from './schemas/race.schema';
import { CourseMapService } from './services/course-map.service';

describe('RacesService', () => {
  let service: RacesService;
  let mockModel: any;
  let mockHttpService: any;
  let mockRedis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let mockCourseMapService: { deleteGpxFromS3: jest.Mock };

  const mockRace = {
    _id: '665abc123',
    title: 'Vietnam Marathon 2026',
    slug: 'vietnam-marathon-2026',
    status: 'pre_race',
    raceType: 'running',
    province: 'Lào Cai',
    startDate: new Date('2026-04-01'),
    endDate: new Date('2026-04-02'),
    location: 'Sa Pa',
    organizer: 'Topas',
    cacheTtlSeconds: 60,
    courses: [
      {
        courseId: '708',
        name: '42km Full Marathon',
        distance: '42km',
        distanceKm: 42.195,
        courseType: 'road',
        apiUrl: 'https://api.raceresult.com/708',
      },
    ],
  };

  beforeEach(async () => {
    mockModel = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      findOneAndUpdate: jest.fn().mockReturnThis(),
      findByIdAndUpdate: jest.fn().mockReturnThis(),
      findByIdAndDelete: jest.fn().mockReturnThis(),
      create: jest.fn(),
      countDocuments: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockHttpService = {
      get: jest.fn(),
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockCourseMapService = {
      deleteGpxFromS3: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RacesService,
        { provide: getModelToken(Race.name), useValue: mockModel },
        { provide: HttpService, useValue: mockHttpService },
        // F-006 — RacesService now @InjectRedis() (cache invalidate hook
        // in updateCourse). Provide the same DI token nest-modules/ioredis
        // registers so the test module compiles.
        { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis },
        // TD-F006-09 — RacesService now injects CourseMapService for S3 GPX
        // cleanup on course removal. Provide a stub mock for tests.
        { provide: CourseMapService, useValue: mockCourseMapService },
      ],
    }).compile();

    service = module.get<RacesService>(RacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createRace ───────────────────────────────────────────────

  describe('createRace', () => {
    it('should create a race with auto-generated slug', async () => {
      const dto = { title: 'Vietnam Marathon 2026' };
      const created = { ...mockRace, toObject: () => mockRace };
      mockModel.create.mockResolvedValue(created);

      const result = await service.createRace(dto);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Vietnam Marathon 2026',
          slug: 'vietnam-marathon-2026',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should create a race with explicit slug', async () => {
      const dto = { title: 'Test Race', slug: 'custom-slug' };
      const created = { ...mockRace, slug: 'custom-slug', toObject: () => ({ ...mockRace, slug: 'custom-slug' }) };
      mockModel.create.mockResolvedValue(created);

      const result = await service.createRace(dto);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'custom-slug' }),
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── updateRace ───────────────────────────────────────────────

  describe('updateRace', () => {
    it('should partially update a race', async () => {
      mockModel.exec.mockResolvedValue({ ...mockRace, title: 'Updated Title' });

      const result = await service.updateRace('665abc123', {
        title: 'Updated Title',
      });

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '665abc123',
        { $set: expect.objectContaining({ title: 'Updated Title' }) },
        { returnDocument: 'after' },
      );
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when race does not exist', async () => {
      mockModel.exec.mockResolvedValue(null);

      await expect(
        service.updateRace('nonexistent', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update status to live', async () => {
      // findById returns current status (pre_race), findByIdAndUpdate returns updated status (live)
      mockModel.exec
        .mockResolvedValueOnce({ ...mockRace, status: 'pre_race' })
        .mockResolvedValueOnce({ ...mockRace, status: 'live' });

      const result = await service.updateStatus('665abc123', {
        status: 'live',
      });

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '665abc123',
        { $set: { status: 'live' } },
        { returnDocument: 'after' },
      );
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('live');
    });

    it('should update status to ended', async () => {
      // findById returns current status (live), findByIdAndUpdate returns updated status (ended)
      mockModel.exec
        .mockResolvedValueOnce({ ...mockRace, status: 'live' })
        .mockResolvedValueOnce({ ...mockRace, status: 'ended' });

      const result = await service.updateStatus('665abc123', {
        status: 'ended',
      });

      expect(result.data.status).toBe('ended');
    });

    it('should reject transition from ended to any status', async () => {
      mockModel.exec.mockResolvedValueOnce({ ...mockRace, status: 'ended' });

      await expect(
        service.updateStatus('665abc123', { status: 'live' }),
      ).rejects.toThrow('Cannot transition from');
    });

    it('should reject backward transition (live → pre_race)', async () => {
      mockModel.exec.mockResolvedValueOnce({ ...mockRace, status: 'live' });

      await expect(
        service.updateStatus('665abc123', { status: 'pre_race' }),
      ).rejects.toThrow('Invalid status transition');
    });

    it('should throw NotFoundException when race does not exist', async () => {
      mockModel.exec.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', { status: 'live' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── addCourse ────────────────────────────────────────────────

  describe('addCourse', () => {
    it('should add a course to the race courses array', async () => {
      const dto = {
        courseId: '709',
        name: '21km Half Marathon',
        distance: '21km',
        distanceKm: 21.0975,
        courseType: 'road',
        apiUrl: 'https://api.raceresult.com/709',
      };
      const updatedRace = {
        ...mockRace,
        courses: [...mockRace.courses, dto],
      };
      mockModel.exec.mockResolvedValue(updatedRace);

      const result = await service.addCourse('665abc123', dto);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '665abc123',
        { $push: { courses: dto } },
        { returnDocument: 'after' },
      );
      expect(result.success).toBe(true);
      expect(result.data.courses).toHaveLength(2);
    });

    it('should throw NotFoundException when race does not exist', async () => {
      mockModel.exec.mockResolvedValue(null);

      await expect(
        service.addCourse('nonexistent', { courseId: '1', name: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateCourse ─────────────────────────────────────────────

  describe('updateCourse', () => {
    it('should update a specific course by courseId', async () => {
      const updatedRace = {
        ...mockRace,
        courses: [
          { ...mockRace.courses[0], apiUrl: 'https://new-url.com' },
        ],
      };
      mockModel.findOneAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedRace),
        }),
      });

      const result = await service.updateCourse('665abc123', '708', {
        apiUrl: 'https://new-url.com',
      });

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when race or course not found', async () => {
      mockModel.findOneAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.updateCourse('nonexistent', '999', { apiUrl: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    // F-006 BR-CM-10 + Concern 2 — direct DEL master:course-map: key
    // after $set succeeds (avoids circular DI per Clarification 3).
    it('should invalidate master:course-map cache after update', async () => {
      const updatedRace = { ...mockRace, slug: 's' };
      mockModel.findOneAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedRace),
        }),
      });

      await service.updateCourse('665abc123', '708', { apiUrl: 'x' });

      expect(mockRedis.del).toHaveBeenCalledWith(
        'master:course-map:665abc123:708',
      );
    });
  });

  // ─── removeCourse ─────────────────────────────────────────────

  describe('removeCourse', () => {
    it('should remove a course from the array', async () => {
      const updatedRace = { ...mockRace, courses: [] };
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedRace),
        }),
      });

      const result = await service.removeCourse('665abc123', '708');

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '665abc123',
        { $pull: { courses: { courseId: '708' } } },
        { returnDocument: 'after' },
      );
      expect(result.success).toBe(true);
      expect(result.data.courses).toHaveLength(0);
    });

    it('should throw NotFoundException when race not found', async () => {
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.removeCourse('nonexistent', '708'),
      ).rejects.toThrow(NotFoundException);
    });

    // TD-F006-08 — direct DEL master:course-map: key after $pull succeeds
    // (mirrors updateCourse pattern; prevents stale public response after
    // BTC removes a course).
    it('should invalidate master:course-map cache after removeCourse', async () => {
      const updatedRace = { ...mockRace, slug: 's', courses: [] };
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedRace),
        }),
      });

      await service.removeCourse('665abc123', '708');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'master:course-map:665abc123:708',
      );
    });

    // TD-F006-09 — when the removed course had `gpxUrl` or `gpxSimplifiedUrl`,
    // deleteGpxFromS3 must run BEFORE the $pull so we don't leave orphaned S3
    // objects under `courses/<raceId>/<courseId>/`.
    it('TD-F006-09: should call deleteGpxFromS3 when course had gpxUrl', async () => {
      const courseWithGpx = {
        courseId: '708',
        gpxUrl: 'https://s3.example/courses/665abc123/708/original.gpx',
        gpxSimplifiedUrl:
          'https://s3.example/courses/665abc123/708/simplified.geojson',
      };
      // findOne returns the projected course-only doc
      mockModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ courses: [courseWithGpx] }),
        }),
      });
      const updatedRace = { ...mockRace, slug: 's', courses: [] };
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedRace),
        }),
      });

      await service.removeCourse('665abc123', '708');

      expect(mockCourseMapService.deleteGpxFromS3).toHaveBeenCalledWith(
        '665abc123',
        '708',
      );
    });

    it('TD-F006-09: should NOT call deleteGpxFromS3 when course had no GPX', async () => {
      mockModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            courses: [{ courseId: '708' /* no gpxUrl */ }],
          }),
        }),
      });
      const updatedRace = { ...mockRace, slug: 's', courses: [] };
      mockModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedRace),
        }),
      });

      await service.removeCourse('665abc123', '708');

      expect(mockCourseMapService.deleteGpxFromS3).not.toHaveBeenCalled();
    });
  });

  // ─── searchRaces ──────────────────────────────────────────────

  describe('searchRaces', () => {
    it('should return paginated results with text search', async () => {
      // Set up chained calls: find -> sort -> skip -> limit -> lean -> exec
      mockModel.exec
        .mockResolvedValueOnce([mockRace]) // for find chain
        .mockResolvedValueOnce(1); // for countDocuments

      const result = await service.searchRaces({
        title: 'Marathon',
        page: 0,
        pageSize: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data.totalItems).toBe(1);
      expect(result.data.list).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockModel.exec
        .mockResolvedValueOnce([mockRace])
        .mockResolvedValueOnce(1);

      await service.searchRaces({ status: 'pre_race', page: 0, pageSize: 10 });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pre_race' }),
      );
    });

    it('should filter by province', async () => {
      mockModel.exec
        .mockResolvedValueOnce([mockRace])
        .mockResolvedValueOnce(1);

      await service.searchRaces({ province: 'Lào Cai', page: 0, pageSize: 10 });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ province: 'Lào Cai' }),
      );
    });

    it('should handle pagination correctly', async () => {
      mockModel.exec
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(50);

      const result = await service.searchRaces({ page: 2, pageSize: 10 });

      expect(mockModel.skip).toHaveBeenCalledWith(20);
      expect(mockModel.limit).toHaveBeenCalledWith(10);
      expect(result.data.totalPages).toBe(5);
    });
  });

  // ─── getRaceBySlug ────────────────────────────────────────────

  describe('getRaceBySlug', () => {
    it('should return a race when slug matches', async () => {
      mockModel.exec.mockResolvedValue(mockRace);

      const result = await service.getRaceBySlug('vietnam-marathon-2026');

      expect(mockModel.findOne).toHaveBeenCalledWith({
        slug: 'vietnam-marathon-2026',
      });
      expect(result.success).toBe(true);
      // BR-UX-31 / TD-F006-04 — getRaceBySlug strips private fields for public
      // callers (default isPrivileged=false): _id is replaced by id (string),
      // cacheTtlSeconds is removed, and per-course apiUrl is scrubbed.
      const { _id, cacheTtlSeconds, courses, ...publicBase } = mockRace;
      const expectedPublic = {
        ...publicBase,
        id: _id,
        courses: courses.map(({ apiUrl: _api, ...rest }) => rest),
      };
      expect(result.data).toEqual(expectedPublic);
    });

    it('should return not found when slug does not match', async () => {
      mockModel.exec.mockResolvedValue(null);

      const result = await service.getRaceBySlug('nonexistent-slug');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.message).toBe('Race not found');
    });
  });

  // ─── deleteRace ───────────────────────────────────────────────

  describe('deleteRace', () => {
    it('should delete and return the race', async () => {
      mockModel.exec.mockResolvedValue(mockRace);

      const result = await service.deleteRace('665abc123');

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('665abc123');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Race deleted');
    });

    it('should throw NotFoundException when race not found', async () => {
      mockModel.exec.mockResolvedValue(null);

      await expect(service.deleteRace('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
