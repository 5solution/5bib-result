import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ShortLinksService } from './short-links.service';

/**
 * FEATURE-089 — ShortLinksService unit tests.
 * Direct instantiation với mock model + redis (@Optional()). Test files exempt
 * khỏi anti-pattern any-scan (Coder skill convention).
 */
function makeDoc(payload: any) {
  return {
    _id: payload._id ?? '665100000000000000000089',
    code: payload.code,
    targetUrl: payload.targetUrl,
    title: payload.title,
    clickCount: payload.clickCount ?? 0,
    active: payload.active ?? true,
    createdBy: payload.createdBy,
    createdAt: payload.createdAt ?? new Date('2026-06-17T00:00:00.000Z'),
    updatedAt: payload.updatedAt ?? new Date('2026-06-17T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

const dupErr = () => Object.assign(new Error('E11000 dup key'), { code: 11000 });

describe('ShortLinksService', () => {
  let model: any;
  let redis: any;
  let service: ShortLinksService;

  beforeEach(() => {
    model = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    service = new ShortLinksService(model, redis);
  });

  describe('create() — random code', () => {
    it('sinh code base62 đúng 6 ký tự + trả shape KHÔNG leak _id/createdBy', async () => {
      model.create.mockImplementation(async (p: any) => makeDoc(p));
      const res = await service.create(
        { targetUrl: 'https://5bib.com/x', title: 'Lào Cai' },
        'user-1',
      );
      expect(res.code).toHaveLength(6);
      expect(/^[A-Za-z0-9]{6}$/.test(res.code)).toBe(true);
      expect(res.shortUrl).toBe(`https://s.5bib.com/${res.code}`);
      expect(res.targetUrl).toBe('https://5bib.com/x');
      expect(res).not.toHaveProperty('_id');
      expect(res).not.toHaveProperty('createdBy');
      expect(res).not.toHaveProperty('__v');
    });

    it('retry khi đụng unique index (collision) → ra code khác, vẫn thành công', async () => {
      model.create.mockRejectedValueOnce(dupErr());
      model.create.mockImplementation(async (p: any) => makeDoc(p));
      const res = await service.create({ targetUrl: 'https://5bib.com/x' }, 'u');
      expect(model.create).toHaveBeenCalledTimes(2);
      expect(res.code).toHaveLength(6);
    });

    it('đụng dup quá SHORTLINK_CODE_MAX_RETRY lần → ConflictException', async () => {
      model.create.mockRejectedValue(dupErr());
      await expect(
        service.create({ targetUrl: 'https://5bib.com/x' }, 'u'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('create() — custom alias', () => {
    it('dùng alias làm code', async () => {
      model.create.mockImplementation(async (p: any) => makeDoc(p));
      const res = await service.create(
        { targetUrl: 'https://5bib.com/x', customAlias: 'laocai2026' },
        'u',
      );
      expect(res.code).toBe('laocai2026');
    });

    it('alias reserved (admin) → BadRequestException', async () => {
      await expect(
        service.create({ targetUrl: 'https://5bib.com/x', customAlias: 'admin' }, 'u'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('alias đã tồn tại → ConflictException', async () => {
      model.create.mockRejectedValue(dupErr());
      await expect(
        service.create({ targetUrl: 'https://5bib.com/x', customAlias: 'laocai2026' }, 'u'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('resolve()', () => {
    it('active link (cache miss) → trả targetUrl + $inc clickCount + cacheSet', async () => {
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(makeDoc({ code: 'abc123', targetUrl: 'https://5bib.com/y' })),
      });
      const res = await service.resolve('abc123');
      expect(res.targetUrl).toBe('https://5bib.com/y');
      expect(model.updateOne).toHaveBeenCalledWith(
        { code: 'abc123', active: true },
        { $inc: { clickCount: 1 } },
      );
      expect(redis.set).toHaveBeenCalledWith(
        'shortlink:code:abc123',
        'https://5bib.com/y',
        'EX',
        3600,
      );
    });

    it('cache hit → KHÔNG query Mongo findOne, vẫn $inc', async () => {
      redis.get.mockResolvedValue('https://5bib.com/cached');
      const res = await service.resolve('abc123');
      expect(res.targetUrl).toBe('https://5bib.com/cached');
      expect(model.findOne).not.toHaveBeenCalled();
      expect(model.updateOne).toHaveBeenCalled();
    });

    it('không tồn tại / active=false → NotFoundException', async () => {
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.resolve('khongton')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('contention: lock không acquire + worker khác warm cache → trả targetUrl, KHÔNG 404', async () => {
      redis.set.mockResolvedValue(null); // lock luôn fail (worker khác giữ)
      redis.get
        .mockResolvedValueOnce(null) // resolve initial cacheGet
        .mockResolvedValue('https://5bib.com/warmed'); // retry trong queryActive + recheck
      const res = await service.resolve('abc123');
      expect(res.targetUrl).toBe('https://5bib.com/warmed');
      expect(model.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('đổi targetUrl → save + DEL cache key', async () => {
      const doc = makeDoc({ code: 'abc123', targetUrl: 'https://old.com' });
      model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const res = await service.update('id1', { targetUrl: 'https://new.com' });
      expect(doc.save).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('shortlink:code:abc123');
      expect(res.targetUrl).toBe('https://new.com');
    });

    it('id không tồn tại → NotFoundException', async () => {
      model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.update('nope', { active: false })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove()', () => {
    it('xóa + DEL cache', async () => {
      model.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(makeDoc({ code: 'abc123', targetUrl: 'https://x' })),
      });
      await service.remove('id1');
      expect(redis.del).toHaveBeenCalledWith('shortlink:code:abc123');
    });

    it('không tồn tại → NotFoundException', async () => {
      model.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list()', () => {
    it('trả items + total, map shape không leak _id', async () => {
      model.find.mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              exec: jest
                .fn()
                .mockResolvedValue([makeDoc({ code: 'abc123', targetUrl: 'https://x' })]),
            }),
          }),
        }),
      });
      model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
      const res = await service.list({ page: 1, pageSize: 20 });
      expect(res.total).toBe(1);
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).not.toHaveProperty('_id');
      expect(res.items[0].shortUrl).toBe('https://s.5bib.com/abc123');
    });
  });
});
