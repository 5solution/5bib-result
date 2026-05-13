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

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('PromoHubService', () => {
  let service: PromoHubService;
  let mockModel: any;
  let mockRedis: any;

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

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PromoHubService,
        { provide: getModelToken(PromoHub.name), useValue: mockModel },
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
});
