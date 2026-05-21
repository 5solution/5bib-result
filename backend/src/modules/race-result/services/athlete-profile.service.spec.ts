/**
 * FEATURE-047 — AthleteProfileService unit tests.
 *
 * Coverage TC-47-XX (Phase 1A scope — aggregation live, no collection):
 * - TC-47-01 happy path profile + PR + history
 * - TC-47-02 cache hit no MongoDB query
 * - TC-47-03 slug not found (no race_results match bib)
 * - TC-47-15 PR records best chipTime per distance
 * - TC-47-19 PII strip — no email/phone/cccd/dob fields in response
 * - TC-47-07 photos empty array (Phase 1A no collection)
 * - slug parser edge cases
 * - distance classification fuzzy
 * - cross-race aggregation
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { AthleteProfileService } from './athlete-profile.service';

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

describe('AthleteProfileService (FEATURE-047)', () => {
  let service: AthleteProfileService;
  let resultModel: { find: jest.Mock };
  let racesService: { getRaceById: jest.Mock };
  let redis: ReturnType<typeof createRedisMock>;
  let profileModel: { findOne: jest.Mock };
  let photoService: { getApprovedPhotos: jest.Mock };

  function mockChain(returnValue: unknown) {
    return {
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(returnValue),
    };
  }

  function mockProfileFindOneEmpty() {
    return {
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };
  }

  beforeEach(() => {
    resultModel = { find: jest.fn() };
    racesService = { getRaceById: jest.fn() };
    redis = createRedisMock();
    profileModel = {
      findOne: jest.fn().mockReturnValue(mockProfileFindOneEmpty()),
    };
    photoService = { getApprovedPhotos: jest.fn().mockResolvedValue([]) };
    /* eslint-disable @typescript-eslint/no-explicit-any */
    service = new AthleteProfileService(
      resultModel as any,
      profileModel as any,
      redis as any,
      racesService as any,
      photoService as any,
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
    jest.spyOn(service['logger'], 'warn').mockImplementation();
  });

  // ─── parseSlug() ───────────────────────────────────────────────────────

  describe('parseSlug()', () => {
    it('parses valid slug `2095-truong-van-quan`', () => {
      const result = service.parseSlug('2095-truong-van-quan');
      expect(result).toEqual({ bib: '2095', nameSlug: 'truong-van-quan' });
    });

    it('parses bib with non-numeric prefix `vip001-nguyen-van-a`', () => {
      const result = service.parseSlug('vip001-nguyen-van-a');
      expect(result).toEqual({ bib: 'vip001', nameSlug: 'nguyen-van-a' });
    });

    it('returns null for slug without hyphen', () => {
      expect(service.parseSlug('2095')).toBeNull();
      expect(service.parseSlug('singleword')).toBeNull();
    });

    it('returns null for slug starting/ending with hyphen', () => {
      expect(service.parseSlug('-truong-van-quan')).toBeNull();
      expect(service.parseSlug('2095-')).toBeNull();
    });

    it('returns null for empty / very short slug', () => {
      expect(service.parseSlug('')).toBeNull();
      expect(service.parseSlug('ab')).toBeNull();
    });
  });

  // ─── getProfile() ──────────────────────────────────────────────────────

  describe('getProfile() — TC-47-01..05', () => {
    const slug = '2095-truong-van-quan';

    function setupRaceMetas(metas: Array<Record<string, unknown>>) {
      racesService.getRaceById.mockImplementation(async (id: string) => {
        const meta = metas.find((m) => m._id === id);
        return meta ? { success: true, data: meta } : { success: false };
      });
    }

    it('TC-47-01 happy path — single race finisher → profile + history', async () => {
      resultModel.find.mockReturnValue(
        mockChain([
          {
            raceId: 'race-1',
            courseId: 'course-fm',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '3:15:23',
            gender: 'male',
            category: 'M30-34',
            nationality: 'Việt Nam',
            club: 'Saigon Runners',
            overallRank: '5',
            categoryRank: '2',
            created_at: new Date('2026-03-15'),
            started: 1,
          },
        ]),
      );
      setupRaceMetas([
        {
          _id: 'race-1',
          slug: 'vmm-2026',
          title: 'Vietnam Mountain Marathon 2026',
          endDate: new Date('2026-03-15T00:00:00Z'),
          status: 'ended',
          courses: [
            { courseId: 'course-fm', name: '42KM Marathon', distance: '42K' },
          ],
        },
      ]);

      const result = await service.getProfile(slug);

      expect(result.slug).toBe(slug);
      expect(result.canonicalName).toBe('Trương Văn Quân');
      expect(result.primaryBib).toBe('2095');
      expect(result.gender).toBe('male');
      expect(result.nationality).toBe('Việt Nam');
      expect(result.club).toBe('Saigon Runners');
      expect(result.totalRaces).toBe(1);
      expect(result.totalFinished).toBe(1);
      expect(result.totalDNF).toBe(0);
      expect(result.raceHistory).toHaveLength(1);
      expect(result.raceHistory[0].status).toBe('finished');
      expect(result.raceHistory[0].raceTitle).toBe(
        'Vietnam Mountain Marathon 2026',
      );
      expect(result.prRecords).toHaveLength(1);
      expect(result.prRecords[0].distance).toBe('FM');
      expect(result.prRecords[0].chipTime).toBe('3:15:23');
    });

    it('MUST NOT leak email/phone/cccd/dob/address in response (TC-47-19 PII)', async () => {
      resultModel.find.mockReturnValue(
        mockChain([
          {
            raceId: 'race-1',
            courseId: 'course-fm',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '3:15:23',
            gender: 'male',
            // PII fields that should NOT leak even if accidentally in DB
            email: 'leaked@example.com',
            phone: '0901234567',
            cccd: '079202000123',
            dob: '1990-05-20',
            address: '123 Lê Lợi Q1',
          },
        ]),
      );
      setupRaceMetas([
        {
          _id: 'race-1',
          slug: 'vmm',
          title: 'VMM',
          endDate: new Date('2026-03-15'),
          courses: [{ courseId: 'course-fm', name: '42K', distance: '42K' }],
        },
      ]);

      const result = await service.getProfile(slug);

      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('cccd');
      expect(result).not.toHaveProperty('dob');
      expect(result).not.toHaveProperty('address');
      // raceHistory rows also should not leak
      expect(result.raceHistory[0]).not.toHaveProperty('email');
      expect(result.raceHistory[0]).not.toHaveProperty('phone');
    });

    it('TC-47-02 cache hit — second call no MongoDB query', async () => {
      resultModel.find.mockReturnValue(
        mockChain([
          {
            raceId: 'race-1',
            courseId: 'c1',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '3:15:23',
          },
        ]),
      );
      setupRaceMetas([
        {
          _id: 'race-1',
          slug: 'vmm',
          title: 'VMM',
          endDate: new Date('2026-03-15'),
          courses: [{ courseId: 'c1', name: '42K', distance: '42K' }],
        },
      ]);

      await service.getProfile(slug);
      const firstCallCount = resultModel.find.mock.calls.length;

      await service.getProfile(slug);

      expect(resultModel.find.mock.calls.length).toBe(firstCallCount);
      expect(redis.get).toHaveBeenCalledWith(`athlete:profile:${slug}`);
    });

    it('TC-47-03 not found — slug returns no race_results', async () => {
      resultModel.find.mockReturnValue(mockChain([]));

      await expect(service.getProfile('9999-fake-name')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('not found — bib matches but name slugify mismatch', async () => {
      // Different athlete same bib (race-specific bib reuse)
      resultModel.find.mockReturnValue(
        mockChain([
          {
            raceId: 'race-x',
            courseId: 'c1',
            bib: '2095',
            name: 'Khác Hoàn Toàn',
            chipTime: '4:00:00',
          },
        ]),
      );

      await expect(service.getProfile('2095-truong-van-quan')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('invalid slug format → NotFoundException', async () => {
      await expect(service.getProfile('singleword')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getProfile('')).rejects.toThrow(NotFoundException);
    });

    it('TC-47-15 PR records — best chipTime per distance across multiple races', async () => {
      resultModel.find.mockReturnValue(
        mockChain([
          {
            raceId: 'r1',
            courseId: 'c1',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '3:30:00',
            distance: '42K',
            created_at: new Date('2024-03-15'),
          },
          {
            raceId: 'r2',
            courseId: 'c2',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '3:10:50',
            distance: '42K',
            created_at: new Date('2025-03-15'),
          },
          {
            raceId: 'r3',
            courseId: 'c3',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '1:25:00',
            distance: '21K',
            created_at: new Date('2025-06-15'),
          },
        ]),
      );
      setupRaceMetas([
        {
          _id: 'r1',
          slug: 'r1-2024',
          title: 'Race 2024',
          endDate: new Date('2024-03-15'),
          courses: [{ courseId: 'c1', name: '42K', distance: '42K' }],
        },
        {
          _id: 'r2',
          slug: 'r2-2025',
          title: 'Race 2025',
          endDate: new Date('2025-03-15'),
          courses: [{ courseId: 'c2', name: '42K', distance: '42K' }],
        },
        {
          _id: 'r3',
          slug: 'r3-hm-2025',
          title: 'HM Race 2025',
          endDate: new Date('2025-06-15'),
          courses: [{ courseId: 'c3', name: '21K', distance: '21K' }],
        },
      ]);

      const result = await service.getProfile(slug);

      const fmRecord = result.prRecords.find((p) => p.distance === 'FM');
      const hmRecord = result.prRecords.find((p) => p.distance === 'HM');
      expect(fmRecord?.chipTime).toBe('3:10:50'); // best (not 3:30:00)
      expect(fmRecord?.raceId).toBe('r2');
      expect(hmRecord?.chipTime).toBe('1:25:00');
    });

    it('multi-race cross-aggregation — totalRaces + totalFinished + totalDNF counts', async () => {
      resultModel.find.mockReturnValue(
        mockChain([
          {
            raceId: 'r1',
            courseId: 'c1',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '3:30:00',
            distance: '42K',
            started: 1,
          },
          {
            raceId: 'r2',
            courseId: 'c2',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '', // DNF
            distance: '42K',
            started: 1,
          },
          {
            raceId: 'r3',
            courseId: 'c3',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '0:00:00', // DNS
            distance: '21K',
            started: 0,
          },
        ]),
      );
      setupRaceMetas([
        {
          _id: 'r1',
          slug: 'r1',
          title: 'R1',
          endDate: new Date(),
          courses: [{ courseId: 'c1', distance: '42K' }],
        },
        {
          _id: 'r2',
          slug: 'r2',
          title: 'R2',
          endDate: new Date(),
          courses: [{ courseId: 'c2', distance: '42K' }],
        },
        {
          _id: 'r3',
          slug: 'r3',
          title: 'R3',
          endDate: new Date(),
          courses: [{ courseId: 'c3', distance: '21K' }],
        },
      ]);

      const result = await service.getProfile(slug);

      expect(result.totalRaces).toBe(3);
      expect(result.totalFinished).toBe(1);
      expect(result.totalDNF).toBe(1); // started=1 but no chipTime
    });

    it('race meta missing → row skipped from history (graceful)', async () => {
      resultModel.find.mockReturnValue(
        mockChain([
          {
            raceId: 'r1',
            courseId: 'c1',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '3:00:00',
          },
          {
            raceId: 'r-deleted',
            courseId: 'c2',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '3:30:00',
          },
        ]),
      );
      // Only r1 has meta — r-deleted returns success=false
      racesService.getRaceById.mockImplementation(async (id: string) => {
        if (id === 'r1') {
          return {
            success: true,
            data: {
              _id: 'r1',
              slug: 'r1',
              title: 'R1',
              endDate: new Date(),
              courses: [{ courseId: 'c1', distance: '42K' }],
            },
          };
        }
        return { success: false };
      });

      const result = await service.getProfile(slug);
      // History only has r1 (r-deleted filtered out)
      expect(result.raceHistory).toHaveLength(1);
      expect(result.raceHistory[0].raceId).toBe('r1');
    });
  });

  // ─── getPhotos() — Phase 1A stub ────────────────────────────────────────

  describe('getPhotos() — TC-47-06/07 + Phase 1B', () => {
    it('TC-47-07 empty photos when none approved', async () => {
      photoService.getApprovedPhotos.mockResolvedValue([]);
      const result = await service.getPhotos('2095-truong-van-quan');
      expect(result).toEqual({ photos: [] });
    });

    it('TC-47-06 Phase 1B — returns approved photos with signed URL', async () => {
      photoService.getApprovedPhotos.mockResolvedValue([
        {
          id: 'photo-1',
          type: 'selfie',
          s3Url: 'https://signed.example.com/photo-1.webp',
          raceId: 'race-a',
          bib: '2095',
          uploadedAt: '2026-05-20T00:00:00.000Z',
        },
      ]);
      const result = await service.getPhotos('2095-truong-van-quan');
      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].s3Url).toContain('signed.example.com');
    });

    it('Phase 1B BR-47-05 active=false → 404 even on photos endpoint', async () => {
      profileModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            slug: '2095-truong-van-quan',
            active: false,
          }),
        }),
      });
      await expect(service.getPhotos('2095-truong-van-quan')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Phase 1B collection-first path ────────────────────────────────────

  describe('Phase 1B getProfile() — collection-first read', () => {
    it('TC-47-04 active=false → 404', async () => {
      profileModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            slug: '2095-truong-van-quan',
            active: false,
            canonicalName: 'Q',
            primaryBib: '2095',
            linkedBibs: ['2095'],
            linkedRaceIds: [],
            totalRaces: 1,
            totalFinished: 1,
            totalDNF: 0,
          }),
        }),
      });
      await expect(service.getProfile('2095-truong-van-quan')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('TC-47-05 v2 reads from athlete_profiles collection first (NOT live aggregation)', async () => {
      profileModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            slug: '2095-truong-van-quan',
            active: true,
            canonicalName: 'Trương Văn Quân',
            primaryBib: '2095',
            linkedBibs: ['2095'],
            linkedRaceIds: ['race-A'],
            totalRaces: 1,
            totalFinished: 1,
            totalDNF: 0,
            avatarUrl: 'https://cdn.example.com/avatar.jpg',
          }),
        }),
      });
      // Mock live race history join
      resultModel.find.mockReturnValue(
        mockChain([
          {
            raceId: 'race-A',
            courseId: 'c-1',
            bib: '2095',
            name: 'Trương Văn Quân',
            chipTime: '1:20:00',
            started: 1,
          },
        ]),
      );
      racesService.getRaceById.mockResolvedValue({
        success: true,
        data: {
          _id: 'race-A',
          slug: 'race-a',
          title: 'BẮC SƠN MARATHON 2026',
          endDate: new Date('2026-04-01'),
          courses: [{ courseId: 'c-1', name: 'HM', distance: '21K' }],
        },
      });

      const result = await service.getProfile('2095-truong-van-quan');
      expect(result.canonicalName).toBe('Trương Văn Quân');
      expect(result.primaryBib).toBe('2095');
      expect(result.totalRaces).toBe(1);
    });
  });

  // ─── invalidateProfileCache() ──────────────────────────────────────────

  describe('invalidateProfileCache()', () => {
    it('DELs athlete:profile:<slug> key', async () => {
      await service.invalidateProfileCache('2095-truong-van-quan');
      expect(redis.del).toHaveBeenCalledWith(
        'athlete:profile:2095-truong-van-quan',
      );
    });
  });

  // ─── FEATURE-050 race-ops helpers ──────────────────────────────────────

  describe('FEATURE-050 — race-ops helpers', () => {
    // Cast to access public helper methods; classifyRaceType / computeStreak etc.
    // are exposed as instance methods (not strictly private) for unit-test access.

    describe('classifyRaceType()', () => {
      it('TC-50-01 returns "road" when raceType="running" and distance < 50K', () => {
        const out = service.classifyRaceType(
          { courseId: 'c1', distanceKm: 42 },
          { _id: 'r1', title: 'M', raceType: 'running' },
        );
        expect(out).toBe('road');
      });

      it('TC-50-02 returns "trail" when raceType contains trail/mountain and distance < 50K', () => {
        const out = service.classifyRaceType(
          { courseId: 'c1', distanceKm: 30 },
          { _id: 'r1', title: 'VMM', raceType: 'trail' },
        );
        expect(out).toBe('trail');
      });

      it('TC-50-03 returns "ultra_trail" when raceType=trail and distance ≥ 50K', () => {
        const out = service.classifyRaceType(
          { courseId: 'c1', distanceKm: 70 },
          { _id: 'r1', title: 'Dalat 70', raceType: 'mountain trail' },
        );
        expect(out).toBe('ultra_trail');
      });

      it('TC-50-04 returns undefined when no signal (no raceType, no distance)', () => {
        const out = service.classifyRaceType(undefined, {
          _id: 'r1',
          title: 'Unknown',
        });
        expect(out).toBeUndefined();
      });

      it('parses distance string fallback "42K" when distanceKm missing', () => {
        const out = service.classifyRaceType(
          { courseId: 'c1', distance: '42K' },
          { _id: 'r1', title: 'M', raceType: 'running' },
        );
        expect(out).toBe('road');
      });
    });

    describe('computeStreak()', () => {
      it('TC-50-05 counts consecutive finished from most-recent only', () => {
        const history = [
          { status: 'finished' },
          { status: 'finished' },
          { status: 'dnf' },
          { status: 'finished' },
        ] as Parameters<typeof service.computeStreak>[0];
        expect(service.computeStreak(history)).toBe(2);
      });

      it('returns 0 when most-recent row is dnf/dns', () => {
        const history = [
          { status: 'dnf' },
          { status: 'finished' },
        ] as Parameters<typeof service.computeStreak>[0];
        expect(service.computeStreak(history)).toBe(0);
      });

      it('returns full length when ALL finished', () => {
        const history = [
          { status: 'finished' },
          { status: 'finished' },
          { status: 'finished' },
        ] as Parameters<typeof service.computeStreak>[0];
        expect(service.computeStreak(history)).toBe(3);
      });

      it('returns 0 on empty history', () => {
        expect(service.computeStreak([])).toBe(0);
      });
    });

    describe('computeDistanceSpecialist()', () => {
      it('TC-50-06 returns only buckets with count ≥3 finished, sorted DESC', () => {
        const history = [
          { status: 'finished', distance: '42K' },
          { status: 'finished', distance: '42K' },
          { status: 'finished', distance: '42K' },
          { status: 'finished', distance: '21K' },
          { status: 'finished', distance: '21K' },
          { status: 'dnf', distance: '21K' }, // dnf excluded
          { status: 'finished', distance: '21K' },
          { status: 'finished', distance: '21K' },
          { status: 'finished', distance: '5K' },
          { status: 'finished', distance: '5K' },
        ] as Parameters<typeof service.computeDistanceSpecialist>[0];
        const out = service.computeDistanceSpecialist(history);
        // 21K = 4 finished, 42K = 3 finished, 5K = 2 (excluded)
        expect(out).toEqual([
          { distance: '21K', count: 4 },
          { distance: '42K', count: 3 },
        ]);
      });

      it('returns empty array when no bucket reaches threshold', () => {
        const history = [
          { status: 'finished', distance: '42K' },
          { status: 'finished', distance: '21K' },
        ] as Parameters<typeof service.computeDistanceSpecialist>[0];
        expect(service.computeDistanceSpecialist(history)).toEqual([]);
      });
    });

    describe('computeProvinces()', () => {
      it('TC-50-07 dedups + sorts VN locale unique provinces from raceMetas', () => {
        const history = [
          { raceId: 'r1' },
          { raceId: 'r2' },
          { raceId: 'r3' },
          { raceId: 'r4' },
        ] as Parameters<typeof service.computeProvinces>[0];
        const metas = new Map([
          ['r1', { _id: 'r1', title: 'A', province: 'Đà Nẵng' }],
          ['r2', { _id: 'r2', title: 'B', province: 'Hà Nội' }],
          ['r3', { _id: 'r3', title: 'C', province: 'Đà Nẵng' }], // dup
          ['r4', { _id: 'r4', title: 'D' }], // no province
        ]);
        const out = service.computeProvinces(history, metas);
        expect(out).toHaveLength(2);
        expect(out).toContain('Đà Nẵng');
        expect(out).toContain('Hà Nội');
      });

      it('returns empty array when no race meta has province', () => {
        const history = [{ raceId: 'r1' }] as Parameters<
          typeof service.computeProvinces
        >[0];
        const metas = new Map([['r1', { _id: 'r1', title: 'A' }]]);
        expect(service.computeProvinces(history, metas)).toEqual([]);
      });
    });

    describe('formatAgBracket()', () => {
      it('TC-50-08 converts vendor "F30-34" → "Nữ 30-34"', () => {
        expect(service.formatAgBracket('F30-34', undefined)).toBe('Nữ 30-34');
      });

      it('converts "M40-44" → "Nam 40-44"', () => {
        expect(service.formatAgBracket('M40-44', undefined)).toBe('Nam 40-44');
      });

      it('converts "F-Open" → "Nữ Mở"', () => {
        expect(service.formatAgBracket('F-Open', undefined)).toBe('Nữ Mở');
      });

      it('passes through already-VN format', () => {
        expect(service.formatAgBracket('Nữ 30-39', undefined)).toBe(
          'Nữ 30-39',
        );
      });

      it('returns undefined for empty/whitespace', () => {
        expect(service.formatAgBracket(undefined, undefined)).toBeUndefined();
        expect(service.formatAgBracket('  ', undefined)).toBeUndefined();
      });

      it('falls back to raw string when unrecognized + no gender hint', () => {
        expect(service.formatAgBracket('SENIOR', undefined)).toBe('SENIOR');
      });

      it('prepends gender prefix when raw bracket missing gender token', () => {
        expect(service.formatAgBracket('30-34', 'male')).toBe('Nam 30-34');
      });
    });

    describe('computeBestAgRank()', () => {
      it('returns lowest numeric categoryRank from finished rows', () => {
        const history = [
          {
            raceId: 'r1',
            raceSlug: 'r1',
            raceTitle: 'R1',
            status: 'finished',
            categoryRank: '5',
            category: 'M30-34',
            agBracket: 'Nam 30-34',
          },
          {
            raceId: 'r2',
            raceSlug: 'r2',
            raceTitle: 'R2',
            status: 'finished',
            categoryRank: '2',
            category: 'M30-34',
            agBracket: 'Nam 30-34',
          },
          {
            raceId: 'r3',
            raceSlug: 'r3',
            raceTitle: 'R3',
            status: 'dnf',
            categoryRank: '1',
          },
        ] as Parameters<typeof service.computeBestAgRank>[0];
        const best = service.computeBestAgRank(history);
        expect(best).toBeDefined();
        expect(best?.raceId).toBe('r2');
        expect(best?.rank).toBe('2');
        expect(best?.bracket).toBe('Nam 30-34');
      });

      it('returns undefined when no finished row has categoryRank', () => {
        const history = [
          { status: 'finished', categoryRank: undefined },
          { status: 'dnf', categoryRank: '1' },
        ] as Parameters<typeof service.computeBestAgRank>[0];
        expect(service.computeBestAgRank(history)).toBeUndefined();
      });
    });

    describe('integration — F-050 fields wired into getProfile() response', () => {
      const slug = '2095-truong-van-quan';

      it('TC-50-09 trail ultra race row exposes raceClassification + elevation in history', async () => {
        resultModel.find.mockReturnValue(
          mockChain([
            {
              raceId: 'r-ultra',
              courseId: 'c-70k',
              bib: '2095',
              name: 'Trương Văn Quân',
              chipTime: '12:30:00',
              gender: 'male',
              category: 'M30-34',
              categoryRank: '3',
              gunTime: '12:31:00',
              created_at: new Date('2026-04-15'),
              started: 1,
            },
          ]),
        );
        racesService.getRaceById.mockResolvedValue({
          success: true,
          data: {
            _id: 'r-ultra',
            slug: 'dalat-70k',
            title: 'Dalat Ultra 70K',
            endDate: new Date('2026-04-15'),
            province: 'Lâm Đồng',
            raceType: 'trail',
            courses: [
              {
                courseId: 'c-70k',
                name: '70KM Ultra',
                distance: '70K',
                distanceKm: 70,
                elevationGain: 3200,
              },
            ],
          },
        });

        const result = await service.getProfile(slug);

        expect(result.raceHistory).toHaveLength(1);
        const row = result.raceHistory[0];
        expect(row.raceClassification).toBe('ultra_trail');
        expect(row.elevationGain).toBe(3200);
        expect(row.gunTime).toBe('12:31:00');
        expect(row.agBracket).toBe('Nam 30-34');
        // Best AG rank populated
        expect(result.bestAgRank).toBeDefined();
        expect(result.bestAgRank?.rank).toBe('3');
      });

      it('TC-50-10 graceful undefined when course has no elevationGain', async () => {
        resultModel.find.mockReturnValue(
          mockChain([
            {
              raceId: 'r1',
              courseId: 'c1',
              bib: '2095',
              name: 'Trương Văn Quân',
              chipTime: '3:30:00',
              created_at: new Date('2026-04-15'),
            },
          ]),
        );
        racesService.getRaceById.mockResolvedValue({
          success: true,
          data: {
            _id: 'r1',
            slug: 'r1',
            title: 'R1',
            endDate: new Date('2026-04-15'),
            // no province, no raceType, no elevationGain
            courses: [
              { courseId: 'c1', name: '42K', distance: '42K', distanceKm: 42 },
            ],
          },
        });

        const result = await service.getProfile(slug);
        const row = result.raceHistory[0];
        expect(row.elevationGain).toBeUndefined();
        expect(row.gunTime).toBeUndefined();
        // raceClassification still infers 'road' from distance signal
        expect(row.raceClassification).toBe('road');
        // Aggregations should still respond gracefully
        expect(result.provinces).toEqual([]);
      });
    });
  });

  // ─── getSitemapEntries() Phase 1B ──────────────────────────────────────

  describe('getSitemapEntries()', () => {
    it('returns slugs only (NO PII) sorted by lastRaceDate DESC', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            { slug: '2095-a', lastRaceDate: new Date('2026-04-01') },
            { slug: '5004-b', lastRaceDate: new Date('2026-03-01') },
          ]),
        }),
      });
      profileModel.findOne = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (profileModel as any).find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ select: mockSelect }),
        }),
      });

      const result = await service.getSitemapEntries(100);
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('2095-a');
      // Verify no email/phone/cccd in response
      const allValues = JSON.stringify(result);
      expect(allValues).not.toMatch(/email|phone|cccd|dob/i);
    });
  });
});
