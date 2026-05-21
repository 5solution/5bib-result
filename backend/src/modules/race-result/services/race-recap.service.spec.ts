/**
 * FEATURE-046 — RaceRecapService unit tests.
 *
 * Coverage per TC-46-01..20 (Plan + PRD):
 * - getRecap happy path (TC-46-01)
 * - cache hit no MongoDB query (TC-46-02)
 * - 404 for draft / pre_race / live / on-sale (TC-46-03/04)
 * - 404 race ended zero results imported (TC-46-05)
 * - 0 finisher all DNS/DNF (TC-46-06) → 200 with empty arrays
 * - chipTimeSecondsStage parity — short race MM:SS not 60x inflated (TC-46-20)
 * - getPublicInsight published only (TC-46-08)
 * - getPublicInsight no insight (TC-46-09)
 * - upsertInsight create new (TC-46-10)
 * - upsertInsight max 2000 chars rejected at DTO layer (TC-46-11 — validated via class-validator)
 * - upsertInsight version mismatch 409 (TC-46-13)
 * - upsertInsight sanitize <script> (TC-46-14)
 * - upsertInsight concurrent atomic — only 1 succeeds (TC-46-17)
 * - upsertInsight re-publish keeps original publishedAt (Adjustment #5)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { RaceRecapService } from './race-recap.service';
import { RaceResult } from '../schemas/race-result.schema';
import { RaceRecapInsight } from '../schemas/race-recap-insight.schema';
import { RacesService } from '../../races/races.service';

// Redis mock factory — supports get/setex/setnx/del with simple in-memory store
function createRedisMock() {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  return {
    store,
    get: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    setex: jest.fn(async (key: string, ttl: number, value: string) => {
      store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      return 'OK';
    }),
    set: jest.fn(async (key: string, value: string, ..._args: unknown[]) => {
      // SETNX (with EX TTL NX flags) — only set if not exists
      const hasNx = _args.includes('NX');
      if (hasNx && store.has(key)) return null;
      store.set(key, { value });
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
      }
      return count;
    }),
  };
}

describe('RaceRecapService (FEATURE-046)', () => {
  let service: RaceRecapService;
  let resultModel: {
    find: jest.Mock;
    countDocuments: jest.Mock;
  };
  let insightModel: {
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    create: jest.Mock;
  };
  let racesService: { getRaceById: jest.Mock };
  let redis: ReturnType<typeof createRedisMock>;

  // Helper: mock Mongoose query chain `.find().lean().exec()` and `.countDocuments().exec()`
  function mockQueryChain(returnValue: unknown) {
    return {
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(returnValue),
    };
  }

  function mockCountChain(value: number) {
    return { exec: jest.fn().mockResolvedValue(value) };
  }

  beforeEach(async () => {
    resultModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    insightModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
    };
    racesService = { getRaceById: jest.fn() };
    redis = createRedisMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaceRecapService,
        { provide: getModelToken(RaceResult.name), useValue: resultModel },
        {
          provide: getModelToken(RaceRecapInsight.name),
          useValue: insightModel,
        },
        { provide: RacesService, useValue: racesService },
        // InjectRedis token
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: redis,
        },
      ],
    }).compile();

    // Direct construction — bypass DI for test mocks
    /* eslint-disable @typescript-eslint/no-explicit-any */
    service = new RaceRecapService(
      resultModel as any,
      insightModel as any,
      redis as any,
      racesService as any,
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
    // Suppress NestJS Logger output during tests
    jest.spyOn(service['logger'], 'warn').mockImplementation();
  });

  // ─── getRecap() ────────────────────────────────────────────────────────

  describe('getRecap() — TC-46-01..07', () => {
    const raceId = 'race-abc-123';

    function setupEndedRaceWithResults(
      results: Array<Record<string, unknown>>,
    ) {
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: {
          _id: raceId,
          title: 'VMM Ultra 2025',
          slug: 'vmm-ultra-2025',
          endDate: new Date('2025-10-15T00:00:00Z'),
          status: 'ended',
          courses: [
            { courseId: 'c-42k', name: '42K Marathon', distance: '42K' },
          ],
        },
      });
      resultModel.countDocuments.mockReturnValue(
        mockCountChain(results.length),
      );
      resultModel.find.mockReturnValue(mockQueryChain(results));
      // F-056 refactor — computeRecap loads admin insight doc to merge spotlightStories.
      // Default: no curated insight → auto-gen fallback path.
      insightModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
    }

    it('TC-46-01 happy path — 4 finishers with 2 gender → podium + pace + neg split + AG', async () => {
      setupEndedRaceWithResults([
        {
          raceId,
          courseId: 'c-42k',
          bib: '101',
          name: 'Nguyễn Văn A',
          chipTime: '3:15:23',
          gender: 'male',
          category: 'M30-34',
          pace: '4:38/km',
          chiptimes: JSON.stringify({
            Start: '0:00',
            '21K': '1:35:00',
            Finish: '3:15:23',
          }),
        },
        {
          raceId,
          courseId: 'c-42k',
          bib: '102',
          name: 'Trần Thị B',
          chipTime: '3:30:45',
          gender: 'female',
          category: 'F30-34',
          pace: '4:59/km',
          chiptimes: JSON.stringify({
            Start: '0:00',
            '21K': '1:50:00',
            Finish: '3:30:45',
          }),
        },
        {
          raceId,
          courseId: 'c-42k',
          bib: '103',
          name: 'Lê Văn C',
          chipTime: '3:45:10',
          gender: 'male',
          category: 'M35-39',
          pace: '5:20/km',
        },
        {
          raceId,
          courseId: 'c-42k',
          bib: '104',
          name: 'Phạm Thị D',
          chipTime: '4:01:00',
          gender: 'female',
          category: 'F30-34',
          pace: '5:43/km',
        },
      ]);

      const result = await service.getRecap(raceId);

      expect(result.raceId).toBe(raceId);
      expect(result.raceTitle).toBe('VMM Ultra 2025');
      expect(result.raceSlug).toBe('vmm-ultra-2025');
      expect(result.hero.totalFinishers).toBe(4);
      expect(result.hero.headline).toContain('4 VĐV về đích');
      expect(result.podiums).toHaveLength(1);
      expect(result.podiums[0].male).toHaveLength(2);
      expect(result.podiums[0].male[0].medal).toBe('gold');
      expect(result.podiums[0].female).toHaveLength(2);
      expect(result.paceStats[0].finisherCount).toBe(4);
      expect(result.paceStats[0].medianPace).toMatch(/\d+:\d{2}\/km/);
      expect(result.computedAt).toBeDefined();
    });

    it('MUST NOT leak email/editHistory in response (Phase 1.5 — avatarUrl now public-shareable per F-013 precedent)', async () => {
      setupEndedRaceWithResults([
        {
          raceId,
          courseId: 'c-42k',
          bib: '101',
          name: 'Test',
          chipTime: '3:15:00',
          gender: 'male',
          email: 'leaked@example.com',
          avatarUrl: 'https://cdn.5bib.com/avatars/101.jpg',
          editHistory: [{ editedBy: 'admin' }],
        },
      ]);

      const result = await service.getRecap(raceId);
      const podiumCell = result.podiums[0].male[0];

      expect(podiumCell).not.toHaveProperty('email');
      expect(podiumCell).not.toHaveProperty('editHistory');
      expect(podiumCell).not.toHaveProperty('_id');
      // avatarUrl IS public-shareable (F-046 Phase 1.5 — athlete self-upload consent implicit)
      expect(podiumCell.avatarUrl).toBe('https://cdn.5bib.com/avatars/101.jpg');
    });

    it('TC-46-02 cache hit — second call no MongoDB query', async () => {
      setupEndedRaceWithResults([
        {
          raceId,
          courseId: 'c-42k',
          bib: '101',
          name: 'Test',
          chipTime: '3:15:00',
          gender: 'male',
        },
      ]);

      await service.getRecap(raceId);
      const findCallsAfterFirst = resultModel.find.mock.calls.length;

      // Second call should hit cache
      await service.getRecap(raceId);

      expect(resultModel.find.mock.calls.length).toBe(findCallsAfterFirst);
      expect(redis.get).toHaveBeenCalledWith(`recap:race:${raceId}`);
    });

    it('TC-46-03 race draft → throws NotFoundException', async () => {
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: { _id: raceId, status: 'draft' },
      });

      await expect(service.getRecap(raceId)).rejects.toThrow(NotFoundException);
    });

    it('TC-46-04 race pre_race → throws NotFoundException', async () => {
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: { _id: raceId, status: 'pre_race' },
      });

      await expect(service.getRecap(raceId)).rejects.toThrow(NotFoundException);
    });

    it('TC-46-04 race live → throws NotFoundException', async () => {
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: { _id: raceId, status: 'live' },
      });

      await expect(service.getRecap(raceId)).rejects.toThrow(NotFoundException);
    });

    it('TC-46-05 race ended zero results → throws "Đang chuẩn bị recap"', async () => {
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: {
          _id: raceId,
          title: 'X',
          slug: 'x',
          status: 'ended',
          courses: [],
        },
      });
      resultModel.countDocuments.mockReturnValue(mockCountChain(0));

      await expect(service.getRecap(raceId)).rejects.toThrow(NotFoundException);
      await expect(service.getRecap(raceId)).rejects.toThrow(
        'Đang chuẩn bị recap',
      );
    });

    it('TC-46-06 ended race with only DNS/DNF (no finishers) → 200 with empty blocks', async () => {
      setupEndedRaceWithResults([
        {
          raceId,
          courseId: 'c-42k',
          bib: '101',
          name: 'DNS Athlete',
          chipTime: '0:00:00',
          gender: 'male',
        },
        {
          raceId,
          courseId: 'c-42k',
          bib: '102',
          name: 'DNF Athlete',
          chipTime: '',
          started: 1,
          gender: 'female',
        },
      ]);

      const result = await service.getRecap(raceId);

      expect(result.hero.totalFinishers).toBe(0);
      expect(result.hero.dnsCount + result.hero.dnfCount).toBeGreaterThan(0);
      expect(result.podiums[0].male).toHaveLength(0);
      expect(result.podiums[0].female).toHaveLength(0);
      expect(result.paceStats[0].medianPace).toBe('—');
    });

    it('race not found → throws NotFoundException', async () => {
      racesService.getRaceById.mockResolvedValue({ success: false });

      await expect(service.getRecap(raceId)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── chipTimeSecondsStage parity (TC-46-20) ────────────────────────────

  describe('parseChipTimeSeconds() — chipTimeSecondsStage parity (BR-46-26)', () => {
    it('parses HH:MM:SS long race correctly', () => {
      const result = service.parseChipTimeSeconds('3:15:30');
      expect(result).toBe(3 * 3600 + 15 * 60 + 30);
    });

    it('parses MM:SS short race correctly — NOT 60x inflated (F-029 lesson)', () => {
      const result = service.parseChipTimeSeconds('23:45');
      // 23 min 45 sec = 1425 sec — NOT 23*3600 + 45*60 = 85500
      expect(result).toBe(23 * 60 + 45);
      expect(result).toBeLessThan(2000); // sanity: under 1 hour
    });

    it('returns 0 for empty / invalid input', () => {
      expect(service.parseChipTimeSeconds('')).toBe(0);
      expect(service.parseChipTimeSeconds('0:00:00')).toBe(0);
      expect(service.parseChipTimeSeconds('00:00:00')).toBe(0);
      expect(service.parseChipTimeSeconds('abc')).toBe(0);
    });
  });

  // ─── getPublicInsight() ────────────────────────────────────────────────

  describe('getPublicInsight() — TC-46-08..09', () => {
    const raceId = 'race-pub-1';

    it('TC-46-08 returns published insight without authorUserId/version', async () => {
      const publishedDate = new Date('2025-10-20T10:00:00Z');
      const updatedDate = new Date('2025-10-22T12:00:00Z');
      insightModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'doc-1',
          raceId,
          courseId: null,
          insightMarkdown: '## Test\n\nBài phân tích.',
          insightHtml: '<h2>Test</h2><p>Bài phân tích.</p>',
          authorName: 'Admin A',
          authorUserId: 'user-secret',
          publishedAt: publishedDate,
          updated_at: updatedDate,
          version: 3,
        }),
      });

      const result = await service.getPublicInsight(raceId);

      expect(result.insightMarkdown).toContain('Bài phân tích');
      expect(result.insightHtml).toContain('<h2>Test</h2>');
      expect(result.authorName).toBe('Admin A');
      expect(result.publishedAt).toBe(publishedDate.toISOString());
      expect(result).not.toHaveProperty('authorUserId');
      expect(result).not.toHaveProperty('version');
      expect(result).not.toHaveProperty('_id');
    });

    it('TC-46-09 no insight exists → returns null fields', async () => {
      insightModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getPublicInsight(raceId);

      expect(result.insightMarkdown).toBeNull();
      expect(result.insightHtml).toBeNull();
      expect(result.publishedAt).toBeNull();
      expect(result.authorName).toBeNull();
    });

    it('draft-only insight (publishedAt null) → returns null fields (filter by publishedAt $ne null)', async () => {
      // Service findOne query includes `publishedAt: { $ne: null }` filter,
      // so draft will not be returned by MongoDB.
      insightModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getPublicInsight(raceId);
      expect(result.insightMarkdown).toBeNull();
    });
  });

  // ─── upsertInsight() ───────────────────────────────────────────────────

  describe('upsertInsight() — TC-46-10..17', () => {
    const raceId = 'race-up-1';
    const actor = { userId: 'admin-1', userName: 'Admin Hằng' };

    it('TC-46-10 create new published — atomic create + Redis DEL', async () => {
      insightModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const createdDoc = {
        _id: 'doc-new',
        raceId,
        courseId: null,
        insightMarkdown: '## Phân tích',
        insightHtml: '<h2>Phân tích</h2>',
        authorName: actor.userName,
        authorUserId: actor.userId,
        publishedAt: new Date(),
        updated_at: new Date(),
        version: 1,
      };
      insightModel.create.mockResolvedValue(createdDoc);

      const result = await service.upsertInsight(raceId, actor, {
        insightMarkdown: '## Phân tích',
        publish: true,
      });

      expect(result.status).toBe('published');
      expect(result.version).toBe(1);
      expect(insightModel.create).toHaveBeenCalledTimes(1);
      expect(redis.del).toHaveBeenCalledWith(`recap:race:${raceId}`);
      expect(redis.del).toHaveBeenCalledWith(`recap:insight:${raceId}`);
    });

    it('TC-46-13 version mismatch → 409 ConflictException', async () => {
      insightModel.findOne.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValueOnce({
            _id: 'doc-1',
            raceId,
            courseId: null,
            version: 3,
            publishedAt: null,
            insightMarkdown: 'old',
          })
          .mockResolvedValueOnce({ version: 3 }),
      });

      await expect(
        service.upsertInsight(raceId, actor, {
          insightMarkdown: 'edit',
          publish: false,
          expectedVersion: 2, // stale
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('TC-46-14 sanitize markdown — strip <script> tag', async () => {
      insightModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      let capturedDoc:
        | { insightHtml: string; insightMarkdown: string }
        | undefined;
      insightModel.create.mockImplementation(async (doc) => {
        capturedDoc = doc;
        return {
          _id: 'doc-clean',
          ...doc,
          updated_at: new Date(),
          version: 1,
        };
      });

      await service.upsertInsight(raceId, actor, {
        insightMarkdown: 'Hello <script>alert("xss")</script> world',
        publish: true,
      });

      expect(capturedDoc?.insightMarkdown).not.toContain('<script>');
      expect(capturedDoc?.insightMarkdown).not.toContain('alert');
      expect(capturedDoc?.insightHtml).not.toContain('<script>');
      expect(capturedDoc?.insightHtml).not.toContain('alert');
    });

    it('TC-46-17 concurrent upsert (5x) — exactly 1 succeeds via version lock', async () => {
      // Simulate atomic version lock: first call wins, rest get null from findOneAndUpdate
      const existing = {
        _id: 'doc-existing',
        raceId,
        courseId: null,
        version: 1,
        publishedAt: null,
        insightMarkdown: 'old',
      };
      insightModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existing),
      });

      let winnerCount = 0;
      insightModel.findOneAndUpdate.mockImplementation(() => ({
        exec: jest.fn().mockImplementation(async () => {
          if (winnerCount === 0) {
            winnerCount++;
            return {
              ...existing,
              version: 2,
              insightHtml: '<p>edit</p>',
              updated_at: new Date(),
            };
          }
          return null; // version mismatch
        }),
      }));

      const promises = Array.from({ length: 5 }, () =>
        service
          .upsertInsight(raceId, actor, {
            insightMarkdown: 'concurrent edit',
            publish: false,
            expectedVersion: 1,
          })
          .catch((err) => err),
      );

      const results = await Promise.all(promises);
      // Success = RecapInsightAdminDto (has insightMarkdown).
      // Conflict = ConflictException instance.
      const successes = results.filter(
        (r) =>
          r &&
          typeof r === 'object' &&
          !(r instanceof Error) &&
          'insightMarkdown' in r,
      );
      const conflicts = results.filter((r) => r instanceof ConflictException);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(4);
    });

    it('Adjustment #5 — re-edit published insight keeps original publishedAt', async () => {
      const originalPublishedAt = new Date('2025-10-15T10:00:00Z');
      const existing = {
        _id: 'doc-pub',
        raceId,
        courseId: null,
        version: 5,
        publishedAt: originalPublishedAt,
        insightMarkdown: 'old',
      };
      insightModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existing),
      });

      let captured: { $set: { publishedAt: Date | null } } | undefined;
      insightModel.findOneAndUpdate.mockImplementation((_filter, update) => {
        captured = update as typeof captured;
        return {
          exec: jest.fn().mockResolvedValue({
            ...existing,
            version: 6,
            insightMarkdown: 'new edit',
            insightHtml: '<p>new edit</p>',
            updated_at: new Date(),
          }),
        };
      });

      await service.upsertInsight(raceId, actor, {
        insightMarkdown: 'new edit',
        publish: true,
        expectedVersion: 5,
      });

      // Publishing already-published insight → keep ORIGINAL publishedAt
      expect(captured?.$set.publishedAt).toEqual(originalPublishedAt);
    });
  });

  // ─── invalidateRecapCache() ────────────────────────────────────────────

  describe('invalidateRecapCache() — BR-46-21 hook', () => {
    it('DEL recap:race:<raceId> key', async () => {
      const raceId = 'race-invalidate';
      await service.invalidateRecapCache(raceId);
      expect(redis.del).toHaveBeenCalledWith(`recap:race:${raceId}`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // FEATURE-056 — TC-56-XX extension (14 cases, Manager Plan §Unit tests)
  // ═══════════════════════════════════════════════════════════════════════
  describe('FEATURE-056 — Race Recap UI Upgrade extension', () => {
    const raceId = 'race-f056';

    function setupEndedRace(results: Array<Record<string, unknown>>) {
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: {
          _id: raceId,
          title: 'Hà Giang Discovery 2026',
          slug: 'ha-giang-discovery-2026',
          endDate: new Date('2026-05-03T00:00:00Z'),
          status: 'ended',
          courses: [{ courseId: 'c-42k', name: '42K', distance: '42K' }],
        },
      });
      resultModel.countDocuments.mockReturnValue(mockCountChain(results.length));
      resultModel.find.mockReturnValue(mockQueryChain(results));
      // Default: no admin insight curated → auto-gen spotlight fallback path.
      insightModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
    }

    it('TC-56-01 happy path — response includes new optional fields (city, registered, negSplit detail, spotlight)', async () => {
      setupEndedRace([
        {
          raceId,
          courseId: 'c-42k',
          bib: '1024',
          name: 'Nguyễn Văn Khôi',
          chipTime: '2:38:14',
          gender: 'male',
          category: 'M30-39',
          pace: '3:45/km',
          genderRankNumeric: 1,
          nationality: 'Hà Nội',
          chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:18:00', Finish: '2:38:14' }),
        },
        {
          raceId,
          courseId: 'c-42k',
          bib: '5811',
          name: 'Vũ Hoàng Lan',
          chipTime: '3:09:47',
          gender: 'female',
          category: 'F30-39',
          pace: '4:30/km',
          genderRankNumeric: 1,
          club: 'Hanoi Runners',
          chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:30:00', Finish: '3:09:47' }),
        },
      ]);

      const result = await service.getRecap(raceId);

      // Hero new field: registered count present
      expect(result.hero.registered).toBe(2);

      // Podium city derived: M from nationality, F from club
      expect(result.podiums[0].male[0].city).toBe('Hà Nội');
      expect(result.podiums[0].female[0].city).toBe('Hà Nội');
      expect(result.podiums[0].maleFinisherCount).toBe(1);
      expect(result.podiums[0].femaleFinisherCount).toBe(1);

      // NegSplit GAP #2 fields present
      const ns = result.negativeSplits[0];
      expect(ns.avgFirstHalf).toBeDefined();
      expect(ns.avgSecondHalf).toBeDefined();
      expect(typeof ns.deltaSeconds).toBe('number');
      expect(typeof ns.finishersAnalyzed).toBe('number');
      expect(ns.benchmark).toBe(40);
      expect(ns.interpretation).toBeDefined();

      // Spotlight present (auto-gen fallback for both genders)
      expect(result.spotlightStoriesByCourse).toBeDefined();
      expect(result.spotlightStoriesByCourse![0].stories).toHaveLength(2);
      expect(result.spotlightStoriesByCourse![0].stories[0].source).toBe('auto');
      expect(result.spotlightStoriesByCourse![0].stories[0].markdown).toContain('Nguyễn Văn Khôi');
    });

    it('TC-56-02 negSplit detail via helper — finisher analyzed count + avg formats', async () => {
      setupEndedRace([
        {
          raceId,
          courseId: 'c-42k',
          bib: '1',
          name: 'Athlete 1',
          chipTime: '3:00:00',
          gender: 'male',
          chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:25:00', Finish: '3:00:00' }),
        },
        {
          raceId,
          courseId: 'c-42k',
          bib: '2',
          name: 'Athlete 2',
          chipTime: '3:30:00',
          gender: 'male',
          chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:50:00', Finish: '3:30:00' }),
        },
      ]);
      const result = await service.getRecap(raceId);
      const ns = result.negativeSplits[0];
      expect(ns.finishersAnalyzed).toBe(2);
      expect(ns.avgFirstHalf).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(ns.avgSecondHalf).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('TC-56-03 city derivation fallback chain', async () => {
      setupEndedRace([
        {
          raceId,
          courseId: 'c-42k',
          bib: 'A',
          name: 'A',
          chipTime: '3:00:00',
          gender: 'male',
          nationality: 'Hà Nội',
          genderRankNumeric: 1,
        },
        {
          raceId,
          courseId: 'c-42k',
          bib: 'B',
          name: 'B',
          chipTime: '3:01:00',
          gender: 'male',
          club: 'Hanoi Runners Club',
          genderRankNumeric: 2,
        },
        {
          raceId,
          courseId: 'c-42k',
          bib: 'C',
          name: 'C',
          chipTime: '3:02:00',
          gender: 'male',
          club: '5BIB Crew', // no province token → null
          genderRankNumeric: 3,
        },
      ]);
      const result = await service.getRecap(raceId);
      const males = result.podiums[0].male;
      expect(males[0].city).toBe('Hà Nội');
      expect(males[1].city).toBe('Hà Nội');
      expect(males[2].city).toBeUndefined();
    });

    it('TC-56-04 spotlightStories — admin curated wins over auto-gen', async () => {
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: {
          _id: raceId,
          title: 'X',
          slug: 'x',
          status: 'ended',
          endDate: new Date(),
          courses: [{ courseId: 'c-42k', name: '42K' }],
        },
      });
      const results = [
        {
          raceId,
          courseId: 'c-42k',
          bib: '1024',
          name: 'Nguyễn Văn Khôi',
          chipTime: '2:38:14',
          gender: 'male',
          genderRankNumeric: 1,
        },
      ];
      resultModel.countDocuments.mockReturnValue(mockCountChain(results.length));
      resultModel.find.mockReturnValue(mockQueryChain(results));
      insightModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          spotlightStories: [
            {
              courseId: 'c-42k',
              gender: 'M',
              winnerBib: '1024',
              markdown: '**Custom editorial**',
              html: '<p><strong>Custom editorial</strong></p>',
            },
          ],
        }),
      });
      const result = await service.getRecap(raceId);
      const story = result.spotlightStoriesByCourse![0].stories[0];
      expect(story.source).toBe('admin');
      expect(story.markdown).toContain('Custom editorial');
      expect(story.html).toContain('<strong>Custom editorial</strong>');
    });

    it('TC-56-05 endpoint wiring smoke — service getRecap callable for valid race', async () => {
      // Demonstrates the public callable path used by new controller route (Clarification #2).
      setupEndedRace([
        {
          raceId,
          courseId: 'c-42k',
          bib: '1',
          name: 'A',
          chipTime: '3:00:00',
          gender: 'male',
          genderRankNumeric: 1,
        },
      ]);
      const result = await service.getRecap(raceId);
      expect(result.raceId).toBe(raceId);
    });

    it('TC-56-06 cache hit returns cached recap (warm path) — F-056 fields preserved', async () => {
      setupEndedRace([
        {
          raceId,
          courseId: 'c-42k',
          bib: '1',
          name: 'A',
          chipTime: '3:00:00',
          gender: 'male',
          genderRankNumeric: 1,
        },
      ]);
      const first = await service.getRecap(raceId);
      const before = resultModel.find.mock.calls.length;
      const second = await service.getRecap(raceId);
      expect(resultModel.find.mock.calls.length).toBe(before);
      expect(second).toEqual(first);
    });

    it('TC-56-07 endpoint 404 when race not ended (still propagates)', async () => {
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: { _id: raceId, status: 'live' },
      });
      await expect(service.getRecap(raceId)).rejects.toThrow(NotFoundException);
    });

    it('TC-56-08 endpoint 404 when no race found', async () => {
      racesService.getRaceById.mockResolvedValue({ success: false });
      await expect(service.getRecap(raceId)).rejects.toThrow(NotFoundException);
    });

    it('TC-56-09 backward compat — older clients reading without new fields still parseable', async () => {
      setupEndedRace([
        {
          raceId,
          courseId: 'c-42k',
          bib: '1',
          name: 'A',
          chipTime: '3:00:00',
          gender: 'male',
          genderRankNumeric: 1,
        },
      ]);
      const result = await service.getRecap(raceId);
      // Destructure ONLY existing F-046 fields → should not throw / fields all present
      const { hero, podiums, paceStats, negativeSplits, agBreakdowns } = result;
      expect(hero).toBeDefined();
      expect(Array.isArray(podiums)).toBe(true);
      expect(Array.isArray(paceStats)).toBe(true);
      expect(Array.isArray(negativeSplits)).toBe(true);
      expect(Array.isArray(agBreakdowns)).toBe(true);
    });

    it('TC-56-10 XSS sanitize — auto-gen spotlight strips dangerous HTML (no executable <script> tag)', async () => {
      // Athlete name with embedded script (worst-case vendor data)
      setupEndedRace([
        {
          raceId,
          courseId: 'c-42k',
          bib: '1',
          name: '<script>alert(1)</script>Evil',
          chipTime: '3:00:00',
          gender: 'male',
          genderRankNumeric: 1,
        },
      ]);
      const result = await service.getRecap(raceId);
      const story = result.spotlightStoriesByCourse![0].stories[0];
      // Critical: no executable <script> tag (text inside escaped is XSS-safe).
      expect(story.html).not.toMatch(/<script\b/i);
      // Angle brackets in name must be HTML-escaped, not raw.
      expect(story.html).toContain('&lt;script&gt;');
    });

    it('TC-56-11 spotlightStories array order matches podium per course', async () => {
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: {
          _id: raceId,
          title: 'X',
          slug: 'x',
          status: 'ended',
          endDate: new Date(),
          courses: [
            { courseId: 'c-21k', name: '21K' },
            { courseId: 'c-42k', name: '42K' },
          ],
        },
      });
      const results = [
        { raceId, courseId: 'c-21k', bib: 'M21', name: 'M21', chipTime: '1:30:00', gender: 'male', genderRankNumeric: 1 },
        { raceId, courseId: 'c-21k', bib: 'F21', name: 'F21', chipTime: '1:50:00', gender: 'female', genderRankNumeric: 1 },
        { raceId, courseId: 'c-42k', bib: 'M42', name: 'M42', chipTime: '3:00:00', gender: 'male', genderRankNumeric: 1 },
      ];
      resultModel.countDocuments.mockReturnValue(mockCountChain(results.length));
      resultModel.find.mockReturnValue(mockQueryChain(results));
      insightModel.findOne.mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(null) });
      const result = await service.getRecap(raceId);

      const map = new Map(
        result.spotlightStoriesByCourse!.map((c) => [c.courseId, c.stories]),
      );
      expect(map.get('c-21k')!.map((s) => s.gender)).toEqual(['M', 'F']);
      expect(map.get('c-42k')!.map((s) => s.gender)).toEqual(['M']); // F42 missing
    });

    it('TC-56-12 empty state — race ended, all rows DNS → no spotlight, no podium', async () => {
      setupEndedRace([
        {
          raceId,
          courseId: 'c-42k',
          bib: '1',
          name: 'DNS',
          chipTime: '0:00:00',
          gender: 'male',
        },
      ]);
      const result = await service.getRecap(raceId);
      expect(result.podiums[0].male).toHaveLength(0);
      expect(result.podiums[0].female).toHaveLength(0);
      expect(result.spotlightStoriesByCourse).toBeUndefined();
    });

    it('TC-56-13 perf — cold compute <800ms for 2000 finisher mock', async () => {
      const big: Array<Record<string, unknown>> = [];
      for (let i = 0; i < 2000; i++) {
        big.push({
          raceId,
          courseId: 'c-42k',
          bib: String(i),
          name: `R${i}`,
          chipTime: '3:30:00',
          gender: i % 2 === 0 ? 'male' : 'female',
          category: i % 2 === 0 ? 'M30-39' : 'F30-39',
          pace: '5:00/km',
          genderRankNumeric: i,
          chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:40:00', Finish: '3:30:00' }),
          nationality: 'Hà Nội',
        });
      }
      setupEndedRace(big);
      const start = Date.now();
      const result = await service.getRecap(raceId);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(800);
      expect(result.hero.totalFinishers).toBe(2000);
    });

    it('TC-56-14 invalidate cache flow — invalidateRecapCache DEL key', async () => {
      await service.invalidateRecapCache(raceId);
      expect(redis.del).toHaveBeenCalledWith(`recap:race:${raceId}`);
    });
  });
});
