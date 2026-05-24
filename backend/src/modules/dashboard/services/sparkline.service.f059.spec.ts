/**
 * F-059 — Dashboard Sparkline Cascade Fee Integration tests.
 *
 * Test target: `DashboardSparklineService.compute()` + `refreshCache()` +
 * `getSparklines()` — verifies per-day per-tenant cascade fee delegation +
 * pre-loaded configs + 30-day series shape.
 *
 * TC-59-09 30-day series shape backward compat (gmv + net + athletes +
 *          platform_fee, days=30).
 * TC-59-10 Pre-load configs called 1 time (NOT N times) — verifies batch
 *          query optimization (PAUSE-Coder-03 = A).
 * TC-59-11 Day-level cascade correctness — multi-tenant per day produces
 *          correct daily aggregate.
 * TC-59-12 Cache hit → no DB query, no FeeService call.
 * TC-59-13 Cache MISS → compute + write cache TTL 3600s.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardSparklineService } from './sparkline.service';
import { FeeService } from '../../finance/services/fee.service';
import { MerchantConfig } from '../../merchant/schemas/merchant-config.schema';
import type { AnalyticsFeeAggregateResultDto } from '../../finance/dto/fee-aggregate.dto';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('F-059 — DashboardSparklineService (cascade fee)', () => {
  let service: DashboardSparklineService;
  let mockDb: { query: jest.Mock };
  let mockRedis: { get: jest.Mock; set: jest.Mock };
  let mockFeeService: { computeFeeForOrdersAggregate: jest.Mock };
  let mockConfigModel: { find: jest.Mock };

  function makeFeeResult(totalFee: number): AnalyticsFeeAggregateResultDto {
    return {
      tenantId: 0,
      totalServiceFee: totalFee,
      totalManualFee: 0,
      totalVat: 0,
      totalFee,
      totalNetGmv: 0,
      feeSourceBreakdown: [],
      appliedOverrides: [],
      warnings: [],
    };
  }

  /**
   * Mock DB query routes by SQL signature:
   *  - GROUP BY DATE(payment_on) → daily GMV/net aggregate (queryDaily)
   *  - FROM order_metadata om JOIN races r → pull orders
   */
  function setupDbMock(
    dailyRows: Array<{ d: string; gmv: number; net: number; athletes: number }>,
    orderRows: Array<Record<string, unknown>>,
  ) {
    mockDb.query.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY DATE(payment_on)')) return dailyRows;
      if (sql.includes('FROM order_metadata om')) return orderRows;
      return [];
    });
  }

  async function buildModule() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardSparklineService,
        { provide: getDataSourceToken('platform'), useValue: mockDb },
        { provide: REDIS_TOKEN, useValue: mockRedis },
        { provide: FeeService, useValue: mockFeeService },
        {
          provide: getModelToken(MerchantConfig.name),
          useValue: mockConfigModel,
        },
      ],
    }).compile();
    return module.get(DashboardSparklineService);
  }

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    mockFeeService = {
      computeFeeForOrdersAggregate: jest.fn().mockResolvedValue(makeFeeResult(0)),
    };
    mockConfigModel = {
      find: jest.fn().mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
  });

  // ─── TC-59-09 ──────────────────────────────────────────────────────────
  it('TC-59-09 — 30-day series shape unchanged (4 series: gmv/net/athletes/platform_fee)', async () => {
    setupDbMock([], []);

    service = await buildModule();
    const result = await service.getSparklines();

    expect(result.days).toBe(30);
    expect(result.series).toHaveLength(4);
    const keys = result.series.map((s) => s.key).sort();
    expect(keys).toEqual(['athletes', 'gmv', 'net', 'platform_fee']);
    // Each series 30 points
    for (const series of result.series) {
      expect(series.points).toHaveLength(30);
    }
    // generatedAt valid ISO
    expect(new Date(result.generatedAt).toString()).not.toBe('Invalid Date');
  });

  // ─── TC-59-10 ──────────────────────────────────────────────────────────
  it('TC-59-10 — Pre-load configs called 1 time AND FeeService receives injected config (NOT N internal findOne)', async () => {
    // 3 tenants × 30 days = naive 90 queries; pre-load = 1 query
    const orderRows = [
      { id: 1, tenant_id: 100, race_id: 1, total_price: 1_000_000, total_discounts: 0, order_category: 'ORDINARY', payment_on: '2026-05-01', manual_ticket_count: null },
      { id: 2, tenant_id: 101, race_id: 2, total_price: 2_000_000, total_discounts: 0, order_category: 'ORDINARY', payment_on: '2026-05-02', manual_ticket_count: null },
      { id: 3, tenant_id: 102, race_id: 3, total_price: 3_000_000, total_discounts: 0, order_category: 'ORDINARY', payment_on: '2026-05-03', manual_ticket_count: null },
    ];
    setupDbMock([], orderRows);

    service = await buildModule();
    await service.getSparklines();

    // Critical 1: configModel.find called EXACTLY 1 time (batch query)
    expect(mockConfigModel.find).toHaveBeenCalledTimes(1);
    // And called with $in array of unique tenant IDs
    const findCall = mockConfigModel.find.mock.calls[0][0];
    expect(findCall.tenantId.$in.sort()).toEqual([100, 101, 102]);

    // Critical 2 (F-059 hotfix 2026-05-24): every FeeService call MUST receive
    // an injectedConfig as 4th arg (NOT undefined). This guards against the
    // `void configMap` regression where pre-load was dropped → FeeService
    // internally findOne'd per tenant (N+1).
    expect(mockFeeService.computeFeeForOrdersAggregate).toHaveBeenCalled();
    for (const call of mockFeeService.computeFeeForOrdersAggregate.mock.calls) {
      const injectedConfig = call[3];
      // injectedConfig MUST be passed (not undefined). null is OK (missing config),
      // but undefined means dashboard forgot to inject → FeeService falls back to findOne.
      expect(injectedConfig).not.toBeUndefined();
    }
  });

  // ─── TC-59-11 ──────────────────────────────────────────────────────────
  it('TC-59-11 — Day-level cascade correctness (per-day aggregate from per-tenant FeeService)', async () => {
    // 2 tenants on 2026-05-15 = 1.5M total fee
    const today = new Date();
    const targetDate = today.toISOString().slice(0, 10);
    const orderRows = [
      {
        id: 1,
        tenant_id: 200,
        race_id: 1,
        total_price: 10_000_000,
        total_discounts: 0,
        order_category: 'ORDINARY',
        payment_on: targetDate,
        manual_ticket_count: null,
      },
      {
        id: 2,
        tenant_id: 201,
        race_id: 2,
        total_price: 5_000_000,
        total_discounts: 0,
        order_category: 'ORDINARY',
        payment_on: targetDate,
        manual_ticket_count: null,
      },
    ];
    setupDbMock(
      [{ d: targetDate, gmv: 15_000_000, net: 15_000_000, athletes: 2 }],
      orderRows,
    );

    // tenant 200 → 1M | tenant 201 → 500K | day total = 1.5M
    mockFeeService.computeFeeForOrdersAggregate
      .mockResolvedValueOnce(makeFeeResult(1_000_000))
      .mockResolvedValueOnce(makeFeeResult(500_000))
      .mockResolvedValue(makeFeeResult(0));

    service = await buildModule();
    const result = await service.getSparklines();

    const feeSeries = result.series.find((s) => s.key === 'platform_fee')!;
    // Find target date point (or the last day if target outside range)
    const point = feeSeries.points.find((p) => p.date === targetDate);
    // Acceptable: targetDate may not appear in 30-day exclusive range; fallback:
    // verify total fee across all points = 1.5M (only orders on 1 day)
    const totalFee = feeSeries.points.reduce((s, p) => s + p.value, 0);
    expect(totalFee).toBe(1_500_000);
    if (point) {
      expect(point.value).toBe(1_500_000);
    }
  });

  // ─── TC-59-12 ──────────────────────────────────────────────────────────
  it('TC-59-12 — Cache hit → no DB query, no FeeService call', async () => {
    const cached = {
      series: [
        { key: 'gmv', points: [] },
        { key: 'net', points: [] },
        { key: 'athletes', points: [] },
        { key: 'platform_fee', points: [] },
      ],
      days: 30,
      generatedAt: new Date().toISOString(),
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    service = await buildModule();
    const result = await service.getSparklines();

    expect(result.days).toBe(30);
    expect(mockDb.query).not.toHaveBeenCalled();
    expect(mockFeeService.computeFeeForOrdersAggregate).not.toHaveBeenCalled();
    expect(mockConfigModel.find).not.toHaveBeenCalled();
  });

  // ─── TC-59-13 ──────────────────────────────────────────────────────────
  it('TC-59-13 — Cache MISS → compute + write cache TTL 3600s with key dashboard:sparkline:30d', async () => {
    setupDbMock([], []);

    service = await buildModule();
    await service.getSparklines();

    expect(mockRedis.set).toHaveBeenCalledWith(
      'dashboard:sparkline:30d',
      expect.any(String),
      'EX',
      3600,
    );
  });
});
