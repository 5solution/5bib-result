/**
 * FEATURE-048 Phase 1A — RaceMysqlIdBackfillService unit tests.
 *
 * Coverage: Tier 1 exact / Tier 2 fuzzy / Tier 3 manual queue / no-match.
 * Dry-run mode + apply mode + Jaccard similarity edge cases.
 */

import { RaceMysqlIdBackfillService } from './race-mysql-id-backfill.service';

interface MockRaceModel {
  find: jest.Mock;
  updateOne: jest.Mock;
}

interface MockMysqlRepo {
  find: jest.Mock;
}

function makeMongoChain(data: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(data),
      }),
    }),
  };
}

describe('RaceMysqlIdBackfillService (FEATURE-048 Phase 1A)', () => {
  let service: RaceMysqlIdBackfillService;
  let raceModel: MockRaceModel;
  let mysqlRepo: MockMysqlRepo;

  beforeEach(() => {
    raceModel = {
      find: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    mysqlRepo = { find: jest.fn() };

    /* eslint-disable @typescript-eslint/no-explicit-any */
    service = new RaceMysqlIdBackfillService(
      raceModel as any,
      mysqlRepo as any,
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  describe('slugSimilarity() — Jaccard bigram', () => {
    it('exact match → 1.0', () => {
      expect(service.slugSimilarity('vmm-2025', 'vmm-2025')).toBe(1);
    });

    it('completely different → low score', () => {
      const sim = service.slugSimilarity('abc-race-2024', 'xyz-event-2030');
      expect(sim).toBeLessThan(0.3);
    });

    it('high similarity year diff only', () => {
      const sim = service.slugSimilarity('cat-ba-heritage-2024', 'cat-ba-heritage-2025');
      expect(sim).toBeGreaterThan(0.85);
    });

    it('handles empty strings', () => {
      expect(service.slugSimilarity('', 'abc')).toBe(0);
      expect(service.slugSimilarity('abc', '')).toBe(0);
    });

    it('handles single chars', () => {
      expect(service.slugSimilarity('a', 'b')).toBe(0);
    });
  });

  describe('runBackfill() — Tier 1 title-primary (PROD verified 2026-05-20)', () => {
    it('Tier 1a: MongoDB title === MySQL title → confidence 1.0 (primary, url_name often NULL)', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([
          {
            _id: 'm-vmm',
            slug: 'some-slug-not-matching',
            title: 'VPBANK KID 2023',
            endDate: new Date('2023-10-07'),
          },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([
        {
          raceId: 7,
          urlName: null, // PROD reality: url_name often NULL
          title: 'VPBANK KID 2023',
          eventEndDate: new Date('2023-10-07'),
        },
      ]);

      const report = await service.runBackfill(false);

      expect(report.tier1Matched).toBe(1);
      expect(report.results[0].tier).toBe('tier1_exact');
      expect(report.results[0].confidence).toBe(1.0);
      expect(report.results[0].mysqlRaceId).toBe(7);
      expect(report.results[0].reason).toContain('title exact match');
    });

    it('Tier 1a title trim + case-insensitive', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([
          { _id: 'm1', slug: 'x', title: '  vpbank kid 2023  ', endDate: new Date() },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([
        { raceId: 7, urlName: null, title: 'VPBANK KID 2023', eventEndDate: new Date() },
      ]);

      const report = await service.runBackfill(false);
      expect(report.tier1Matched).toBe(1);
    });
  });

  describe('runBackfill() — Tier 1b slug fallback', () => {
    it('Tier 1: slug === url_name → confidence 1.0 + auto-populate', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([
          {
            _id: 'mongo-1',
            slug: 'vmm-2025',
            title: 'VMM 2025',
            endDate: new Date('2025-06-15'),
          },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([
        {
          raceId: 192,
          urlName: 'vmm-2025',
          title: 'VMM 2025',
          eventEndDate: new Date('2025-06-15'),
        },
      ]);

      const report = await service.runBackfill(false);

      expect(report.tier1Matched).toBe(1);
      expect(report.tier2Matched).toBe(0);
      expect(report.appliedUpdates).toBe(1);
      expect(report.results[0].tier).toBe('tier1_exact');
      expect(report.results[0].confidence).toBe(1.0);
      expect(raceModel.updateOne).toHaveBeenCalledWith(
        { _id: 'mongo-1' },
        { $set: { mysql_race_id: 192 } },
      );
    });

    it('dryRun=true → NO MongoDB write even on match', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([
          { _id: 'm1', slug: 'vmm-2025', title: 'VMM', endDate: new Date('2025-06-15') },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([
        { raceId: 192, urlName: 'vmm-2025', eventEndDate: new Date('2025-06-15') },
      ]);

      const report = await service.runBackfill(true);

      expect(report.tier1Matched).toBe(1);
      expect(report.appliedUpdates).toBe(0); // dry-run: no apply
      expect(raceModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('runBackfill() — Tier 2 fuzzy match', () => {
    it('Tier 2: trailing whitespace variation slug + endDate ±7d → confidence 0.85', async () => {
      // High similarity case: same slug but URL spelling variation acceptable.
      // Real-world example: race admin renamed slug after first creation.
      raceModel.find.mockReturnValue(
        makeMongoChain([
          {
            _id: 'm1',
            slug: 'vmm-2025-ultra',
            title: 'VMM Ultra 2025',
            endDate: new Date('2025-06-15'),
          },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([
        {
          raceId: 192,
          urlName: 'vmm-2025-ultras', // 1-char diff
          eventEndDate: new Date('2025-06-17'),
        },
      ]);

      const report = await service.runBackfill(false);

      expect(report.tier2Matched).toBe(1);
      expect(report.results[0].tier).toBe('tier2_fuzzy');
      expect(report.results[0].confidence).toBe(0.85);
    });

    it('Tier 2 FAIL: huge similarity gap (different words) → demoted to Tier 3', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([
          {
            _id: 'm1',
            slug: 'cat-ba-heritage-2025',
            title: 'Cat Ba Heritage 2025',
            endDate: new Date('2025-04-01'),
          },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([
        {
          raceId: 50,
          urlName: 'cat-ba-heritage-road-2025', // extra word "road"
          eventEndDate: new Date('2025-04-01'),
        },
      ]);

      const report = await service.runBackfill(false);

      // Adding an entire word drops similarity below 0.85 → manual review
      expect(report.tier2Matched).toBe(0);
      expect(report.tier3Manual).toBe(1);
    });

    it('Tier 3: high similarity but endDate >7d off → manual review', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([
          {
            _id: 'm1',
            slug: 'vmm-2024',
            title: 'VMM 2024',
            endDate: new Date('2024-06-15'),
          },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([
        {
          raceId: 50,
          urlName: 'vmm-2025', // 1-char diff
          eventEndDate: new Date('2025-06-15'), // 1 year off
        },
      ]);

      const report = await service.runBackfill(false);

      expect(report.tier2Matched).toBe(0);
      expect(report.tier3Manual).toBe(1);
    });
  });

  describe('runBackfill() — Tier 3 manual + no_match', () => {
    it('Low similarity + bad endDate → no_match', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([
          { _id: 'm1', slug: 'mystery-race-zzz', title: 'Mystery', endDate: new Date('2025-01-01') },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([
        {
          raceId: 100,
          urlName: 'totally-different-race',
          eventEndDate: new Date('2030-12-31'),
        },
      ]);

      const report = await service.runBackfill(false);

      expect(report.noMatch).toBe(1);
      expect(report.results[0].tier).toBe('no_match');
    });

    it('Empty slug → no_match with specific reason', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([
          { _id: 'm-empty', slug: '', title: 'Old race', endDate: new Date() },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([]);

      const report = await service.runBackfill(false);

      expect(report.noMatch).toBe(1);
      expect(report.results[0].reason).toContain('empty slug');
    });
  });

  describe('runBackfill() — mixed batch', () => {
    it('processes 3 races: 1 tier1 + 1 tier2 + 1 manual review', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([
          { _id: 'm1', slug: 'vmm-2025', title: 'VMM', endDate: new Date('2025-06-15') },
          {
            _id: 'm2',
            slug: 'vmm-2025-ultra',
            title: 'VMM Ultra',
            endDate: new Date('2025-06-20'),
          },
          { _id: 'm3', slug: 'orphan-event-xyz', title: 'Orphan', endDate: new Date('2025-01-01') },
        ]),
      );
      mysqlRepo.find.mockResolvedValue([
        {
          raceId: 192,
          urlName: 'vmm-2025',
          eventEndDate: new Date('2025-06-15'),
        },
        {
          raceId: 200,
          urlName: 'vmm-2025-ultras', // 1-char diff Tier 2
          eventEndDate: new Date('2025-06-22'),
        },
      ]);

      const report = await service.runBackfill(false);

      expect(report.tier1Matched).toBe(1);
      expect(report.tier2Matched).toBe(1);
      // m3 has no candidate → no_match
      expect(report.tier1Matched + report.tier2Matched + report.tier3Manual + report.noMatch).toBe(3);
      expect(report.appliedUpdates).toBe(2); // 2 auto-applied (Tier 1 + 2)
    });
  });

  describe('Edge cases', () => {
    it('handles MongoDB empty races collection gracefully', async () => {
      raceModel.find.mockReturnValue(makeMongoChain([]));
      mysqlRepo.find.mockResolvedValue([{ raceId: 1, urlName: 'a', eventEndDate: new Date() }]);

      const report = await service.runBackfill(false);

      expect(report.totalMongoRaces).toBe(0);
      expect(report.tier1Matched).toBe(0);
      expect(report.results).toHaveLength(0);
    });

    it('handles MySQL empty race list gracefully', async () => {
      raceModel.find.mockReturnValue(
        makeMongoChain([{ _id: 'm1', slug: 'a', title: 'a', endDate: new Date() }]),
      );
      mysqlRepo.find.mockResolvedValue([]);

      const report = await service.runBackfill(false);

      expect(report.totalMysqlRaces).toBe(0);
      expect(report.noMatch).toBe(1);
    });
  });
});
