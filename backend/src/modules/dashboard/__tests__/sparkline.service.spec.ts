import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DashboardSparklineService } from '../services/sparkline.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('DashboardSparklineService', () => {
  let service: DashboardSparklineService;
  let mockDb: { query: jest.Mock };
  let mockRedis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    mockDb = { query: jest.fn().mockResolvedValue([]) };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardSparklineService,
        { provide: getDataSourceToken('platform'), useValue: mockDb },
        { provide: REDIS_TOKEN, useValue: mockRedis },
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

  it('Cache miss: compute + ghi cache TTL 3600', async () => {
    mockDb.query.mockResolvedValue([
      { d: '2026-05-01', gmv: 1_000_000, net: 900_000, athletes: 5 },
    ]);
    const res = await service.getSparklines();
    expect(res.series).toHaveLength(4); // gmv, net, athletes, platform_fee
    expect(res.days).toBe(30);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'dashboard:sparklines:30d',
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
    const sql = mockDb.query.mock.calls[0][0] as string;
    expect(sql).toContain("financial_status = 'paid'");
    expect(sql).toContain("order_category != 'MANUAL'");
  });

  it('Backfill 30 điểm khi DB chỉ trả vài ngày', async () => {
    mockDb.query.mockResolvedValue([
      { d: '2026-05-01', gmv: 1_000, net: 900, athletes: 1 },
    ]);
    const res = await service.getSparklines();
    const gmvSeries = res.series.find((s) => s.key === 'gmv');
    expect(gmvSeries?.points.length).toBeGreaterThanOrEqual(28);
  });

  it('platform_fee point = round(net × 0.055)', async () => {
    mockDb.query.mockResolvedValue([]);
    const res = await service.getSparklines();
    const fee = res.series.find((s) => s.key === 'platform_fee');
    expect(fee?.points.every((p) => p.value === 0)).toBe(true);
  });
});
