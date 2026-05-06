import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { CourseMapService } from './course-map.service';
import { Race } from '../schemas/race.schema';

// ─── Test fixtures ──────────────────────────────────────────────────

const buildSimpleGpx = (waypoints: { name: string; lat: number; lng: number }[] = []) => {
  const wpts = waypoints
    .map(
      (w) =>
        `<wpt lat="${w.lat}" lon="${w.lng}"><name>${w.name}</name></wpt>`,
    )
    .join('');
  // 4-point track at ~Hanoi area, with elevations gain ~25m, loss ~5m
  return `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  ${wpts}
  <trk><trkseg>
    <trkpt lat="20.9000" lon="105.8000"><ele>10</ele></trkpt>
    <trkpt lat="20.9100" lon="105.8100"><ele>20</ele></trkpt>
    <trkpt lat="20.9200" lon="105.8200"><ele>35</ele></trkpt>
    <trkpt lat="20.9300" lon="105.8300"><ele>30</ele></trkpt>
  </trkseg></trk>
</gpx>`;
};

const buildKml = () => `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Track</name><LineString><coordinates>
    105.8000,20.9000,10
    105.8100,20.9100,20
    105.8200,20.9200,35
    105.8300,20.9300,30
  </coordinates></LineString></Placemark>
</Document></kml>`;

const buildLargeGpx = (n: number) => {
  const points: string[] = [];
  for (let i = 0; i < n; i++) {
    // Walk slightly to make distance non-zero
    const lat = 20 + (i / n) * 0.5;
    const lng = 105 + (i / n) * 0.5;
    points.push(`<trkpt lat="${lat}" lon="${lng}"><ele>${10 + i * 0.001}</ele></trkpt>`);
  }
  return `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>${points.join('')}</trkseg></trk>
</gpx>`;
};

const buildGpxNoElevation = () => `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="20.9000" lon="105.8000"></trkpt>
    <trkpt lat="20.9100" lon="105.8100"></trkpt>
    <trkpt lat="20.9200" lon="105.8200"></trkpt>
  </trkseg></trk>
</gpx>`;

const buildGpxNoiseElevation = () => `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="20.9000" lon="105.8000"><ele>100.0</ele></trkpt>
    <trkpt lat="20.9100" lon="105.8100"><ele>100.2</ele></trkpt>
    <trkpt lat="20.9200" lon="105.8200"><ele>100.1</ele></trkpt>
    <trkpt lat="20.9300" lon="105.8300"><ele>100.3</ele></trkpt>
  </trkseg></trk>
</gpx>`;

const buildOutOfBoundsGpx = () => `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="200" lon="500"><ele>10</ele></trkpt>
    <trkpt lat="91" lon="-181"><ele>20</ele></trkpt>
  </trkseg></trk>
</gpx>`;

// ─── Suite ──────────────────────────────────────────────────────────

describe('CourseMapService', () => {
  let service: CourseMapService;
  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    exists: jest.Mock;
  };
  let mockModel: { findById: jest.Mock };
  let s3SendSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
    };
    mockModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({ exec: jest.fn() }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseMapService,
        { provide: getModelToken(Race.name), useValue: mockModel },
        { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<CourseMapService>(CourseMapService);

    // Spy on every S3Client.send so PutObject + DeleteObject are no-ops.
    // Cast through unknown to satisfy TS — we don't care about return type
    // shape inside tests, only that send was invoked with the expected
    // command class.
    s3SendSpy = jest
      .spyOn(S3Client.prototype, 'send')
      .mockImplementation(async () => ({}) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── parseGpxOrKml ────────────────────────────────────────────────

  describe('parseGpxOrKml', () => {
    it('parses a simple GPX (4 track points) → valid GpxParsedDto', async () => {
      const result = await service.parseGpxOrKml(
        Buffer.from(buildSimpleGpx()),
        'sample.gpx',
      );
      expect(result.gpxParsed.trackPoints).toBe(4);
      expect(result.gpxParsed.simplifiedPoints).toBeGreaterThan(0);
      expect(result.gpxParsed.simplifiedPoints).toBeLessThanOrEqual(4);
      expect(result.gpxParsed.totalDistanceKm).toBeGreaterThan(0);
      expect(result.gpxParsed.bounds.north).toBeCloseTo(20.93, 2);
      expect(result.gpxParsed.bounds.south).toBeCloseTo(20.9, 2);
    });

    it('parses a KML file', async () => {
      const result = await service.parseGpxOrKml(
        Buffer.from(buildKml()),
        'route.kml',
      );
      expect(result.gpxParsed.trackPoints).toBe(4);
      expect(result.gpxParsed.totalDistanceKm).toBeGreaterThan(0);
    });

    it('throws BadRequestException for malformed XML', async () => {
      await expect(
        service.parseGpxOrKml(Buffer.from('<not xml>'), 'broken.gpx'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for unsupported extension', async () => {
      await expect(
        service.parseGpxOrKml(Buffer.from('hello'), 'route.pdf'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when coordinates are outside WGS84 bounds (BR-CM-03)', async () => {
      await expect(
        service.parseGpxOrKml(Buffer.from(buildOutOfBoundsGpx()), 'oob.gpx'),
      ).rejects.toThrow(/toạ độ không hợp lệ/);
    });

    it('simplifies a 50K-point GPX down to ≤ 5000 points (BR-CM-02)', async () => {
      const result = await service.parseGpxOrKml(
        Buffer.from(buildLargeGpx(50000)),
        'huge.gpx',
      );
      expect(result.gpxParsed.trackPoints).toBe(50000);
      expect(result.gpxParsed.simplifiedPoints).toBeLessThanOrEqual(5000);
    });

    it('returns null elevation fields when no <ele> tag (BR-CM-06)', async () => {
      const result = await service.parseGpxOrKml(
        Buffer.from(buildGpxNoElevation()),
        'flat.gpx',
      );
      expect(result.gpxParsed.elevationGain).toBeNull();
      expect(result.gpxParsed.elevationLoss).toBeNull();
      expect(result.gpxParsed.maxElevation).toBeNull();
      expect(result.gpxParsed.minElevation).toBeNull();
    });

    it('filters elevation noise < 0.5m (BR-CM-06)', async () => {
      const result = await service.parseGpxOrKml(
        Buffer.from(buildGpxNoiseElevation()),
        'noisy.gpx',
      );
      // All deltas are below 0.5m → gain/loss should be 0
      expect(result.gpxParsed.elevationGain).toBe(0);
      expect(result.gpxParsed.elevationLoss).toBe(0);
    });

    it('extracts waypoints with names', async () => {
      const result = await service.parseGpxOrKml(
        Buffer.from(
          buildSimpleGpx([
            { name: 'TM1', lat: 20.91, lng: 105.81 },
            { name: 'Finish', lat: 20.93, lng: 105.83 },
          ]),
        ),
        'with-wpts.gpx',
      );
      expect(result.waypoints).toHaveLength(2);
      expect(result.waypoints[0].name).toBe('TM1');
      expect(result.waypoints[1].name).toBe('Finish');
    });
  });

  // ─── matchWaypoints ──────────────────────────────────────────────

  describe('matchWaypoints', () => {
    it('L1 exact match — case-sensitive equality', () => {
      const r = service.matchWaypoints(
        [{ name: 'TM1', lat: 1, lng: 2 }],
        [{ key: 'TM1' }],
      );
      expect(r.matched).toHaveLength(1);
      expect(r.matched[0].matchType).toBe('exact');
      expect(r.matched[0].lat).toBe(1);
      expect(r.unmatchedKeys).toHaveLength(0);
    });

    it('L2 case-insensitive match — flagged as case-insensitive', () => {
      const r = service.matchWaypoints(
        [{ name: 'tm1', lat: 1, lng: 2 }],
        [{ key: 'TM1' }],
      );
      expect(r.matched).toHaveLength(1);
      expect(r.matched[0].matchType).toBe('case-insensitive');
      expect(r.unmatchedKeys).toHaveLength(0);
    });

    it('L3 no-match — checkpoint key listed in unmatchedKeys', () => {
      const r = service.matchWaypoints(
        [{ name: 'START_LINE', lat: 1, lng: 2 }],
        [{ key: 'Start' }],
      );
      expect(r.matched).toHaveLength(0);
      expect(r.unmatchedKeys).toEqual(['Start']);
    });

    it('CRITICAL false-positive guard: TM10 must NOT match TM1 (no substring fuzzy)', () => {
      const r = service.matchWaypoints(
        [{ name: 'TM10', lat: 1, lng: 2 }],
        [{ key: 'TM1' }],
      );
      expect(r.matched).toHaveLength(0);
      expect(r.unmatchedKeys).toEqual(['TM1']);
    });

    it('mixed: 1 exact + 1 ci + 1 unmatched', () => {
      const r = service.matchWaypoints(
        [
          { name: 'TM1', lat: 1, lng: 2 },
          { name: 'finish', lat: 3, lng: 4 },
          { name: 'random', lat: 5, lng: 6 },
        ],
        [{ key: 'TM1' }, { key: 'Finish' }, { key: 'TM2' }],
      );
      expect(r.matched.find((m) => m.key === 'TM1')?.matchType).toBe('exact');
      expect(r.matched.find((m) => m.key === 'Finish')?.matchType).toBe(
        'case-insensitive',
      );
      expect(r.unmatchedKeys).toEqual(['TM2']);
    });
  });

  // ─── uploadGpxToS3 ───────────────────────────────────────────────

  describe('uploadGpxToS3', () => {
    it('deletes old keys before uploading new ones (BR-CM-01 replace)', async () => {
      const result = await service.uploadGpxToS3(
        'race1',
        'course1',
        Buffer.from('<gpx />'),
        { type: 'Feature' },
        'route.gpx',
      );

      const calls = s3SendSpy.mock.calls.map((c) => c[0]);
      const deletes = calls.filter((c) => c instanceof DeleteObjectCommand);
      const puts = calls.filter((c) => c instanceof PutObjectCommand);
      // 3 deletes (original.gpx + alt original.kml + simplified.geojson) + 2 puts
      expect(deletes.length).toBe(3);
      expect(puts.length).toBe(2);
      expect(result.gpxUrl).toContain('original.gpx');
      expect(result.gpxSimplifiedUrl).toContain('simplified.geojson');
    });

    it('uses .kml extension when filename ends with .kml', async () => {
      const result = await service.uploadGpxToS3(
        'race1',
        'course1',
        Buffer.from('<kml />'),
        { type: 'Feature' },
        'route.kml',
      );
      expect(result.gpxUrl).toContain('original.kml');
    });
  });

  // ─── getCachedMapData (anti-stampede + visibility) ───────────────

  describe('getCachedMapData', () => {
    const baseRace = (status = 'pre_race') => ({
      _id: 'race1',
      status,
      courses: [
        {
          courseId: 'c1',
          checkpoints: [{ key: 'Start', name: 'Start' }],
          gpxSimplifiedUrl: 'https://s3/simplified.geojson',
          gpxParsed: {
            trackPoints: 100,
            simplifiedPoints: 50,
            totalDistanceKm: 5,
            elevationGain: 100,
            elevationLoss: 100,
            maxElevation: 200,
            minElevation: 100,
            bounds: { north: 21, south: 20, east: 106, west: 105 },
          },
        },
      ],
    });

    it('returns NotFoundException for draft race (BR-CM-07)', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockModel.findById.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(baseRace('draft')) }),
      });

      await expect(service.getCachedMapData('race1', 'c1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns hasGpx=false for pre_race race with no GPX (Concern 1)', async () => {
      const race = baseRace('pre_race');
      delete (race.courses[0] as { gpxSimplifiedUrl?: string }).gpxSimplifiedUrl;
      delete (race.courses[0] as { gpxParsed?: unknown }).gpxParsed;
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockModel.findById.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(race) }),
      });

      const r = await service.getCachedMapData('race1', 'c1');
      expect(r.hasGpx).toBe(false);
      expect(r.checkpoints).toHaveLength(1);
      expect(r.gpxSimplifiedUrl).toBeUndefined();
    });

    it('returns full payload for pre_race race with GPX', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockModel.findById.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(baseRace('pre_race')) }),
      });

      const r = await service.getCachedMapData('race1', 'c1');
      expect(r.hasGpx).toBe(true);
      expect(r.gpxSimplifiedUrl).toBe('https://s3/simplified.geojson');
      expect(r.bounds?.north).toBe(21);
    });

    it('serves cached payload on hit without querying Mongo', async () => {
      const cached = {
        hasGpx: true,
        gpxSimplifiedUrl: 'cached',
        checkpoints: [],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const r = await service.getCachedMapData('race1', 'c1');
      expect(r.gpxSimplifiedUrl).toBe('cached');
      expect(mockModel.findById).not.toHaveBeenCalled();
    });

    it('anti-stampede: only one concurrent miss computes; the rest read cache', async () => {
      // Lock acquisition: first SETNX returns OK, the rest return null.
      mockRedis.get
        .mockResolvedValueOnce(null) // miss A
        .mockResolvedValueOnce(null) // miss B initial
        .mockResolvedValueOnce(null) // miss C initial
        .mockResolvedValue(JSON.stringify({ hasGpx: true, checkpoints: [] }));
      mockRedis.set
        .mockImplementationOnce(async (_key, _val, _ex, _ttl, _nx) => 'OK') // A wins lock
        .mockImplementationOnce(async () => null) // B fails lock
        .mockImplementationOnce(async () => null) // C fails lock
        .mockResolvedValue('OK');
      mockRedis.exists.mockResolvedValue(1);

      mockModel.findById.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(baseRace('pre_race')) }),
      });

      const results = await Promise.all([
        service.getCachedMapData('race1', 'c1'),
        service.getCachedMapData('race1', 'c1'),
        service.getCachedMapData('race1', 'c1'),
      ]);
      expect(results).toHaveLength(3);
      // Only one of them should have done findById (the lock winner).
      expect(mockModel.findById).toHaveBeenCalledTimes(1);
    });
  });

  // ─── invalidateMapDataCache ──────────────────────────────────────

  describe('invalidateMapDataCache', () => {
    it('DEL the master:course-map: key', async () => {
      mockRedis.del.mockResolvedValue(1);
      await service.invalidateMapDataCache('race1', 'c1');
      expect(mockRedis.del).toHaveBeenCalledWith('master:course-map:race1:c1');
    });

    it('swallows Redis errors (non-fatal)', async () => {
      mockRedis.del.mockRejectedValue(new Error('redis down'));
      await expect(
        service.invalidateMapDataCache('race1', 'c1'),
      ).resolves.toBeUndefined();
    });
  });
});
