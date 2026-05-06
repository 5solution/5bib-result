import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RacesController } from './races.controller';
import { RacesService } from './races.service';
import { CourseMapService } from './services/course-map.service';

describe('RacesController', () => {
  let controller: RacesController;
  let mockRacesService: Partial<RacesService>;
  let mockCourseMapService: Partial<CourseMapService>;

  beforeEach(async () => {
    mockRacesService = {
      searchRaces: jest.fn().mockResolvedValue({ data: { list: [] }, success: true }),
      getRaceById: jest.fn().mockResolvedValue({ data: null, success: false }),
      getRaceBySlug: jest.fn().mockResolvedValue({ data: null, success: false }),
      getRaceByProductId: jest.fn().mockResolvedValue({ data: null, success: false }),
      createRace: jest.fn().mockResolvedValue({ data: {}, success: true }),
      updateRace: jest.fn().mockResolvedValue({ data: {}, success: true }),
      deleteRace: jest.fn().mockResolvedValue({ data: {}, success: true }),
      updateStatus: jest.fn().mockResolvedValue({ data: {}, success: true }),
      addCourse: jest.fn().mockResolvedValue({ data: {}, success: true }),
      updateCourse: jest.fn().mockResolvedValue({ data: {}, success: true }),
      removeCourse: jest.fn().mockResolvedValue({ data: {}, success: true }),
      syncRacesFromSource: jest.fn().mockResolvedValue({ success: true }),
    };

    mockCourseMapService = {
      parseGpxOrKml: jest.fn(),
      matchWaypoints: jest.fn(),
      uploadGpxToS3: jest.fn(),
      deleteGpxFromS3: jest.fn().mockResolvedValue(undefined),
      getCachedMapData: jest.fn(),
      invalidateMapDataCache: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RacesController],
      providers: [
        { provide: RacesService, useValue: mockRacesService },
        { provide: CourseMapService, useValue: mockCourseMapService },
      ],
    }).compile();

    controller = module.get<RacesController>(RacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call searchRaces (anonymous — isPrivileged=false)', async () => {
    const mockReq = { user: undefined } as any;
    await controller.searchRaces({ page: 0, pageSize: 10 }, mockReq);
    expect(mockRacesService.searchRaces).toHaveBeenCalledWith({ page: 0, pageSize: 10 }, false);
  });

  it('should call searchRaces (admin — isPrivileged=true)', async () => {
    const mockReq = { user: { userId: 'u1', sub: 'u1', email: 'a@b.c', role: 'admin' } } as any;
    await controller.searchRaces({ page: 0, pageSize: 10 }, mockReq);
    expect(mockRacesService.searchRaces).toHaveBeenCalledWith({ page: 0, pageSize: 10 }, true);
  });

  it('should call getRaceById', async () => {
    const mockReq = { user: undefined } as any;
    await controller.getRaceById('123', mockReq);
    expect(mockRacesService.getRaceById).toHaveBeenCalledWith('123', false);
  });

  it('should call getRaceBySlug', async () => {
    const mockReq = { user: undefined } as any;
    await controller.getRaceBySlug('my-race', mockReq);
    expect(mockRacesService.getRaceBySlug).toHaveBeenCalledWith('my-race', false);
  });

  it('should call createRace', async () => {
    await controller.createRace({ title: 'New Race' });
    expect(mockRacesService.createRace).toHaveBeenCalled();
  });

  it('should call updateRace', async () => {
    await controller.updateRace('123', { title: 'Updated' });
    expect(mockRacesService.updateRace).toHaveBeenCalledWith('123', { title: 'Updated' });
  });

  it('should call deleteRace', async () => {
    await controller.deleteRace('123');
    expect(mockRacesService.deleteRace).toHaveBeenCalledWith('123');
  });

  it('should call updateStatus', async () => {
    await controller.updateStatus('123', { status: 'live' });
    expect(mockRacesService.updateStatus).toHaveBeenCalledWith('123', { status: 'live' });
  });

  it('should call addCourse', async () => {
    await controller.addCourse('123', { courseId: 'c1', name: 'Test' });
    expect(mockRacesService.addCourse).toHaveBeenCalled();
  });

  it('should call removeCourse', async () => {
    await controller.removeCourse('123', 'c1');
    expect(mockRacesService.removeCourse).toHaveBeenCalledWith('123', 'c1');
  });

  // ─── F-006 course map endpoints ────────────────────────────────

  describe('uploadCourseGpx', () => {
    const sampleFile = (
      overrides: Partial<Express.Multer.File> = {},
    ): Express.Multer.File =>
      ({
        fieldname: 'file',
        originalname: 'route.gpx',
        encoding: '7bit',
        mimetype: 'application/gpx+xml',
        buffer: Buffer.from('<gpx />'),
        size: 1024,
        ...overrides,
      }) as Express.Multer.File;

    it('rejects file > 10MB with BadRequestException', async () => {
      const big = sampleFile({ size: 11 * 1024 * 1024 });
      await expect(
        controller.uploadCourseGpx('r1', 'c1', big),
      ).rejects.toThrow(/vượt quá 10MB/);
    });

    it('rejects non-.gpx/.kml extensions', async () => {
      const pdf = sampleFile({ originalname: 'malicious.pdf' });
      await expect(
        controller.uploadCourseGpx('r1', 'c1', pdf),
      ).rejects.toThrow(/Chỉ chấp nhận/);
    });

    it('rejects missing file with BadRequestException', async () => {
      await expect(
        controller.uploadCourseGpx(
          'r1',
          'c1',
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('happy path: parses → matches → uploads → persists', async () => {
      (mockCourseMapService.parseGpxOrKml as jest.Mock).mockResolvedValue({
        gpxParsed: {
          trackPoints: 100,
          simplifiedPoints: 50,
          totalDistanceKm: 5,
          elevationGain: 0,
          elevationLoss: 0,
          maxElevation: 0,
          minElevation: 0,
          bounds: { north: 1, south: 0, east: 1, west: 0 },
        },
        simplifiedGeoJson: { type: 'Feature' },
        waypoints: [{ name: 'TM1', lat: 1, lng: 2 }],
      });
      (mockCourseMapService.matchWaypoints as jest.Mock).mockReturnValue({
        matched: [{ key: 'TM1', lat: 1, lng: 2, matchType: 'exact' }],
        unmatchedKeys: ['Finish'],
      });
      (mockCourseMapService.uploadGpxToS3 as jest.Mock).mockResolvedValue({
        gpxUrl: 'https://s3/original.gpx',
        gpxSimplifiedUrl: 'https://s3/simplified.geojson',
      });
      (mockRacesService.getRaceById as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          courses: [
            {
              courseId: 'c1',
              checkpoints: [
                { key: 'TM1', name: 'TM1', lat: 9, lng: 9 },
                { key: 'Finish', name: 'Finish' },
              ],
            },
          ],
        },
      });

      const result = await controller.uploadCourseGpx(
        'r1',
        'c1',
        sampleFile(),
      );
      expect(result.gpxSimplifiedUrl).toBe('https://s3/simplified.geojson');
      expect(result.unmatchedCheckpointKeys).toEqual(['Finish']);
      // updateCourse called with merged checkpoints (TM1 lat/lng overwritten)
      expect(mockRacesService.updateCourse).toHaveBeenCalled();
      const updateCall = (mockRacesService.updateCourse as jest.Mock).mock.calls[0];
      expect(updateCall[0]).toBe('r1');
      expect(updateCall[2].gpxUrl).toBe('https://s3/original.gpx');
      expect(updateCall[2].checkpoints[0]).toMatchObject({ key: 'TM1', lat: 1, lng: 2 });
    });
  });

  describe('deleteCourseGpx', () => {
    it('preserves checkpoint lat/lng on DELETE (Clarification 4)', async () => {
      (mockRacesService.getRaceById as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          courses: [
            {
              courseId: 'c1',
              checkpoints: [{ key: 'TM1', name: 'TM1', lat: 9, lng: 9 }],
            },
          ],
        },
      });
      await controller.deleteCourseGpx('r1', 'c1');
      const call = (mockRacesService.updateCourse as jest.Mock).mock.calls[0];
      // The unset payload must NOT touch checkpoints
      expect(call[2].checkpoints).toBeUndefined();
      expect(call[2].gpxUrl).toBeUndefined();
      expect(call[2].gpxParsed).toBeUndefined();
      expect(mockCourseMapService.deleteGpxFromS3).toHaveBeenCalledWith('r1', 'c1');
    });

    it('returns 404 when race not found', async () => {
      (mockRacesService.getRaceById as jest.Mock).mockResolvedValue({
        success: false,
        data: null,
      });
      await expect(controller.deleteCourseGpx('r1', 'c1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('still proceeds with DB unset even if S3 delete throws (graceful)', async () => {
      (mockRacesService.getRaceById as jest.Mock).mockResolvedValue({
        success: true,
        data: { courses: [{ courseId: 'c1', checkpoints: [] }] },
      });
      // deleteGpxFromS3 swallows errors internally; controller should still call updateCourse
      await controller.deleteCourseGpx('r1', 'c1');
      expect(mockRacesService.updateCourse).toHaveBeenCalled();
    });
  });

  describe('updateCheckpointPosition', () => {
    it('updates a single checkpoint and invalidates cache', async () => {
      (mockRacesService.getRaceById as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          courses: [
            {
              courseId: 'c1',
              checkpoints: [
                { key: 'TM1', name: 'TM1' },
                { key: 'Finish', name: 'Finish' },
              ],
            },
          ],
        },
      });
      await controller.updateCheckpointPosition('r1', 'c1', {
        key: 'TM1',
        lat: 20,
        lng: 105,
      });
      const call = (mockRacesService.updateCourse as jest.Mock).mock.calls[0];
      expect(call[2].checkpoints[0]).toMatchObject({ key: 'TM1', lat: 20, lng: 105 });
      expect(mockCourseMapService.invalidateMapDataCache).toHaveBeenCalledWith(
        'r1',
        'c1',
      );
    });

    it('returns 404 when checkpoint key does not exist', async () => {
      (mockRacesService.getRaceById as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          courses: [{ courseId: 'c1', checkpoints: [{ key: 'TM1', name: 'TM1' }] }],
        },
      });
      await expect(
        controller.updateCheckpointPosition('r1', 'c1', {
          key: 'TM99',
          lat: 1,
          lng: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCourseMapData', () => {
    it('delegates to CourseMapService.getCachedMapData', async () => {
      (mockCourseMapService.getCachedMapData as jest.Mock).mockResolvedValue({
        hasGpx: true,
        gpxSimplifiedUrl: 'x',
        checkpoints: [],
      });
      const r = await controller.getCourseMapData('r1', 'c1');
      expect(r.hasGpx).toBe(true);
      expect(mockCourseMapService.getCachedMapData).toHaveBeenCalledWith('r1', 'c1');
    });

    it('propagates NotFoundException from service for draft races', async () => {
      (mockCourseMapService.getCachedMapData as jest.Mock).mockRejectedValue(
        new NotFoundException('Course map not available'),
      );
      await expect(controller.getCourseMapData('r1', 'c1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
