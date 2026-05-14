import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PromoHubService } from './promo-hub.service';
import { PromoHub } from './schemas/promo-hub.schema';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RaceReadonly } from './entities/race-readonly.entity';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('PromoHubService', () => {
  let service: PromoHubService;
  let mockModel: any;
  let mockRedis: any;
  let mockRaceRepo: any;
  let mockQueryBuilder: any;

  const mockHub = (overrides: Partial<any> = {}): any => ({
    _id: new Types.ObjectId(),
    slug: 'test-hub',
    title: 'Test Hub',
    description: 'description',
    status: 'draft',
    sections: [],
    seo: {},
    theme: {
      primaryColor: '#1d4ed8',
      secondaryColor: '#ea580c',
      fontFamily: 'Be Vietnam Pro',
      layout: 'standard',
    },
    createdBy: 'logto-user-1',
    createdAt: new Date('2026-05-13T00:00:00Z'),
    updatedAt: new Date('2026-05-13T00:00:00Z'),
    toObject() {
      const { toObject, save, ...rest } = this;
      void toObject;
      void save;
      return rest;
    },
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(async () => {
    mockModel = {
      create: jest.fn(),
      findById: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      findOneAndUpdate: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      countDocuments: jest.fn().mockReturnThis(),
    };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    // FEATURE-033 — QueryBuilder mock cho findRacesOnSale()
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockRaceRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PromoHubService,
        { provide: getModelToken(PromoHub.name), useValue: mockModel },
        {
          provide: getRepositoryToken(RaceReadonly, 'platform'),
          useValue: mockRaceRepo,
        },
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = moduleRef.get<PromoHubService>(PromoHubService);
  });

  describe('create()', () => {
    it('happy path — creates hub with default status="draft" + sanitized sections', async () => {
      const hub = mockHub({ slug: 'utmb-vn-2026', title: 'UTMB Vietnam 2026' });
      // For create() the service calls `.toObject()` and reads createdAt/updatedAt.
      hub.toObject = () => ({ ...hub });
      mockModel.create.mockResolvedValue(hub);

      const result = await service.create(
        { slug: 'utmb-vn-2026', title: 'UTMB Vietnam 2026' },
        'logto-user-1',
      );

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'utmb-vn-2026',
          title: 'UTMB Vietnam 2026',
          status: 'draft',
          createdBy: 'logto-user-1',
        }),
      );
      expect(result.slug).toBe('utmb-vn-2026');
      expect(result.id).toBe(hub._id.toString());
    });

    it('throws ConflictException on duplicate slug (E11000)', async () => {
      const err = Object.assign(new Error('E11000 duplicate key'), {
        code: 11000,
      });
      mockModel.create.mockRejectedValue(err);

      await expect(
        service.create({ slug: 'dup', title: 'Dup' }, 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    it('sanitizes rich_text section html (strips <script>)', async () => {
      const hub = mockHub({ slug: 's', title: 't' });
      hub.toObject = () => ({ ...hub });
      mockModel.create.mockResolvedValue(hub);

      await service.create(
        {
          slug: 's',
          title: 't',
          sections: [
            {
              type: 'rich_text',
              order: 0,
              visible: true,
              config: {
                html: '<p>Safe</p><script>alert("xss")</script>',
              },
            },
          ],
        },
        'u1',
      );

      const callArg = mockModel.create.mock.calls[0][0];
      const sectionHtml = callArg.sections[0].config.html as string;
      expect(sectionHtml).not.toContain('<script>');
      expect(sectionHtml).toContain('<p>Safe</p>');
    });
  });

  describe('findById()', () => {
    it('throws BadRequestException for invalid ObjectId', async () => {
      await expect(service.findById('not-a-valid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when hub does not exist', async () => {
      mockModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.findById(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlugPublic()', () => {
    it('returns cached payload when cache hit', async () => {
      const cached = {
        id: 'x',
        slug: 'live-hub',
        title: 'Live',
        status: 'published',
        sections: [],
        seo: {},
        theme: {
          primaryColor: '#1d4ed8',
          secondaryColor: '#ea580c',
          fontFamily: 'Be Vietnam Pro',
          layout: 'standard',
        },
        createdBy: 'u1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.findBySlugPublic('live-hub');
      expect(result).toEqual(cached);
      expect(mockModel.findOne).not.toHaveBeenCalled();
    });

    it('falls back to MongoDB on cache miss, then writes cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockImplementation(
        (_key: string, _val: string, _ex: string, _ttl: number, mode?: string) => {
          if (mode === 'NX') return Promise.resolve('OK'); // lock acquired
          return Promise.resolve('OK');
        },
      );

      const hub = mockHub({
        slug: 'live-hub',
        status: 'published',
        sections: [
          {
            _id: new Types.ObjectId(),
            type: 'hero',
            order: 0,
            visible: true,
            config: {},
            schedule: { enabled: false },
          },
        ],
      });
      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(hub) }),
      });

      const result = await service.findBySlugPublic('live-hub');
      expect(result.slug).toBe('live-hub');
      expect(result.status).toBe('published');
      // Cache should have been written.
      const setCalls = mockRedis.set.mock.calls;
      const setCacheCall = setCalls.find(
        (c: unknown[]) => (c[0] as string).startsWith('promo-hub:'),
      );
      expect(setCacheCall).toBeDefined();
    });

    it('throws 404 when hub does not exist OR status != published', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });

      await expect(service.findBySlugPublic('non-exist')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('filters out hidden sections (visible=false)', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const hub = mockHub({
        slug: 'h',
        status: 'published',
        sections: [
          {
            _id: new Types.ObjectId(),
            type: 'hero',
            order: 0,
            visible: true,
            config: {},
            schedule: { enabled: false },
          },
          {
            _id: new Types.ObjectId(),
            type: 'cta_buttons',
            order: 1,
            visible: false, // hidden
            config: {},
            schedule: { enabled: false },
          },
        ],
      });
      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(hub) }),
      });

      const result = await service.findBySlugPublic('h');
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe('hero');
    });

    it('filters out sections outside schedule window', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const past = new Date('2020-01-01');
      const future = new Date('2099-01-01');
      const hub = mockHub({
        slug: 'h',
        status: 'published',
        sections: [
          {
            _id: new Types.ObjectId(),
            type: 'hero',
            order: 0,
            visible: true,
            config: {},
            schedule: { enabled: true, startDate: past, endDate: future }, // active now
          },
          {
            _id: new Types.ObjectId(),
            type: 'cta_buttons',
            order: 1,
            visible: true,
            config: {},
            schedule: { enabled: true, startDate: future, endDate: future }, // future
          },
        ],
      });
      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(hub) }),
      });

      const result = await service.findBySlugPublic('h');
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe('hero');
    });
  });

  describe('softDelete()', () => {
    it('throws BadRequestException for invalid id', async () => {
      await expect(service.softDelete('invalid', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates status to archived + invalidates cache', async () => {
      const id = new Types.ObjectId();
      const archived = { _id: id, slug: 'h', status: 'archived' };
      mockModel.findOneAndUpdate.mockResolvedValue(archived);

      const result = await service.softDelete(id.toString(), 'u1');
      expect(result.success).toBe(true);
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id, status: { $ne: 'archived' } },
        { $set: { status: 'archived' } },
        { new: true },
      );
      expect(mockRedis.del).toHaveBeenCalledWith('promo-hub:h');
    });

    it('throws NotFoundException when hub already archived (idempotent guard)', async () => {
      mockModel.findOneAndUpdate.mockResolvedValue(null);
      await expect(
        service.softDelete(new Types.ObjectId().toString(), 'u1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('list()', () => {
    it('paginates + filters by status', async () => {
      mockModel.find.mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: () => ({ exec: () => Promise.resolve([mockHub()]) }),
            }),
          }),
        }),
      });
      mockModel.countDocuments.mockReturnValue({ exec: () => Promise.resolve(1) });

      const result = await service.list({ status: 'published' });
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(mockModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'published' }),
      );
    });

    it('skips status filter when status="all"', async () => {
      mockModel.find.mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: () => ({ exec: () => Promise.resolve([]) }),
            }),
          }),
        }),
      });
      mockModel.countDocuments.mockReturnValue({ exec: () => Promise.resolve(0) });

      await service.list({ status: 'all' });
      const callArgs = mockModel.countDocuments.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('status');
    });
  });

  // ─── FEATURE-033: findRacesOnSale() ────────────────────────────

  describe('findRacesOnSale() — MySQL platform on-sale phase', () => {
    const mockRace = (overrides: Partial<RaceReadonly> = {}): RaceReadonly =>
      ({
        raceId: '212',
        title: 'UTMB Việt Nam 2026',
        urlName: 'utmb-vn-2026',
        status: 'GENERATED_CODE',
        logoUrl: 'https://example.com/logo.png',
        eventStartDate: new Date('2026-12-01T00:00:00Z'),
        eventEndDate: new Date('2026-12-03T00:00:00Z'),
        registrationStartTime: new Date('2026-06-01T00:00:00Z'),
        registrationEndTime: new Date('2026-11-15T00:00:00Z'),
        location: 'Mộc Châu, Sơn La',
        brand: 'UTMB',
        tenantId: '5',
        ...overrides,
      }) as RaceReadonly;

    it('queries with filter status=GENERATED_CODE + is_delete=0 + is_show=1 (HOTFIX 2026-05-14: removed url_name NOT NULL — see TD-F033-06)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockRace()]);
      await service.findRacesOnSale({});

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.status = :status', {
        status: 'GENERATED_CODE',
      });
      const andWhereCalls = mockQueryBuilder.andWhere.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(andWhereCalls).toContain('CAST(r.is_delete AS UNSIGNED) = 0');
      expect(andWhereCalls).toContain('CAST(r.is_show AS UNSIGNED) = 1');
    });

    it('toRaceOnSaleDto fallback urlName → raceId when url_name NULL/empty', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([
        mockRace({ raceId: '212', urlName: null as never }),
      ]);
      const result = await service.findRacesOnSale({});
      expect(result[0].urlName).toBe('212');
      expect(result[0].ticketUrl).toBe('https://5ticket.vn/event/212');
    });

    it('respects limit + default sort=registration_start_time ASC', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      await service.findRacesOnSale({ limit: 10 });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'r.registration_start_time',
        'ASC',
      );
    });

    it('sort=event_date maps to r.event_start_date ASC', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      await service.findRacesOnSale({ sort: 'event_date' });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'r.event_start_date',
        'ASC',
      );
    });

    it('default limit=6 when not provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      await service.findRacesOnSale({});
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(6);
    });

    it('Redis cache HIT on 2nd call — returns cached without re-querying MySQL', async () => {
      const cachedDtos = [
        {
          raceId: '999',
          title: 'Cached Race',
          urlName: 'cached',
          logoUrl: null,
          eventStartDate: null,
          registrationEndTime: null,
          location: null,
          brand: null,
          ticketUrl: 'https://5ticket.vn/event/cached',
        },
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedDtos));

      const result = await service.findRacesOnSale({ limit: 6 });

      expect(result).toEqual(cachedDtos);
      expect(mockRaceRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('Redis GET throws → fallback DB direct (graceful degrade)', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));
      mockQueryBuilder.getMany.mockResolvedValue([mockRace()]);

      const result = await service.findRacesOnSale({});

      expect(result).toHaveLength(1);
      expect(mockRaceRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('MySQL query throws → return empty [] (no 500)', async () => {
      mockQueryBuilder.getMany.mockRejectedValue(new Error('MySQL down'));
      const result = await service.findRacesOnSale({});
      expect(result).toEqual([]);
    });

    it('transforms RaceReadonly → DTO, strips tenant_id, pre-computes ticketUrl', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([
        mockRace({ urlName: 'utmb-2026' }),
      ]);
      const result = await service.findRacesOnSale({});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        raceId: '212',
        title: 'UTMB Việt Nam 2026',
        urlName: 'utmb-2026',
        ticketUrl: 'https://5ticket.vn/event/utmb-2026',
        location: 'Mộc Châu, Sơn La',
        brand: 'UTMB',
      });
      expect(result[0]).not.toHaveProperty('tenantId');
      expect(result[0]).not.toHaveProperty('isShow');
      expect(result[0]).not.toHaveProperty('isDelete');
    });

    it('caches result on successful query (Redis SET called)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockRace()]);
      await service.findRacesOnSale({ limit: 6 });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'promo-hub:races-on-sale:6:registration_start_time',
        expect.any(String),
        'EX',
        60,
      );
    });
  });
});
