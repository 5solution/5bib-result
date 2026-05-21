/**
 * FEATURE-048 Phase 2 — AthleteIdentityClusteringService unit tests.
 *
 * Coverage: 3-tier algorithm + SHA256 PII defense + cluster operations (merge/split).
 */

import { AthleteIdentityClusteringService } from './athlete-identity-clustering.service';

interface MockModel {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  deleteMany: jest.Mock;
  countDocuments: jest.Mock;
}

interface MockRedis {
  mget: jest.Mock;
  setex: jest.Mock;
  get: jest.Mock;
}

function makeMockModel(): MockModel {
  return {
    findOne: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
    create: jest.fn().mockResolvedValue({ _id: 'new-id' }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    countDocuments: jest.fn().mockResolvedValue(0),
  };
}

function makeMockRedis(): MockRedis {
  return {
    mget: jest.fn().mockResolvedValue([]),
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
  };
}

describe('AthleteIdentityClusteringService (FEATURE-048 Phase 2)', () => {
  let service: AthleteIdentityClusteringService;
  let clusterModel: MockModel;
  let athleteModel: MockModel;
  let loggerLogSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    clusterModel = makeMockModel();
    athleteModel = makeMockModel();

    /* eslint-disable @typescript-eslint/no-explicit-any */
    service = new AthleteIdentityClusteringService(
      clusterModel as any,
      athleteModel as any,
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */

    loggerLogSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
    loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
  });

  afterEach(() => {
    loggerLogSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  describe('hashEmail() — Adjustment #10 PII defense', () => {
    it('SHA256 deterministic same email → same hash', () => {
      const h1 = service.hashEmail('athlete@example.com');
      const h2 = service.hashEmail('athlete@example.com');
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });

    it('case-insensitive + trim', () => {
      const h1 = service.hashEmail('  Athlete@EXAMPLE.com  ');
      const h2 = service.hashEmail('athlete@example.com');
      expect(h1).toBe(h2);
    });

    it('different emails → different hashes', () => {
      const h1 = service.hashEmail('a@example.com');
      const h2 = service.hashEmail('b@example.com');
      expect(h1).not.toBe(h2);
    });
  });

  describe('slugifyName() — VN diacritics handling', () => {
    it('lowercases + replaces đ/Đ + strips diacritics + hyphenates', () => {
      expect(service.slugifyName('NGUYỄN BÌNH MINH')).toBe('nguyen-binh-minh');
      expect(service.slugifyName('Đào Thị Hà')).toBe('dao-thi-ha');
      expect(service.slugifyName('  Trương Văn Quân  ')).toBe(
        'truong-van-quan',
      );
    });
  });

  describe('normalizeGender()', () => {
    it('VN nam/nữ + EN male/female + null', () => {
      expect(service.normalizeGender('Nam')).toBe('male');
      expect(service.normalizeGender('NỮ')).toBe('female');
      expect(service.normalizeGender('Male')).toBe('male');
      expect(service.normalizeGender('F')).toBe('female');
      expect(service.normalizeGender(null)).toBeNull();
      expect(service.normalizeGender('Khác')).toBe('other');
    });
  });

  describe('classifyAthlete() — 3-tier algorithm BR-48-12', () => {
    const baseRow = {
      _id: 'fake-id',
      mysql_race_id: 192,
      athletes_id: 1001,
      bib_number: '2095',
      full_name: 'NGUYỄN BÌNH MINH',
      email: null,
      ageOnRaceDay: null,
      gender: null,
      /* eslint-disable @typescript-eslint/no-explicit-any */
    } as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    it('T1 email exact → confidence 1.0 source=email', () => {
      const result = service.classifyAthlete({
        ...baseRow,
        email: 'minh@example.com',
        ageOnRaceDay: 40,
        gender: 'Nam',
      });
      expect(result.tier).toBe('t1_email');
      expect(result.confidence).toBe(1.0);
      expect(result.source).toBe('email');
      expect(result.anchors.emailHash).toHaveLength(64);
      expect(result.anchors.nameSlug).toBe('nguyen-binh-minh');
    });

    it('T2 name+DOB+gender → confidence 0.85', () => {
      const result = service.classifyAthlete({
        ...baseRow,
        email: null,
        ageOnRaceDay: 40,
        gender: 'Nam',
      });
      expect(result.tier).toBe('t2_name_dob_gender');
      expect(result.confidence).toBe(0.85);
      expect(result.source).toBe('name+dob');
      expect(result.anchors.emailHash).toBeUndefined();
      expect(result.anchors.dobYear).toBeGreaterThan(1900);
    });

    it('T3 name+gender only → confidence 0.6 review queue', () => {
      const result = service.classifyAthlete({
        ...baseRow,
        email: null,
        ageOnRaceDay: null,
        gender: 'Nam',
      });
      expect(result.tier).toBe('t3_name_gender');
      expect(result.confidence).toBe(0.6);
      expect(result.source).toBe('review_pending');
      expect(result.anchors.dobYear).toBeUndefined();
    });

    it('T4 anonymous (no anchors) → confidence 0.0', () => {
      const result = service.classifyAthlete({
        ...baseRow,
        email: null,
        ageOnRaceDay: null,
        gender: null,
        full_name: null,
      });
      expect(result.tier).toBe('t4_anonymous');
      expect(result.confidence).toBe(0);
      expect(result.anchors.emailHash).toBeUndefined();
      expect(result.anchors.nameSlug).toBeUndefined();
    });

    it('T1 trumps T2/T3 — email always wins even with full anchors', () => {
      const result = service.classifyAthlete({
        ...baseRow,
        email: 'x@y.com',
        ageOnRaceDay: 30,
        gender: 'Nam',
      });
      expect(result.tier).toBe('t1_email');
    });
  });

  describe('upsertAthleteIntoCluster()', () => {
    const baseRow = {
      _id: 'fake-id',
      mysql_race_id: 192,
      athletes_id: 1001,
      bib_number: '2095',
      full_name: 'NGUYỄN BÌNH MINH',
      email: null,
      ageOnRaceDay: 40,
      gender: 'Nam',
      /* eslint-disable @typescript-eslint/no-explicit-any */
    } as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    it('T4 anonymous creates new cluster (no anchor lookup)', async () => {
      const result = await service.upsertAthleteIntoCluster({
        ...baseRow,
        full_name: null,
        ageOnRaceDay: null,
        gender: null,
      });
      expect(result.created).toBe(true);
      expect(result.tier).toBe('t4_anonymous');
      expect(clusterModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'review_pending',
          confidence: 0.0,
          linkedAthleteRecords: expect.arrayContaining([
            expect.objectContaining({ athletes_id: 1001 }),
          ]),
        }),
      );
    });

    it('T1 creates new cluster when no existing match', async () => {
      clusterModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.upsertAthleteIntoCluster({
        ...baseRow,
        email: 'minh@example.com',
      });
      expect(result.created).toBe(true);
      expect(result.tier).toBe('t1_email');
      expect(clusterModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'email',
          confidence: 1.0,
        }),
      );
    });

    it('T1 appends to existing cluster (idempotent — no dupe linked record)', async () => {
      const existing = {
        clusterId: 'existing-uuid',
        linkedAthleteRecords: [
          {
            mysql_race_id: 192,
            athletes_id: 1001,
            bib_number: 'OLD-BIB',
            fullName: 'OLD NAME',
          },
        ],
        save: jest.fn().mockResolvedValue({}),
      };
      clusterModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existing),
      });

      const result = await service.upsertAthleteIntoCluster({
        ...baseRow,
        email: 'minh@example.com',
      });
      expect(result.created).toBe(false);
      expect(result.clusterId).toBe('existing-uuid');
      expect(existing.linkedAthleteRecords).toHaveLength(1); // not duplicated
      expect(existing.linkedAthleteRecords[0].bib_number).toBe('2095'); // updated
      expect(existing.save).toHaveBeenCalled();
    });

    it('T1 appends NEW linked record when athlete is from different race', async () => {
      const existing = {
        clusterId: 'existing-uuid',
        linkedAthleteRecords: [
          {
            mysql_race_id: 100,
            athletes_id: 999,
            bib_number: '100',
            fullName: 'NBM',
          },
        ],
        save: jest.fn().mockResolvedValue({}),
      };
      clusterModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existing),
      });

      await service.upsertAthleteIntoCluster({
        ...baseRow,
        email: 'minh@example.com',
      });
      expect(existing.linkedAthleteRecords).toHaveLength(2); // new race added
    });

    it('PII email never logged raw — only emailHash proxy', async () => {
      clusterModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await service.upsertAthleteIntoCluster({
        ...baseRow,
        email: 'secret@athlete.com',
      });

      const logCalls = loggerLogSpy.mock.calls.flat().join(' ');
      expect(logCalls).not.toContain('secret@athlete.com');
      expect(logCalls).not.toContain('@'); // no raw email anywhere in log
      expect(logCalls).toContain('emailHash:'); // proxy format used
    });
  });

  describe('mergeClusters()', () => {
    it('merges N clusters into target + dedupes linked records', async () => {
      const target = {
        clusterId: 'target-id',
        linkedAthleteRecords: [
          {
            mysql_race_id: 1,
            athletes_id: 100,
            bib_number: '100',
            fullName: 'A',
          },
        ],
        source: 'name+dob',
        confidence: 0.85,
        save: jest.fn().mockResolvedValue({}),
        moderatedBy: null,
        moderatedAt: null,
      };
      const additional = [
        {
          clusterId: 'extra-1',
          linkedAthleteRecords: [
            {
              mysql_race_id: 2,
              athletes_id: 200,
              bib_number: '200',
              fullName: 'B',
            },
            {
              mysql_race_id: 1,
              athletes_id: 100,
              bib_number: '100',
              fullName: 'A',
            }, // dupe
          ],
        },
      ];

      clusterModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(target),
      });
      clusterModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(additional),
      });

      const result = await service.mergeClusters(
        'target-id',
        ['extra-1'],
        'Same athlete trùng tên',
        'admin-sub-1',
      );

      expect(result.linkedAthleteRecords).toHaveLength(2); // dedupe (was 1 + 2 with dupe)
      expect(result.source).toBe('manual');
      expect(result.moderatedBy).toBe('admin-sub-1');
      expect(target.save).toHaveBeenCalled();
      expect(clusterModel.deleteMany).toHaveBeenCalledWith({
        clusterId: { $in: ['extra-1'] },
      });
    });
  });

  describe('splitCluster()', () => {
    it('extracts athletes_ids to new cluster', async () => {
      const source = {
        clusterId: 'source-id',
        nameSlug: 'nguyen-binh-minh',
        dobYear: 1985,
        genderNormalized: 'male' as const,
        linkedAthleteRecords: [
          {
            mysql_race_id: 1,
            athletes_id: 100,
            bib_number: '100',
            fullName: 'A',
          },
          {
            mysql_race_id: 2,
            athletes_id: 200,
            bib_number: '200',
            fullName: 'B',
          },
          {
            mysql_race_id: 3,
            athletes_id: 300,
            bib_number: '300',
            fullName: 'C',
          },
        ],
        save: jest.fn().mockResolvedValue({}),
        moderatedBy: null,
        moderatedAt: null,
      };
      clusterModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(source),
      });

      const result = await service.splitCluster(
        'source-id',
        [200, 300],
        'Khác người trùng tên',
        'admin-sub-1',
      );

      expect(result.extractedCount).toBe(2);
      expect(result.remainingCount).toBe(1);
      expect(source.linkedAthleteRecords).toHaveLength(1); // only athletes_id=100 remains
      expect(clusterModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          splitFromClusterId: 'source-id',
          source: 'manual',
          linkedAthleteRecords: expect.arrayContaining([
            expect.objectContaining({ athletes_id: 200 }),
            expect.objectContaining({ athletes_id: 300 }),
          ]),
        }),
      );
    });

    it('throws if no extractAthleteIds match', async () => {
      const source = {
        clusterId: 'source-id',
        linkedAthleteRecords: [
          {
            mysql_race_id: 1,
            athletes_id: 100,
            bib_number: '100',
            fullName: 'A',
          },
        ],
        save: jest.fn(),
      };
      clusterModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(source),
      });

      await expect(
        service.splitCluster('source-id', [999], 'wrong id', 'admin-1'),
      ).rejects.toThrow('No athletes_ids matched');
    });
  });

  describe('listClusters() — pagination + filters', () => {
    it('applies source filter + maxConfidence + pagination', async () => {
      clusterModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { clusterId: 'c1', source: 'review_pending', confidence: 0.6 },
          ]),
      });
      clusterModel.countDocuments.mockResolvedValue(1);

      const result = await service.listClusters({
        source: 'review_pending',
        maxConfidence: 0.7,
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(clusterModel.countDocuments).toHaveBeenCalledWith({
        source: 'review_pending',
        confidence: { $lte: 0.7 },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // FEATURE-049 — Identity Cluster Admin UX Humanization
  // raceName + bibNumber enrichment + Redis cache + N+1 prevention
  // ═══════════════════════════════════════════════════════════════════════

  describe('F-049 enrichClustersWithRaceContext()', () => {
    let raceModel: MockModel;
    let redis: MockRedis;
    let serviceWithEnrich: AthleteIdentityClusteringService;
    let enrichLoggerWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      raceModel = makeMockModel();
      redis = makeMockRedis();
      /* eslint-disable @typescript-eslint/no-explicit-any */
      serviceWithEnrich = new AthleteIdentityClusteringService(
        clusterModel as any,
        athleteModel as any,
        raceModel as any,
        redis as any,
      );
      /* eslint-enable @typescript-eslint/no-explicit-any */
      // Spy on enrich-scoped service logger (different instance from outer service)
      enrichLoggerWarnSpy = jest
        .spyOn(serviceWithEnrich['logger'], 'warn')
        .mockImplementation();
    });

    afterEach(() => {
      enrichLoggerWarnSpy.mockRestore();
    });

    /** TC-49-01: happy path — list returns clusters enriched with raceName + bibNumber */
    it('TC-49-01: enriches linked records with raceName + bibNumber from $in lookup', async () => {
      // Mock Redis miss → fallback Mongo
      redis.mget.mockResolvedValue([null]);
      // Race lookup returns title for mysql_race_id=192
      raceModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            mysql_race_id: 192,
            title: 'Vietnam Mountain Marathon Mu Cang Chai 2026',
          },
        ]),
      });
      // Bib lookup returns bib_number for (192, 1001)
      athleteModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { mysql_race_id: 192, athletes_id: 1001, bib_number: '88043' },
          ]),
      });

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const clusters: any[] = [
        {
          clusterId: 'cluster-uuid-1',
          source: 'email',
          confidence: 1.0,
          linkedAthleteRecords: [
            {
              mysql_race_id: 192,
              athletes_id: 1001,
              bib_number: null,
              fullName: 'NGUYỄN BÌNH MINH',
            },
          ],
        },
      ];
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const enriched =
        await serviceWithEnrich.enrichClustersWithRaceContext(clusters);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].linkedAthleteRecords[0].raceName).toBe(
        'Vietnam Mountain Marathon Mu Cang Chai 2026',
      );
      expect(enriched[0].linkedAthleteRecords[0].bibNumber).toBe('88043');
      // Original fields preserved (hand-pick audit safety)
      expect(enriched[0].linkedAthleteRecords[0].fullName).toBe(
        'NGUYỄN BÌNH MINH',
      );
      expect(enriched[0].linkedAthleteRecords[0].mysql_race_id).toBe(192);
      // MUST NOT leak Mongo internals (TC-49-01 negative)
      expect(enriched[0]).not.toHaveProperty('__v');
    });

    /** TC-49-02: detail enrichment — same pattern as list, single cluster */
    it('TC-49-02: getCluster returns enriched single cluster with linked records', async () => {
      redis.mget.mockResolvedValue([null]);
      raceModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ mysql_race_id: 192, title: 'VMM 2026' }]),
      });
      athleteModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { mysql_race_id: 192, athletes_id: 1001, bib_number: '88043' },
          ]),
      });
      clusterModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          clusterId: 'cluster-uuid-2',
          source: 'email',
          confidence: 1.0,
          linkedAthleteRecords: [
            { mysql_race_id: 192, athletes_id: 1001, bib_number: null },
          ],
        }),
      });

      const result = await serviceWithEnrich.getCluster('cluster-uuid-2');

      expect(result).not.toBeNull();
      expect(result?.linkedAthleteRecords[0].raceName).toBe('VMM 2026');
      expect(result?.linkedAthleteRecords[0].bibNumber).toBe('88043');
    });

    /** TC-49-03: race not found (orphan record) → raceName undefined, NO throw */
    it('TC-49-03: gracefully handles orphan record (race not in DB) — raceName undefined, no throw', async () => {
      redis.mget.mockResolvedValue([null]);
      // Race lookup returns empty (orphan)
      raceModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      athleteModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const clusters: any[] = [
        {
          clusterId: 'orphan-cluster',
          source: 'email',
          confidence: 1.0,
          linkedAthleteRecords: [
            { mysql_race_id: 999999, athletes_id: 1001, bib_number: null },
          ],
        },
      ];
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const enriched =
        await serviceWithEnrich.enrichClustersWithRaceContext(clusters);

      expect(enriched[0].linkedAthleteRecords[0].raceName).toBeUndefined();
      expect(enriched[0].linkedAthleteRecords[0].bibNumber).toBeUndefined();
      // Logger.warn called for orphan
      expect(enrichLoggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Race not found for mysql_race_id=999999'),
      );
    });

    /** TC-49-04: Redis cache hit — Mongo race query NOT executed (performance) */
    it('TC-49-04: Redis cache hit — getRaceTitlesByMysqlIds skips MongoDB query', async () => {
      // Pre-seed Redis cache for all 3 race ids
      redis.mget.mockResolvedValue([
        'VMM 2026 Cached',
        'VMM 2025 Cached',
        'VMM 2024 Cached',
      ]);
      // raceModel.find should NOT be called when all cached
      const raceFindExec = jest.fn().mockResolvedValue([]);
      raceModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: raceFindExec,
      });

      const result = await serviceWithEnrich.getRaceTitlesByMysqlIds([
        192, 193, 194,
      ]);

      expect(result.get(192)).toBe('VMM 2026 Cached');
      expect(result.get(193)).toBe('VMM 2025 Cached');
      expect(result.get(194)).toBe('VMM 2024 Cached');
      // CRITICAL: Mongo not hit on full cache hit
      expect(raceFindExec).not.toHaveBeenCalled();
    });

    /** TC-49-05: Redis failure → graceful Mongo fallback (degrade) */
    it('TC-49-05: Redis mget fail → fallback to Mongo $in, no throw', async () => {
      redis.mget.mockRejectedValue(new Error('Redis down'));
      raceModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ mysql_race_id: 192, title: 'VMM Fallback' }]),
      });

      const result = await serviceWithEnrich.getRaceTitlesByMysqlIds([192]);

      expect(result.get(192)).toBe('VMM Fallback');
      expect(enrichLoggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Redis mget fail'),
      );
    });

    /** TC-49-06: empty input → empty result, NO DB calls */
    it('TC-49-06: empty clusters input → returns empty array, no DB calls', async () => {
      const result = await serviceWithEnrich.enrichClustersWithRaceContext([]);
      expect(result).toEqual([]);
      expect(raceModel.find).not.toHaveBeenCalled();
      expect(athleteModel.find).not.toHaveBeenCalled();
    });

    /** TC-49-07: getBibsByCompositeKeys — single $or aggregation grouped by race */
    it('TC-49-07: getBibsByCompositeKeys uses single $or aggregation, grouped by mysql_race_id', async () => {
      const findExec = jest.fn().mockResolvedValue([
        { mysql_race_id: 192, athletes_id: 1001, bib_number: '88043' },
        { mysql_race_id: 192, athletes_id: 1002, bib_number: '88044' },
        { mysql_race_id: 193, athletes_id: 2001, bib_number: '99001' },
      ]);
      athleteModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: findExec,
      });

      const result = await serviceWithEnrich.getBibsByCompositeKeys([
        { mysql_race_id: 192, athletes_id: 1001 },
        { mysql_race_id: 192, athletes_id: 1002 },
        { mysql_race_id: 193, athletes_id: 2001 },
      ]);

      expect(result.get('192:1001')).toBe('88043');
      expect(result.get('192:1002')).toBe('88044');
      expect(result.get('193:2001')).toBe('99001');
      // Single $or query, NOT 3 separate findOne calls (N+1 prevention)
      expect(athleteModel.find).toHaveBeenCalledTimes(1);
      const findCallArg = athleteModel.find.mock.calls[0][0];
      expect(findCallArg).toHaveProperty('$or');
      expect(Array.isArray(findCallArg.$or)).toBe(true);
    });

    /** TC-49-08: N+1 prevention — list with 100 clusters x 5 records uses 1 race find + 1 bib find */
    it('TC-49-08: N+1 prevention — 100 clusters × 5 records = 1 raceModel.find + 1 athleteModel.find', async () => {
      // mget returns N null entries → all uncached → fallback Mongo (1 batched query)
      redis.mget.mockImplementation((...keys: string[]) =>
        Promise.resolve(keys.map(() => null)),
      );
      const raceFindExec = jest.fn().mockResolvedValue([]);
      const bibFindExec = jest.fn().mockResolvedValue([]);
      raceModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: raceFindExec,
      });
      athleteModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: bibFindExec,
      });

      // Build 100 clusters × 5 linked records each
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const clusters: any[] = [];
      for (let i = 0; i < 100; i++) {
        clusters.push({
          clusterId: `cluster-${i}`,
          source: 'email',
          confidence: 1.0,
          linkedAthleteRecords: Array.from({ length: 5 }, (_, j) => ({
            mysql_race_id: 100 + j,
            athletes_id: i * 10 + j,
            bib_number: null,
          })),
        });
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */

      await serviceWithEnrich.enrichClustersWithRaceContext(clusters);

      // CRITICAL: NOT 500 calls, NOT 100 calls — EXACTLY 1 race find + 1 bib find
      expect(raceFindExec).toHaveBeenCalledTimes(1);
      expect(bibFindExec).toHaveBeenCalledTimes(1);
    });

    /** TC-49-09: listClusters source=email filter → enriched response */
    it('TC-49-09: listClusters with source=email filter returns enriched T1 clusters', async () => {
      redis.mget.mockResolvedValue([null]);
      raceModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ mysql_race_id: 192, title: 'VMM 2026' }]),
      });
      athleteModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            { mysql_race_id: 192, athletes_id: 1001, bib_number: '88043' },
          ]),
      });
      clusterModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            clusterId: 'c1',
            source: 'email',
            confidence: 1.0,
            linkedAthleteRecords: [
              { mysql_race_id: 192, athletes_id: 1001, bib_number: null },
            ],
          },
        ]),
      });
      clusterModel.countDocuments.mockResolvedValue(1);

      const result = await serviceWithEnrich.listClusters({ source: 'email' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].source).toBe('email');
      expect(result.items[0].linkedAthleteRecords[0].raceName).toBe('VMM 2026');
      expect(result.items[0].linkedAthleteRecords[0].bibNumber).toBe('88043');
      // MongoDB filter applied
      expect(clusterModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'email' }),
      );
    });

    /** TC-49-10: search by name slug substring — case-insensitive regex */
    it('TC-49-10: listClusters search by nameSlug uses case-insensitive regex', async () => {
      clusterModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      clusterModel.countDocuments.mockResolvedValue(0);
      redis.mget.mockResolvedValue([]);

      await serviceWithEnrich.listClusters({ q: 'daoh' });

      expect(clusterModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          nameSlug: { $regex: 'daoh', $options: 'i' },
        }),
      );
    });
  });

  describe('getCoverageStats()', () => {
    it('returns dashboard data shape', async () => {
      clusterModel.countDocuments
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(65) // t1
        .mockResolvedValueOnce(20) // t2
        .mockResolvedValueOnce(10) // t3
        .mockResolvedValueOnce(5) // t4 anon
        .mockResolvedValueOnce(15); // review queue depth

      clusterModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue({ updatedAt: new Date('2026-05-20') }),
      });

      clusterModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { linkedAthleteRecords: [{}, {}, {}] }, // 3 records
          { linkedAthleteRecords: [{}] }, // 1 record
        ]),
      });

      const stats = await service.getCoverageStats();
      expect(stats.totalClusters).toBe(100);
      expect(stats.byTier.t1_email).toBe(65);
      expect(stats.byTier.t2_name_dob_gender).toBe(20);
      expect(stats.reviewQueueDepth).toBe(15);
      // Mock: totalClusters=100, find() returns 2 docs with 3+1 records
      // Algorithm: avgRacesPerCluster = totalRecords / totalClusters = 4 / 100 = 0.04
      expect(stats.avgRacesPerCluster).toBe(0.04);
      expect(stats.lastClusteringRun).toBeInstanceOf(Date);
    });
  });
});
