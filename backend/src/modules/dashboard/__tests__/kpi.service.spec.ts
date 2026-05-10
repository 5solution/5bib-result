import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DashboardKpiService } from '../services/kpi.service';

describe('DashboardKpiService', () => {
  let service: DashboardKpiService;
  let mockDb: { query: jest.Mock };

  beforeEach(async () => {
    mockDb = { query: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardKpiService,
        { provide: getDataSourceToken('platform'), useValue: mockDb },
      ],
    }).compile();
    service = moduleRef.get(DashboardKpiService);
  });

  it('happy path: trả về 4 KPI cards với delta', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ gmv: 100_000_000, net: 90_000_000, athletes: 500 }])
      .mockResolvedValueOnce([{ gmv: 80_000_000, net: 72_000_000, athletes: 400 }]);
    const res = await service.getMtdKpis();
    expect(res.kpis).toHaveLength(4);
    expect(res.kpis.map((k) => k.key)).toEqual([
      'gmv',
      'net',
      'athletes',
      'platform_fee',
    ]);
    const gmv = res.kpis.find((k) => k.key === 'gmv');
    expect(gmv?.value).toBe(100_000_000);
    expect(gmv?.prevValue).toBe(80_000_000);
    expect(gmv?.deltaPercent).toBeCloseTo(25, 1);
    expect(res.period).toBe('mtd');
  });

  it('BR-DASH-04: chỉ tính paid orders (SQL có WHERE financial_status=paid)', async () => {
    mockDb.query.mockResolvedValue([{ gmv: 0, net: 0, athletes: 0 }]);
    await service.getMtdKpis();
    const sql = mockDb.query.mock.calls[0][0] as string;
    expect(sql).toContain("financial_status = 'paid'");
  });

  it('BR-DASH-04: SQL exclude MANUAL khỏi GMV', async () => {
    mockDb.query.mockResolvedValue([{ gmv: 0, net: 0, athletes: 0 }]);
    await service.getMtdKpis();
    const sql = mockDb.query.mock.calls[0][0] as string;
    expect(sql).toContain("order_category != 'MANUAL'");
  });

  it('BR-DASH-02 edge: prev=0, cur>0 → delta NULL ("—")', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ gmv: 50_000_000, net: 45_000_000, athletes: 100 }])
      .mockResolvedValueOnce([{ gmv: 0, net: 0, athletes: 0 }]);
    const res = await service.getMtdKpis();
    for (const k of res.kpis) {
      expect(k.deltaPercent).toBeNull();
    }
  });

  it('BR-DASH-02 edge: cur=0 và prev=0 → delta NULL', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ gmv: 0, net: 0, athletes: 0 }])
      .mockResolvedValueOnce([{ gmv: 0, net: 0, athletes: 0 }]);
    const res = await service.getMtdKpis();
    for (const k of res.kpis) {
      expect(k.deltaPercent).toBeNull();
    }
  });

  it('Resilient: DB lỗi → trả 0 không throw', async () => {
    mockDb.query.mockRejectedValue(new Error('mysql down'));
    const res = await service.getMtdKpis();
    expect(res.kpis.every((k) => k.value === 0)).toBe(true);
  });
});
