import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PromoHubAnalyticsService } from './promo-hub-analytics.service';
import { PromoHubClick } from './schemas/promo-hub-click.schema';
import { PromoHubView } from './schemas/promo-hub-view.schema';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('PromoHubAnalyticsService', () => {
  let service: PromoHubAnalyticsService;
  let mockClickModel: any;
  let mockViewModel: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockClickModel = {
      create: jest.fn().mockResolvedValue({}),
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    mockViewModel = {
      create: jest.fn().mockResolvedValue({}),
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PromoHubAnalyticsService,
        { provide: getModelToken(PromoHubClick.name), useValue: mockClickModel },
        { provide: getModelToken(PromoHubView.name), useValue: mockViewModel },
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = moduleRef.get<PromoHubAnalyticsService>(PromoHubAnalyticsService);
  });

  describe('trackClick()', () => {
    it('records click with SHA-256 hashed IP (never raw)', async () => {
      const hubId = new Types.ObjectId().toString();
      const sectionId = new Types.ObjectId().toString();
      await service.trackClick(
        {
          hubId,
          sectionId,
          label: 'Đăng ký ngay',
          url: 'https://5bib.com/race/utmb',
        },
        '203.0.113.42',
        'Mozilla/5.0',
        'https://5bib.com/',
      );

      expect(mockClickModel.create).toHaveBeenCalledTimes(1);
      const arg = mockClickModel.create.mock.calls[0][0];
      // SHA-256 hex = 64 chars
      expect(arg.ip).toHaveLength(64);
      expect(arg.ip).not.toBe('203.0.113.42');
      expect(arg.label).toBe('Đăng ký ngay');
    });

    it('truncates oversize userAgent + referer', async () => {
      const longUa = 'a'.repeat(700);
      const longRef = 'b'.repeat(3000);
      await service.trackClick(
        {
          hubId: new Types.ObjectId().toString(),
          sectionId: new Types.ObjectId().toString(),
          label: 'L',
          url: 'U',
        },
        '1.2.3.4',
        longUa,
        longRef,
      );
      const arg = mockClickModel.create.mock.calls[0][0];
      expect(arg.userAgent.length).toBe(500);
      expect(arg.referer.length).toBe(2000);
    });
  });

  describe('trackView()', () => {
    it('records view when no slug rate-limit (returns recorded=true)', async () => {
      const result = await service.trackView(
        { hubId: new Types.ObjectId().toString() },
        '1.2.3.4',
      );
      expect(result.recorded).toBe(true);
      expect(mockViewModel.create).toHaveBeenCalledTimes(1);
    });

    it('SKIPS recording when Redis rate-limit hit (returns recorded=false)', async () => {
      // SETNX returns null when key exists (rate-limited).
      mockRedis.set.mockResolvedValue(null);

      const result = await service.trackView(
        { hubId: new Types.ObjectId().toString(), slug: 'h' },
        '1.2.3.4',
      );
      expect(result.recorded).toBe(false);
      expect(mockViewModel.create).not.toHaveBeenCalled();
    });

    it('continues recording when Redis throws (graceful degrade)', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      const result = await service.trackView(
        { hubId: new Types.ObjectId().toString(), slug: 'h' },
        '1.2.3.4',
      );
      expect(result.recorded).toBe(true);
      expect(mockViewModel.create).toHaveBeenCalledTimes(1);
    });

    it('SHA-256 hashes IP for analytics storage', async () => {
      await service.trackView(
        { hubId: new Types.ObjectId().toString() },
        '203.0.113.99',
      );
      const arg = mockViewModel.create.mock.calls[0][0];
      expect(arg.ip).toHaveLength(64);
      expect(arg.ip).not.toBe('203.0.113.99');
    });
  });

  describe('getSummary()', () => {
    it('throws BadRequestException for invalid hubId', async () => {
      await expect(service.getSummary('not-an-objectid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns aggregated summary with ctr derived from views/clicks', async () => {
      mockViewModel.countDocuments.mockResolvedValue(100);
      mockClickModel.countDocuments.mockResolvedValue(35);
      // Aggregations return empty for simplicity
      mockViewModel.aggregate.mockResolvedValue([]);
      mockClickModel.aggregate.mockResolvedValue([]);

      const result = await service.getSummary(new Types.ObjectId().toString());
      expect(result.totalViews).toBe(100);
      expect(result.totalClicks).toBe(35);
      expect(result.ctr).toBe(0.35);
      expect(result.viewsByDay).toEqual([]);
      expect(result.topSections).toEqual([]);
    });

    it('ctr=0 when no views (avoid div-by-zero)', async () => {
      mockViewModel.countDocuments.mockResolvedValue(0);
      mockClickModel.countDocuments.mockResolvedValue(5);

      const result = await service.getSummary(new Types.ObjectId().toString());
      expect(result.ctr).toBe(0);
    });
  });
});
