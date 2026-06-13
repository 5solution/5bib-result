import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LandingService } from './landing.service';
import { RaceLanding } from './schemas/race-landing.schema';
import { Race } from '../races/schemas/race.schema';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

/** Chainable Mongoose query stub: supports .lean()/.select()/.sort()/.skip()/.limit()/.exec(). */
function chain<T>(result: T) {
  const c: Record<string, unknown> = {};
  for (const m of ['lean', 'select', 'sort', 'skip', 'limit']) c[m] = () => c;
  c.exec = () => Promise.resolve(result);
  return c;
}

interface MockDoc {
  [k: string]: unknown;
  save: jest.Mock;
  set: jest.Mock;
}

function makeLandingDoc(overrides: Record<string, unknown> = {}): MockDoc {
  const doc: MockDoc = {
    _id: '650000000000000000000001',
    raceRef: { raceId: 'r1', mysqlRaceId: 48217, slug: 'halong-2026' },
    merchantRef: { tenantId: 'tenant-secret', tenantName: 'BTC Hạ Long' },
    internalName: 'Hạ Long Marathon',
    status: 'draft',
    meta: { title: 'Hạ Long', lang: 'vi', robots: 'index,follow', analytics: {} },
    theme: { main: '#ea580c', sec: '#1d4ed8', fontHeading: 'Be Vietnam Pro', fontBody: 'Inter', heroOverlay: 0.45 },
    domain: { subdomain: 'halong-marathon', domainStatus: 'none', sslStatus: 'none' },
    sections: [],
    publish: { hasUnpublishedChanges: false, version: 0, publishedAt: null, liveSnapshot: null },
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(undefined),
    set: jest.fn(function (this: MockDoc, k: string, v: unknown) {
      this[k] = v;
    }),
    ...overrides,
  };
  return doc;
}

describe('LandingService', () => {
  let service: LandingService;
  let landingModel: Record<string, jest.Mock>;
  let raceModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    landingModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
    };
    raceModel = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LandingService,
        { provide: getModelToken(RaceLanding.name), useValue: landingModel },
        { provide: getModelToken(Race.name), useValue: raceModel },
        { provide: REDIS_TOKEN, useValue: null }, // redis-less graceful path
      ],
    }).compile();
    service = module.get(LandingService);
  });

  describe('create()', () => {
    const race = {
      _id: 'r1',
      title: 'Hạ Long Marathon 2026',
      slug: 'halong-2026',
      brandColor: '#166534',
      bannerUrl: 'https://s3/banner.jpg',
      startDate: new Date('2026-03-14T05:00:00+07:00'),
      organizer: 'BTC Hạ Long',
      mysql_race_id: 48217,
      enable5pix: true,
      pixEventUrl: 'https://5pix.org/e/halong',
    };

    it('TC-83-01 — seeds sections + raceRef, returns admin DTO (no _id leak)', async () => {
      raceModel.findById.mockReturnValue(chain(race));
      landingModel.findOne.mockReturnValue(chain(null));
      landingModel.create.mockImplementation((payload) =>
        Promise.resolve(makeLandingDoc(payload)),
      );

      const res = await service.create({ raceId: 'r1' }, 'admin-1');

      const payload = landingModel.create.mock.calls[0][0];
      expect(payload.raceRef.raceId).toBe('r1');
      expect(payload.raceRef.mysqlRaceId).toBe(48217);
      // hero/course/results/sponsors enabled; photos_embed enabled (enable5pix)
      const enabledTypes = payload.sections
        .filter((s: { enabled: boolean }) => s.enabled)
        .map((s: { type: string }) => s.type);
      expect(enabledTypes).toEqual(
        expect.arrayContaining(['hero', 'course', 'results_embed', 'sponsors', 'photos_embed']),
      );
      expect(res).not.toHaveProperty('_id');
      expect(res.id).toBeDefined();
    });

    it('TC-83-19 — CTA auto-filled with mysql deep-link + utm', async () => {
      raceModel.findById.mockReturnValue(chain(race));
      landingModel.findOne.mockReturnValue(chain(null));
      landingModel.create.mockImplementation((p) => Promise.resolve(makeLandingDoc(p)));

      await service.create({ raceId: 'r1' }, 'admin-1');
      const hero = landingModel.create.mock.calls[0][0].sections.find(
        (s: { type: string }) => s.type === 'hero',
      );
      expect(hero.data.ctaButtons[0].href).toContain('5bib.com/vi/events/48217');
      expect(hero.data.ctaButtons[0].href).toContain('utm_source=landing');
    });

    it('ADJUSTMENT#2 — mysql_race_id null → CTA href empty (admin fills)', async () => {
      raceModel.findById.mockReturnValue(chain({ ...race, mysql_race_id: null }));
      landingModel.findOne.mockReturnValue(chain(null));
      landingModel.create.mockImplementation((p) => Promise.resolve(makeLandingDoc(p)));

      await service.create({ raceId: 'r1' }, 'admin-1');
      const hero = landingModel.create.mock.calls[0][0].sections.find(
        (s: { type: string }) => s.type === 'hero',
      );
      expect(hero.data.ctaButtons[0].href).toBe('');
    });

    it('TC-83-02 — race already has landing → 409 LANDING_EXISTS', async () => {
      raceModel.findById.mockReturnValue(chain(race));
      landingModel.findOne.mockReturnValue(chain({ _id: 'existing' }));
      await expect(service.create({ raceId: 'r1' }, 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('race not found → 404', async () => {
      raceModel.findById.mockReturnValue(chain(null));
      await expect(service.create({ raceId: 'rX' }, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reorderSections()', () => {
    it('TC-83-07 — invalid variant for type → 400', async () => {
      landingModel.findById.mockReturnValue(chain(makeLandingDoc()));
      await expect(
        service.reorderSections(
          '650000000000000000000001',
          [{ type: 'hero', variant: 'carousel', enabled: true, order: 0, data: {} } as never],
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('valid variants → re-numbers order + saves', async () => {
      const doc = makeLandingDoc();
      landingModel.findById.mockReturnValue(chain(doc));
      await service.reorderSections(
        '650000000000000000000001',
        [
          { type: 'about', variant: 'stats', enabled: true, order: 5, data: {} } as never,
          { type: 'hero', variant: 'video', enabled: true, order: 9, data: {} } as never,
        ],
        'admin-1',
      );
      expect(doc.set).toHaveBeenCalledWith('sections', expect.any(Array));
      const saved = doc.set.mock.calls[0][1];
      expect(saved.map((s: { order: number }) => s.order)).toEqual([0, 1]);
      expect(doc.save).toHaveBeenCalled();
    });
  });

  describe('update() subdomain validation', () => {
    it('TC-83-04 — reserved subdomain → 400', async () => {
      landingModel.findById.mockReturnValue(chain(makeLandingDoc()));
      landingModel.findOne.mockReturnValue(chain(null));
      await expect(
        service.update('650000000000000000000001', { domain: { subdomain: 'admin' } }, 'a'),
      ).rejects.toThrow(BadRequestException);
    });

    it('TC-83-06 — subdomain taken by another → 409', async () => {
      landingModel.findById.mockReturnValue(chain(makeLandingDoc()));
      landingModel.findOne.mockReturnValue(chain({ _id: 'other' }));
      await expect(
        service.update('650000000000000000000001', { domain: { subdomain: 'cool-race' } }, 'a'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('publish()', () => {
    it('TC-83-09 — no subdomain → 422', async () => {
      const doc = makeLandingDoc({ domain: { subdomain: undefined, domainStatus: 'none', sslStatus: 'none' } });
      landingModel.findById.mockReturnValue(chain(doc));
      await expect(service.publish('650000000000000000000001', 'a')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('TC-83-08/16 — version-guarded snapshot of enabled sections', async () => {
      const doc = makeLandingDoc({
        sections: [
          { _id: 's1', type: 'hero', variant: 'image', enabled: true, order: 0, data: {} },
          { _id: 's2', type: 'about', variant: 'stats', enabled: false, order: 1, data: {} },
        ],
      });
      landingModel.findById.mockReturnValue(chain(doc));
      landingModel.findOne.mockReturnValue(chain(null)); // subdomain re-check: no clash
      landingModel.findOneAndUpdate.mockReturnValue(chain(makeLandingDoc({ status: 'published' })));

      await service.publish('650000000000000000000001', 'admin-1');

      const [filter, updateOp] = landingModel.findOneAndUpdate.mock.calls[0];
      expect(filter['publish.version']).toBe(0); // version-guard
      const snap = updateOp.$set['publish.liveSnapshot'];
      expect(snap.sections).toHaveLength(1); // only enabled
      expect(snap.sections[0].type).toBe('hero');
      expect(updateOp.$set['publish.version']).toBe(1);
    });
  });

  describe('findBySlugPublic() — public strip BR-83-20', () => {
    it('TC-83-10 — serves liveSnapshot, strips _id/tenantId/internalName/draft', async () => {
      const doc = makeLandingDoc({
        publish: {
          version: 3,
          hasUnpublishedChanges: false,
          publishedAt: new Date(),
          liveSnapshot: {
            meta: { title: 'Hạ Long', lang: 'vi', robots: 'index,follow', analytics: {} },
            theme: { main: '#166534', sec: '#06b6d4' },
            sections: [{ _id: 's1', type: 'hero', variant: 'image', enabled: true, order: 0, data: {} }],
          },
        },
      });
      landingModel.findOne.mockReturnValue(chain(doc));

      const res = await service.findBySlugPublic('halong-marathon');

      expect(res.id).toBe('650000000000000000000001');
      expect(res).not.toHaveProperty('_id');
      expect(res).not.toHaveProperty('merchantRef');
      expect(res).not.toHaveProperty('internalName');
      expect(res).not.toHaveProperty('publish');
      expect(res.sections).toHaveLength(1);
      expect(res.theme.main).toBe('#166534');
    });

    it('TC-83-11 — not found → 404', async () => {
      landingModel.findOne.mockReturnValue(chain(null));
      await expect(service.findBySlugPublic('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolveHost()', () => {
    it('TC-83-13 — host with <3 parts → 404', async () => {
      await expect(service.resolveHost('5bib.com')).rejects.toThrow(NotFoundException);
    });

    it('TC-83-13 — resolves subdomain → slug', async () => {
      landingModel.findOne.mockReturnValue(chain({ _id: 'x' }));
      const res = await service.resolveHost('halong-marathon.5bib.com');
      expect(res.slug).toBe('halong-marathon');
    });
  });
});
