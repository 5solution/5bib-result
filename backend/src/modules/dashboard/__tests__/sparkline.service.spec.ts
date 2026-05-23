import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardSparklineService } from '../services/sparkline.service';
import { FeeService } from '../../finance/services/fee.service';
import { MerchantConfig } from '../../merchant/schemas/merchant-config.schema';

/**
 * Legacy F-023 specs — preserved for behaviors NOT covered by
 * `sparkline.service.f059.spec.ts`: cache hit/miss + refreshCache + SQL
 * shape + backfill 30 days.
 *
 * F-059 rework (QC verdict 2026-05-23):
 *  - Updated DI mocks (FeeService + MerchantConfigModel + Redis token).
 *  - Cache key string updated `dashboard:sparklines:30d` (legacy) →
 *    `dashboard:sparkline:30d` (singular, F-059 BR-59-06).
 *  - Dropped legacy `platform_fee = round(net × 0.055)` assertion — fee is
 *    now cascade-computed by FeeService (covered by f059 spec).
 */
const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';
const CACHE_KEY = 'dashboard:sparkline:30d';

describe('DashboardSparklineService — legacy', () => {
  let service: DashboardSparklineService;
  let mockDb: { query: jest.Mock };
  let mockRedis: { get: jest.Mock; set: jest.Mock };
  let mockFeeService: { computeFeeForOrdersAggregate: jest.Mock };
  let mockConfigModel: { find: jest.Mock };

  beforeEach(async () => {
    mockDb = { query: jest.fn().mockResolvedValue([]) };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    mockFeeService = {
      computeFeeForOrdersAggregate: jest.fn().mockResolvedValue({
        tenantId: 0,
        totalServiceFee: 0,
        totalManualFee: 0,
        totalVat: 0,
        totalFee: 0,
        totalNetGmv: 0,
        feeSourceBreakdown: [],
        appliedOverrides: [],
        warnings: [],
      }),
    };
    mockConfigModel = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: jest.fn().mockResolvedValue([]) }),
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardSparklineService,
        { provide: getDataSourceToken('platform'), useValue: mockDb },
        { provide: REDIS_TOKEN, useValue: mockRedis },
        { provide: FeeService, useValue: mockFeeService },
        { provide: getModelToken(MerchantConfig.name), useValue: mockConfigModel },
      ],
    }).compile();
    service = moduleRef.get(DashboardSparklineService);
  });

  it('Cache hit: trả nguyên payload từ Redis, KHÔNG query DB', async () => {
    const cached = {
      series: [{ key: 'gmv', points: [] }],
      days: 30,
      generatedAt: '2026-05-10T00:00:00Z',
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));
    const res = await service.getSparklines();
    expect(res).toEqual(cached);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('Cache miss: compute + ghi cache TTL 3600 với key F-059', async () => {
    mockDb.query.mockResolvedValue([
      { d: '2026-05-01', gmv: 1_000_000, net: 900_000, athletes: 5 },
    ]);
    const res = await service.getSparklines();
    expect(res.series).toHaveLength(4); // gmv, net, athletes, platform_fee
    expect(res.days).toBe(30);
    expect(mockRedis.set).toHaveBeenCalledWith(
      CACHE_KEY,
      expect.any(String),
      'EX',
      3600,
    );
  });

  it('refreshCache(): KHÔNG đọc cache cũ, ghi đè', async () => {
    await service.refreshCache(30);
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it('SQL exclude MANUAL + financial_status=paid', async () => {
    await service.getSparklines();
    // Daily-agg query is the first SQL call (pull-orders may run second
    // when there are orders; here DB returns [] so agg suffices).
    const aggSql = String(mockDb.query.mock.calls[0][0]);
    expect(aggSql).toContain("financial_status = 'paid'");
    expect(aggSql).toContain("order_category != 'MANUAL'");
  });

  it('Backfill 30 điểm khi DB chỉ trả vài ngày', async () => {
    mockDb.query.mockResolvedValue([
      { d: '2026-05-01', gmv: 1_000, net: 900, athletes: 1 },
    ]);
    const res = await service.getSparklines();
    const gmvSeries = res.series.find((s) => s.key === 'gmv');
    expect(gmvSeries?.points.length).toBeGreaterThanOrEqual(28);
  });

  it('platform_fee series tồn tại + có 30 điểm (cascade-based, value-agnostic)', async () => {
    // F-059: legacy `round(net × 0.055)` assertion dropped — fee now
    // cascade-computed by FeeService (mocked → returns 0). Verify shape only;
    // numeric correctness owned by sparkline.service.f059.spec.ts.
    mockDb.query.mockResolvedValue([]);
    const res = await service.getSparklines();
    const fee = res.series.find((s) => s.key === 'platform_fee');
    expect(fee).toBeDefined();
    expect(fee!.points.length).toBeGreaterThanOrEqual(28);
    expect(fee!.points.every((p) => p.value === 0)).toBe(true);
  });
});
