import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardKpiService } from '../services/kpi.service';
import { FeeService } from '../../finance/services/fee.service';
import { MerchantConfig } from '../../merchant/schemas/merchant-config.schema';
// F-081 A1-1 — ICT month boundary (test dispatch match service semantic mới)
import {
  startOfMonthIct,
  toUtcSqlDatetime,
} from '../../../common/utils/ict-date.util';

/**
 * Legacy F-023 specs — preserved for edge-case coverage (delta NULL semantics,
 * DB-error resilience) NOT covered by `kpi.service.f059.spec.ts`.
 *
 * F-059 rework (QC verdict 2026-05-23): updated DI mocks to include FeeService
 * + MerchantConfigModel + Redis token (KpiService now delegates platform_fee
 * compute to FeeService.computeFeeForOrdersAggregate cascade).
 *
 * Each test stubs FeeService to return 0 fee so platform_fee KPI does not
 * interfere with GMV/net/athletes assertions. Pull-orders SQL is mocked via
 * second .mockResolvedValueOnce — KpiService runs two queries per period
 * (agg + pull orders).
 */
const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('DashboardKpiService — legacy edge cases', () => {
  let service: DashboardKpiService;
  let mockDb: { query: jest.Mock };
  let mockRedis: { get: jest.Mock; set: jest.Mock };
  let mockFeeService: { computeFeeForOrdersAggregate: jest.Mock };
  let mockConfigModel: { find: jest.Mock };

  beforeEach(async () => {
    mockDb = { query: jest.fn() };
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
        DashboardKpiService,
        { provide: getDataSourceToken('platform'), useValue: mockDb },
        { provide: REDIS_TOKEN, useValue: mockRedis },
        { provide: FeeService, useValue: mockFeeService },
        { provide: getModelToken(MerchantConfig.name), useValue: mockConfigModel },
      ],
    }).compile();
    service = moduleRef.get(DashboardKpiService);
  });

  /**
   * KpiService issues 2 SQL queries per period:
   *  1. GMV/net/athletes aggregate (SELECT ... FROM order_metadata ... GROUP BY ...)
   *  2. Pull orders for FeeService cascade (SELECT om.id, om.tenant_id ...)
   *
   * Tests below mock both via SQL-pattern dispatch so order does not matter.
   */
  function mockPeriods(curAgg: any, prevAgg: any) {
    // F-081 A1-1 — service giờ dùng ICT month boundary: cur start =
    // toUtcSqlDatetime(startOfMonthIct(now)) vd '2026-05-31 17:00:00' cho
    // tháng 6 ICT. Dispatch exact-match thay vì UTC month prefix.
    const curStartStr = toUtcSqlDatetime(startOfMonthIct(new Date()));
    mockDb.query.mockImplementation(async (sql: string, params: unknown[]) => {
      const isPullOrders = sql.includes('FROM order_metadata om');
      const start = String(params?.[0] ?? '');
      const isCur = start === curStartStr;
      if (isPullOrders) return [];
      return isCur ? [curAgg] : [prevAgg];
    });
  }

  it('happy path: trả về 4 KPI cards với delta', async () => {
    mockPeriods(
      { gmv: 100_000_000, net: 90_000_000, athletes: 500 },
      { gmv: 80_000_000, net: 72_000_000, athletes: 400 },
    );
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

  it("BR-DASH-04: chỉ tính paid orders (SQL có WHERE financial_status=paid)", async () => {
    mockPeriods({ gmv: 0, net: 0, athletes: 0 }, { gmv: 0, net: 0, athletes: 0 });
    await service.getMtdKpis();
    // Both agg + pull-orders queries enforce paid; aggregate is the first
    // dispatch we care about.
    const aggCalls = mockDb.query.mock.calls.filter(
      ([sql]) => !String(sql).includes('FROM order_metadata om'),
    );
    expect(aggCalls.length).toBeGreaterThan(0);
    expect(aggCalls[0][0]).toContain("financial_status = 'paid'");
  });

  it("BR-DASH-04: SQL exclude MANUAL khỏi GMV", async () => {
    mockPeriods({ gmv: 0, net: 0, athletes: 0 }, { gmv: 0, net: 0, athletes: 0 });
    await service.getMtdKpis();
    const aggCalls = mockDb.query.mock.calls.filter(
      ([sql]) => !String(sql).includes('FROM order_metadata om'),
    );
    expect(aggCalls[0][0]).toContain("order_category != 'MANUAL'");
  });

  it('BR-DASH-02 edge: prev=0, cur>0 → delta NULL ("—")', async () => {
    mockPeriods(
      { gmv: 50_000_000, net: 45_000_000, athletes: 100 },
      { gmv: 0, net: 0, athletes: 0 },
    );
    const res = await service.getMtdKpis();
    // GMV/net/athletes — fee delta also NULL because both cur+prev fee = 0
    for (const k of res.kpis) {
      expect(k.deltaPercent).toBeNull();
    }
  });

  it('BR-DASH-02 edge: cur=0 và prev=0 → delta NULL', async () => {
    mockPeriods({ gmv: 0, net: 0, athletes: 0 }, { gmv: 0, net: 0, athletes: 0 });
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
