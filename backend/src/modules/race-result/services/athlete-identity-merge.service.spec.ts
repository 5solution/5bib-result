/**
 * FEATURE-047 RESUME — AthleteIdentityMergeService unit tests (cluster-based).
 *
 * Algorithm under test:
 *   1. resolveBySlug(bib + nameSlug) → anchor lookup in race_results
 *   2. Cluster lookup (Path A mongoRaceId+mongoBib OR Path B nameSlug)
 *   3. Bridge mysql_race_id → mongo race._id (when mongoRaceId null)
 *   4. Join race_results → return CanonicalIdentity
 *
 * Test cases:
 *   - TC-47R-01: Cluster found via Path A (mongoRaceId+mongoBib) → return all linked races
 *   - TC-47R-02: Cluster found via Path B (nameSlug only, mongoRaceId null) → bridge via mysql_race_id
 *   - TC-47R-03: No cluster found → anchor-only fallback (Phase 1A behavior)
 *   - TC-47R-04: T3 review_pending cluster → tier='uncertain'
 *   - TC-47R-05: Cluster with broken mysql_race_id → graceful skip (Logger.warn)
 *   - TC-47R-06: Empty linkedAthleteRecords → return empty identity (still surfaces clusterId)
 *
 * Plus PII defense regression suite (hashEmail) carried over from v1.
 *
 * NGUYỄN BÌNH MINH 23-race scenario verified via TC-47R-01 fixture.
 */

import { AthleteIdentityMergeService } from './athlete-identity-merge.service';

interface MockRedis {
  get: jest.Mock;
  set: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
}

function makeMockRedis(): MockRedis {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
}

/** Chained .find().select().lean().exec() mock for resultModel + raceModel. */
function makeQueryChain(data: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(data),
      }),
    }),
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(data),
    }),
  };
}

/** Chained .findOne().lean().exec() mock for clusterModel. */
function makeFindOneChain(data: unknown) {
  return {
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(data),
    }),
  };
}

describe('AthleteIdentityMergeService (FEATURE-047 RESUME — cluster-based)', () => {
  let service: AthleteIdentityMergeService;
  let redis: MockRedis;
  let resultModel: { find: jest.Mock };
  let clusterModel: { findOne: jest.Mock };
  let raceModel: { find: jest.Mock };
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    redis = makeMockRedis();
    resultModel = { find: jest.fn() };
    clusterModel = { findOne: jest.fn() };
    raceModel = { find: jest.fn() };

    /* eslint-disable @typescript-eslint/no-explicit-any */
    service = new AthleteIdentityMergeService(
      resultModel as any,
      clusterModel as any,
      raceModel as any,
      redis as any,
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */

    loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  // ─── PII defense (carry-over from v1) ──────────────────────────────────

  describe('hashEmail() — Adjustment #10 PII defense', () => {
    it('SHA256 deterministic — same email → same hash', () => {
      const h1 = service.hashEmail('athlete@example.com');
      const h2 = service.hashEmail('athlete@example.com');
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });

    it('case-insensitive + trim', () => {
      expect(service.hashEmail('  Athlete@Example.com  ')).toBe(
        service.hashEmail('athlete@example.com'),
      );
    });

    it('different emails → different hashes', () => {
      expect(service.hashEmail('a@example.com')).not.toBe(
        service.hashEmail('b@example.com'),
      );
    });
  });

  // ─── TC-47R-01 ─────────────────────────────────────────────────────────

  it('TC-47R-01: Cluster found via Path A (mongoRaceId+mongoBib) → returns all linked races (NGUYỄN BÌNH MINH 23-race scenario)', async () => {
    // Anchor lookup — 1 row matches (bib=9897 + nameSlug=nguyen-binh-minh)
    resultModel.find.mockReturnValueOnce(
      makeQueryChain([
        {
          _id: { toString: () => 'rr-anchor-1' },
          raceId: 'race-mongo-1',
          bib: '9897',
          name: 'Nguyễn Bình Minh',
        },
      ]),
    );

    // Cluster lookup — Path A hit, 23 linked records with mongoRaceId set
    const linkedRecords = Array.from({ length: 23 }, (_, i) => ({
      mysql_race_id: 100 + i,
      athletes_id: 1000 + i,
      bib_number: i === 0 ? '9897' : String(6800 + i),
      mongoRaceId: `race-mongo-${i + 1}`,
      mongoBib: i === 0 ? '9897' : String(6800 + i),
      fullName: 'Nguyễn Bình Minh',
    }));
    clusterModel.findOne.mockReturnValueOnce(
      makeFindOneChain({
        clusterId: 'cluster-nbm',
        emailHash: 'hash-nbm',
        nameSlug: 'nguyen-binh-minh',
        source: 'email',
        confidence: 1.0,
        linkedAthleteRecords: linkedRecords,
      }),
    );

    // race_results.find( $or pairs ) — returns 23 race results
    resultModel.find.mockReturnValueOnce(
      makeQueryChain(
        linkedRecords.map((r, i) => ({
          _id: { toString: () => `rr-${i}` },
          raceId: r.mongoRaceId,
          bib: r.mongoBib,
        })),
      ),
    );

    const identity = await service.resolveBySlug({
      bib: '9897',
      nameSlug: 'nguyen-binh-minh',
    });

    expect(identity).not.toBeNull();
    expect(identity!.clusterId).toBe('cluster-nbm');
    expect(identity!.tier).toBe('high'); // source='email'
    expect(identity!.source).toBe('email');
    expect(identity!.confidence).toBe(1.0);
    expect(identity!.linkedRaceIds.length).toBe(23);
    expect(identity!.linkedRaceResultIds.length).toBe(23);
    expect(identity!.linkedBibs).toContain('9897');
    // Path A means race bridge was NOT called
    expect(raceModel.find).not.toHaveBeenCalled();
  });

  // ─── TC-47R-02 ─────────────────────────────────────────────────────────

  it('TC-47R-02: Cluster has linked records with mongoRaceId null → bridge via mysql_race_id → races collection', async () => {
    resultModel.find.mockReturnValueOnce(
      makeQueryChain([
        {
          _id: { toString: () => 'rr-anchor' },
          raceId: 'race-mongo-A',
          bib: '2095',
          name: 'Truong Van Quan',
        },
      ]),
    );

    // Cluster — mongoRaceId all null, mysql_race_id populated
    clusterModel.findOne.mockReturnValueOnce(
      makeFindOneChain({
        clusterId: 'cluster-tvq',
        emailHash: null,
        nameSlug: 'truong-van-quan',
        source: 'name+dob',
        confidence: 0.85,
        linkedAthleteRecords: [
          {
            mysql_race_id: 192,
            athletes_id: 5000,
            bib_number: '2095',
            mongoRaceId: null,
            mongoBib: '2095',
            fullName: 'Truong Van Quan',
          },
          {
            mysql_race_id: 193,
            athletes_id: 5001,
            bib_number: '3030',
            mongoRaceId: null,
            mongoBib: '3030',
            fullName: 'Truong Van Quan',
          },
        ],
      }),
    );

    // Bridge — races.find({ mysql_race_id: $in: [192, 193] })
    raceModel.find.mockReturnValueOnce(
      makeQueryChain([
        { _id: { toString: () => 'race-mongo-A' }, mysql_race_id: 192 },
        { _id: { toString: () => 'race-mongo-B' }, mysql_race_id: 193 },
      ]),
    );

    // Final race_results.find($or pairs)
    resultModel.find.mockReturnValueOnce(
      makeQueryChain([
        {
          _id: { toString: () => 'rr-1' },
          raceId: 'race-mongo-A',
          bib: '2095',
        },
        {
          _id: { toString: () => 'rr-2' },
          raceId: 'race-mongo-B',
          bib: '3030',
        },
      ]),
    );

    const identity = await service.resolveBySlug({
      bib: '2095',
      nameSlug: 'truong-van-quan',
    });

    expect(identity).not.toBeNull();
    expect(identity!.clusterId).toBe('cluster-tvq');
    expect(identity!.tier).toBe('medium'); // source='name+dob'
    expect(identity!.linkedRaceIds).toEqual(
      expect.arrayContaining(['race-mongo-A', 'race-mongo-B']),
    );
    expect(raceModel.find).toHaveBeenCalledTimes(1);
  });

  // ─── TC-47R-03 ─────────────────────────────────────────────────────────

  it('TC-47R-03: No cluster found → anchor-only fallback (Phase 1A coincidence match behavior)', async () => {
    resultModel.find.mockReturnValueOnce(
      makeQueryChain([
        {
          _id: { toString: () => 'rr-anchor-x' },
          raceId: 'race-mongo-X',
          bib: '7777',
          name: 'Solo Runner',
        },
      ]),
    );

    // Path A miss
    clusterModel.findOne.mockReturnValueOnce(makeFindOneChain(null));
    // Path B miss
    clusterModel.findOne.mockReturnValueOnce(makeFindOneChain(null));

    const identity = await service.resolveBySlug({
      bib: '7777',
      nameSlug: 'solo-runner',
    });

    expect(identity).not.toBeNull();
    expect(identity!.clusterId).toBeNull();
    expect(identity!.tier).toBe('anchor_only');
    expect(identity!.source).toBeNull();
    expect(identity!.confidence).toBeNull();
    expect(identity!.linkedRaceIds).toEqual(['race-mongo-X']);
    expect(identity!.linkedBibs).toContain('7777');
    expect(clusterModel.findOne).toHaveBeenCalledTimes(2); // Path A + Path B
  });

  // ─── TC-47R-04 ─────────────────────────────────────────────────────────

  it('TC-47R-04: T3 review_pending cluster → tier=uncertain', async () => {
    resultModel.find.mockReturnValueOnce(
      makeQueryChain([
        {
          _id: { toString: () => 'rr-anchor-t3' },
          raceId: 'race-mongo-T3',
          bib: '111',
          name: 'Le Thi B',
        },
      ]),
    );

    clusterModel.findOne.mockReturnValueOnce(
      makeFindOneChain({
        clusterId: 'cluster-t3',
        emailHash: null,
        nameSlug: 'le-thi-b',
        source: 'review_pending',
        confidence: 0.6,
        linkedAthleteRecords: [
          {
            mysql_race_id: 200,
            athletes_id: 9000,
            bib_number: '111',
            mongoRaceId: 'race-mongo-T3',
            mongoBib: '111',
            fullName: 'Le Thi B',
          },
        ],
      }),
    );

    resultModel.find.mockReturnValueOnce(
      makeQueryChain([
        {
          _id: { toString: () => 'rr-t3' },
          raceId: 'race-mongo-T3',
          bib: '111',
        },
      ]),
    );

    const identity = await service.resolveBySlug({
      bib: '111',
      nameSlug: 'le-thi-b',
    });

    expect(identity).not.toBeNull();
    expect(identity!.tier).toBe('uncertain');
    expect(identity!.source).toBe('review_pending');
    expect(identity!.confidence).toBe(0.6);
    expect(identity!.clusterId).toBe('cluster-t3');
  });

  // ─── TC-47R-05 ─────────────────────────────────────────────────────────

  it('TC-47R-05: Cluster has linkedRecord with mysql_race_id NOT in races collection → graceful skip with Logger.warn', async () => {
    resultModel.find.mockReturnValueOnce(
      makeQueryChain([
        {
          _id: { toString: () => 'rr-anchor-orphan' },
          raceId: 'race-mongo-OK',
          bib: '555',
          name: 'Orphan Race',
        },
      ]),
    );

    clusterModel.findOne.mockReturnValueOnce(
      makeFindOneChain({
        clusterId: 'cluster-orphan',
        emailHash: 'hash-orphan',
        nameSlug: 'orphan-race',
        source: 'email',
        confidence: 1.0,
        linkedAthleteRecords: [
          {
            mysql_race_id: 1, // valid → bridges
            athletes_id: 100,
            bib_number: '555',
            mongoRaceId: null,
            mongoBib: '555',
            fullName: 'Orphan Race',
          },
          {
            mysql_race_id: 99999, // NOT in races → orphan
            athletes_id: 101,
            bib_number: '777',
            mongoRaceId: null,
            mongoBib: '777',
            fullName: 'Orphan Race',
          },
        ],
      }),
    );

    raceModel.find.mockReturnValueOnce(
      makeQueryChain([
        { _id: { toString: () => 'race-mongo-OK' }, mysql_race_id: 1 },
        // mysql_race_id=99999 absent — bridge cannot resolve
      ]),
    );

    resultModel.find.mockReturnValueOnce(
      makeQueryChain([
        {
          _id: { toString: () => 'rr-good' },
          raceId: 'race-mongo-OK',
          bib: '555',
        },
      ]),
    );

    const identity = await service.resolveBySlug({
      bib: '555',
      nameSlug: 'orphan-race',
    });

    expect(identity).not.toBeNull();
    expect(identity!.linkedRaceIds).toEqual(['race-mongo-OK']);
    // Logger warn should have flagged the orphan
    const allWarns = loggerWarnSpy.mock.calls.flat().join(' ');
    expect(allWarns).toContain('99999');
    expect(allWarns).toContain('cluster-orphan');
  });

  // ─── TC-47R-06 ─────────────────────────────────────────────────────────

  it('TC-47R-06: Cluster with empty linkedAthleteRecords → returns identity with empty arrays + clusterId set', async () => {
    resultModel.find.mockReturnValueOnce(
      makeQueryChain([
        {
          _id: { toString: () => 'rr-anchor-empty' },
          raceId: 'race-mongo-E',
          bib: '999',
          name: 'Edge Case',
        },
      ]),
    );

    clusterModel.findOne.mockReturnValueOnce(
      makeFindOneChain({
        clusterId: 'cluster-empty',
        emailHash: 'hash-empty',
        nameSlug: 'edge-case',
        source: 'email',
        confidence: 1.0,
        linkedAthleteRecords: [],
      }),
    );

    const identity = await service.resolveBySlug({
      bib: '999',
      nameSlug: 'edge-case',
    });

    expect(identity).not.toBeNull();
    expect(identity!.clusterId).toBe('cluster-empty');
    expect(identity!.linkedRaceIds).toEqual([]);
    expect(identity!.linkedRaceResultIds).toEqual([]);
    expect(identity!.linkedBibs).toEqual([]);
    expect(identity!.tier).toBe('high'); // source='email' wins
    // race_results.find for $or should NOT have been called (pairs empty)
    expect(resultModel.find).toHaveBeenCalledTimes(1); // only anchor lookup
  });

  // ─── resolveByEmail (backward-compat shim) ────────────────────────────

  describe('resolveByEmail() — legacy backfill cron shim', () => {
    it('returns null for empty/null/whitespace email', async () => {
      expect(await service.resolveByEmail(null)).toBeNull();
      expect(await service.resolveByEmail(undefined)).toBeNull();
      expect(await service.resolveByEmail('')).toBeNull();
      expect(await service.resolveByEmail('   ')).toBeNull();
    });

    it('returns null when no cluster matches emailHash', async () => {
      clusterModel.findOne.mockReturnValueOnce(makeFindOneChain(null));
      const out = await service.resolveByEmail('unknown@example.com');
      expect(out).toBeNull();
    });

    it('builds identity from cluster when emailHash matches', async () => {
      clusterModel.findOne.mockReturnValueOnce(
        makeFindOneChain({
          clusterId: 'cluster-by-email',
          emailHash: service.hashEmail('hit@example.com'),
          nameSlug: 'hit-user',
          source: 'email',
          confidence: 1.0,
          linkedAthleteRecords: [
            {
              mysql_race_id: 50,
              athletes_id: 200,
              bib_number: '1234',
              mongoRaceId: 'race-A',
              mongoBib: '1234',
              fullName: 'Hit User',
            },
          ],
        }),
      );
      resultModel.find.mockReturnValueOnce(
        makeQueryChain([
          {
            _id: { toString: () => 'rr-hit' },
            raceId: 'race-A',
            bib: '1234',
          },
        ]),
      );

      const out = await service.resolveByEmail('hit@example.com');
      expect(out).not.toBeNull();
      expect(out!.clusterId).toBe('cluster-by-email');
      expect(out!.linkedBibs).toContain('1234');
    });

    it('raw email NEVER logged on failure path — PII defense', async () => {
      // Force findOne to throw via .exec()
      clusterModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error('mongo down')),
        }),
      });

      await service.resolveByEmail('secret@example.com');

      const allLogArgs = loggerWarnSpy.mock.calls.flat().join(' ');
      expect(allLogArgs).not.toContain('secret@example.com');
      expect(allLogArgs).not.toContain('@');
      expect(allLogArgs).toContain('emailHash:');
    });
  });

  // ─── 404 path ──────────────────────────────────────────────────────────

  it('resolveBySlug returns null when no anchor race_result matches slug', async () => {
    resultModel.find.mockReturnValueOnce(makeQueryChain([]));
    const out = await service.resolveBySlug({
      bib: '404',
      nameSlug: 'not-found',
    });
    expect(out).toBeNull();
  });

  it('resolveBySlug returns null when bib or nameSlug empty', async () => {
    expect(await service.resolveBySlug({ bib: '', nameSlug: 'x' })).toBeNull();
    expect(
      await service.resolveBySlug({ bib: '123', nameSlug: '' }),
    ).toBeNull();
  });

  describe('invalidateIdentityCache()', () => {
    it('DELs cache key by emailHash', async () => {
      await service.invalidateIdentityCache('abc123def456');
      expect(redis.del).toHaveBeenCalledWith('athlete:identity:abc123def456');
    });
  });
});
