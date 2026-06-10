/**
 * F-059 — Dashboard KPI Cascade Fee Integration tests.
 *
 * Test target: `DashboardKpiService.getMtdKpis()` — verifies cascade Tier 0
 * cascade delegation via `FeeService.computeFeeForOrdersAggregate()` PLUS
 * MANUAL fee INCLUDE semantic + KPI cache TTL 60s.
 *
 * TC-59-01 Regression baseline: tenant 5.5% no override + no MANUAL → number
 *          unchanged vs pre-F-059 (mathematical equivalence).
 * TC-59-02 Tenant Tier 0 override 7% rate → fee > 5.5% × net.
 * TC-59-03 Tenant MANUAL-only → fee = manual_fee_per_ticket × ticket_count.
 * TC-59-04 Mix tenant (ORDINARY 6% + MANUAL 5000đ × 100 vé) → aggregate OK.
 * TC-59-05 Multi-tenant aggregate (3 tenants different rates) → sum correct.
 * TC-59-06 KPI cache hit (TTL 60s) → 2nd call serves cached payload.
 * TC-59-07 Cache MISS → cascade compute + write cache.
 * TC-59-08 Zero orders period → platformFee = 0, no FeeService call.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardKpiService } from './kpi.service';
import { FeeService } from '../../finance/services/fee.service';
import { MerchantConfig } from '../../merchant/schemas/merchant-config.schema';
import type { AnalyticsFeeAggregateResultDto } from '../../finance/dto/fee-aggregate.dto';
// F-081 A1-1 — ICT month boundary helpers (match service semantic)
import {
  startOfMonthIct,
  toUtcSqlDatetime,
} from '../../../common/utils/ict-date.util';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

interface MysqlRow {
  id?: number;
  tenant_id?: number;
  race_id?: number;
  total_price?: number;
  total_discounts?: number | null;
  order_category?: string;
  payment_on?: string;
  manual_ticket_count?: number | null;
  // aggregate row
  gmv?: number;
  net?: number;
  athletes?: number;
}

describe('F-059 — DashboardKpiService (cascade fee)', () => {
  let service: DashboardKpiService;
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
   * Build mock that dispatches by SQL pattern (more robust than sequence —
   * Promise.all may interleave cur + prev). The GMV agg query starts with
   * `SELECT\n          COALESCE(SUM(CASE WHEN order_category` while the pull
   * orders query starts with `SELECT\n        om.id,`.
   *
   * Each query is keyed by its start-date param `[start, end]`. Different
   * periods (cur vs prev) use distinct start dates.
   */
  function setupDbMock(
    curAgg: MysqlRow,
    curOrders: MysqlRow[],
    prevAgg: MysqlRow,
    prevOrders: MysqlRow[],
  ) {
    mockDb.query.mockImplementation(async (sql: string, params: unknown[]) => {
      const isPullOrders = sql.includes('FROM order_metadata om');
      const start = String(params?.[0] ?? '');
      // F-081 A1-1 — service dùng ICT month boundary: cur start =
      // toUtcSqlDatetime(startOfMonthIct(now)). Exact-match dispatch.
      const curStartStr = toUtcSqlDatetime(startOfMonthIct(new Date()));
      const isCur = start === curStartStr;

      if (isPullOrders) {
        return isCur ? curOrders : prevOrders;
      }
      // GMV agg
      return isCur ? [curAgg] : [prevAgg];
    });
  }

  async function buildModule() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardKpiService,
        { provide: getDataSourceToken('platform'), useValue: mockDb },
        { provide: REDIS_TOKEN, useValue: mockRedis },
        { provide: FeeService, useValue: mockFeeService },
        {
          provide: getModelToken(MerchantConfig.name),
          useValue: mockConfigModel,
        },
      ],
    }).compile();
    return module.get(DashboardKpiService);
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

  // ─── TC-59-01 ──────────────────────────────────────────────────────────
  it('TC-59-01 Regression baseline — tenant no override + no MANUAL → fee = net × 5.5%', async () => {
    // Single tenant, single ORDINARY order net=100M
    const curOrders = [
      {
        id: 1,
        tenant_id: 100,
        race_id: 999,
        total_price: 100_000_000,
        total_discounts: 0,
        order_category: 'ORDINARY',
        payment_on: '2026-05-15',
        manual_ticket_count: null,
      },
    ];
    setupDbMock(
      { gmv: 100_000_000, net: 100_000_000, athletes: 1 },
      curOrders,
      { gmv: 0, net: 0, athletes: 0 },
      [],
    );

    // FeeService returns 100M × 5.5% = 5,500,000 (mathematical equivalence pre-F-059)
    mockFeeService.computeFeeForOrdersAggregate.mockResolvedValue(
      makeFeeResult(5_500_000),
    );

    service = await buildModule();
    const result = await service.getMtdKpis();

    const feeCard = result.kpis.find((k) => k.key === 'platform_fee');
    expect(feeCard).toBeDefined();
    expect(feeCard!.value).toBe(5_500_000);
    expect(feeCard!.prevValue).toBe(0);
    // Display GMV/Net unchanged
    expect(result.kpis.find((k) => k.key === 'gmv')!.value).toBe(100_000_000);
    expect(result.kpis.find((k) => k.key === 'net')!.value).toBe(100_000_000);
  });

  // ─── TC-59-02 ──────────────────────────────────────────────────────────
  it('TC-59-02 — Tenant Tier 0 override 7% → fee > flat 5.5%', async () => {
    const curOrders = [
      {
        id: 1,
        tenant_id: 101,
        race_id: 12345,
        total_price: 50_000_000,
        total_discounts: 0,
        order_category: 'ORDINARY',
        payment_on: '2026-05-15',
        manual_ticket_count: null,
      },
    ];
    setupDbMock(
      { gmv: 50_000_000, net: 50_000_000, athletes: 1 },
      curOrders,
      { gmv: 0, net: 0, athletes: 0 },
      [],
    );

    // 50M × 7% = 3,500,000
    mockFeeService.computeFeeForOrdersAggregate.mockResolvedValue(
      makeFeeResult(3_500_000),
    );

    service = await buildModule();
    const result = await service.getMtdKpis();

    const fee = result.kpis.find((k) => k.key === 'platform_fee')!.value;
    expect(fee).toBe(3_500_000);
    // SAI nếu hardcode 5.5% → would be 2,750,000
    expect(fee).toBeGreaterThan(50_000_000 * 0.055);
  });

  // ─── TC-59-03 ──────────────────────────────────────────────────────────
  it('TC-59-03 — MANUAL-only tenant → fee VND-based, gmv=0', async () => {
    const curOrders = [
      {
        id: 1,
        tenant_id: 102,
        race_id: 999,
        total_price: 0,
        total_discounts: 0,
        order_category: 'MANUAL',
        payment_on: '2026-05-15',
        manual_ticket_count: 100,
      },
    ];
    // GMV agg exclude MANUAL → 0
    setupDbMock(
      { gmv: 0, net: 0, athletes: 0 },
      curOrders,
      { gmv: 0, net: 0, athletes: 0 },
      [],
    );

    // 100 × 5000đ = 500_000
    mockFeeService.computeFeeForOrdersAggregate.mockResolvedValue({
      tenantId: 102,
      totalServiceFee: 0,
      totalManualFee: 500_000,
      totalVat: 0,
      totalFee: 500_000,
      totalNetGmv: 0,
      feeSourceBreakdown: [],
      appliedOverrides: [],
      warnings: [],
    });

    service = await buildModule();
    const result = await service.getMtdKpis();

    expect(result.kpis.find((k) => k.key === 'gmv')!.value).toBe(0);
    expect(result.kpis.find((k) => k.key === 'platform_fee')!.value).toBe(500_000);
    // MUST: fee > GMV × 5.5% (semantic confusion test — VND-based)
    expect(result.kpis.find((k) => k.key === 'platform_fee')!.value).toBeGreaterThan(0);
  });

  // ─── TC-59-04 ──────────────────────────────────────────────────────────
  it('TC-59-04 Mix — ORDINARY 6% + MANUAL 100 vé × 5000đ → aggregate OK', async () => {
    const curOrders = [
      {
        id: 1,
        tenant_id: 103,
        race_id: 555,
        total_price: 30_000_000,
        total_discounts: 0,
        order_category: 'ORDINARY',
        payment_on: '2026-05-10',
        manual_ticket_count: null,
      },
      {
        id: 2,
        tenant_id: 103,
        race_id: 555,
        total_price: 0,
        total_discounts: 0,
        order_category: 'MANUAL',
        payment_on: '2026-05-12',
        manual_ticket_count: 100,
      },
    ];
    setupDbMock(
      { gmv: 30_000_000, net: 30_000_000, athletes: 1 },
      curOrders,
      { gmv: 0, net: 0, athletes: 0 },
      [],
    );

    // 30M × 6% + 100 × 5000 = 1.8M + 500K = 2.3M
    mockFeeService.computeFeeForOrdersAggregate.mockResolvedValue({
      tenantId: 103,
      totalServiceFee: 1_800_000,
      totalManualFee: 500_000,
      totalVat: 0,
      totalFee: 2_300_000,
      totalNetGmv: 30_000_000,
      feeSourceBreakdown: [],
      appliedOverrides: [],
      warnings: [],
    });

    service = await buildModule();
    const result = await service.getMtdKpis();
    expect(result.kpis.find((k) => k.key === 'platform_fee')!.value).toBe(2_300_000);
    expect(result.kpis.find((k) => k.key === 'gmv')!.value).toBe(30_000_000);
  });

  // ─── TC-59-05 ──────────────────────────────────────────────────────────
  it('TC-59-05 — Multi-tenant aggregate (3 tenants different rates) → sum correct', async () => {
    const curOrders = [
      // tenant 200: ORDINARY 5%
      {
        id: 1,
        tenant_id: 200,
        race_id: 1,
        total_price: 20_000_000,
        total_discounts: 0,
        order_category: 'ORDINARY',
        payment_on: '2026-05-10',
        manual_ticket_count: null,
      },
      // tenant 201: ORDINARY 7% (override)
      {
        id: 2,
        tenant_id: 201,
        race_id: 2,
        total_price: 10_000_000,
        total_discounts: 0,
        order_category: 'ORDINARY',
        payment_on: '2026-05-10',
        manual_ticket_count: null,
      },
      // tenant 202: MANUAL only
      {
        id: 3,
        tenant_id: 202,
        race_id: 3,
        total_price: 0,
        total_discounts: 0,
        order_category: 'MANUAL',
        payment_on: '2026-05-10',
        manual_ticket_count: 50,
      },
    ];
    setupDbMock(
      { gmv: 30_000_000, net: 30_000_000, athletes: 2 },
      curOrders,
      { gmv: 0, net: 0, athletes: 0 },
      [],
    );

    // tenant 200: 1_000_000 | tenant 201: 700_000 | tenant 202: 250_000 → 1.95M
    mockFeeService.computeFeeForOrdersAggregate
      .mockResolvedValueOnce(makeFeeResult(1_000_000))
      .mockResolvedValueOnce(makeFeeResult(700_000))
      .mockResolvedValueOnce(makeFeeResult(250_000))
      .mockResolvedValue(makeFeeResult(0));

    service = await buildModule();
    const result = await service.getMtdKpis();
    expect(result.kpis.find((k) => k.key === 'platform_fee')!.value).toBe(1_950_000);
    // Verify FeeService called per-tenant (3 distinct tenants)
    expect(mockFeeService.computeFeeForOrdersAggregate).toHaveBeenCalledTimes(3);
  });

  // ─── TC-59-06 ──────────────────────────────────────────────────────────
  it('TC-59-06 — KPI cache hit (TTL 60s) → no DB query', async () => {
    const cachedPayload = {
      kpis: [
        { key: 'gmv', label: 'GMV tháng này', value: 100, prevValue: 50, deltaPercent: 100, unit: 'vnd' },
        { key: 'net', label: 'Doanh thu net', value: 90, prevValue: 45, deltaPercent: 100, unit: 'vnd' },
        { key: 'athletes', label: 'VĐV đăng ký', value: 1, prevValue: 0, deltaPercent: null, unit: 'count' },
        { key: 'platform_fee', label: 'Phí 5BIB', value: 9, prevValue: 4, deltaPercent: 125, unit: 'vnd' },
      ],
      period: 'mtd',
      periodStart: '2026-05-01T00:00:00.000Z',
      prevPeriodStart: '2026-04-01T00:00:00.000Z',
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedPayload));

    service = await buildModule();
    const result = await service.getMtdKpis();

    expect(result.kpis[0].value).toBe(100);
    // CRITICAL: cache hit → ZERO DB query + ZERO FeeService call
    expect(mockDb.query).not.toHaveBeenCalled();
    expect(mockFeeService.computeFeeForOrdersAggregate).not.toHaveBeenCalled();
  });

  // ─── TC-59-07 ──────────────────────────────────────────────────────────
  it('TC-59-07 — Cache MISS → cascade compute + write cache (TTL 60s)', async () => {
    setupDbMock(
      { gmv: 0, net: 0, athletes: 0 },
      [],
      { gmv: 0, net: 0, athletes: 0 },
      [],
    );

    service = await buildModule();
    await service.getMtdKpis();

    // Cache write called with key + TTL 60s
    expect(mockRedis.set).toHaveBeenCalledWith(
      'dashboard:kpi:mtd',
      expect.any(String),
      'EX',
      60,
    );
  });

  // ─── TC-59-08 ──────────────────────────────────────────────────────────
  it('TC-59-08 — Zero orders period → fee=0, no FeeService call', async () => {
    setupDbMock(
      { gmv: 0, net: 0, athletes: 0 },
      [],
      { gmv: 0, net: 0, athletes: 0 },
      [],
    );

    service = await buildModule();
    const result = await service.getMtdKpis();

    expect(result.kpis.find((k) => k.key === 'platform_fee')!.value).toBe(0);
    expect(mockFeeService.computeFeeForOrdersAggregate).not.toHaveBeenCalled();
  });

  // ─── TC-59-09 ──────────────────────────────────────────────────────────
  // F-059 hotfix 2026-05-24: verify pre-loaded MerchantConfig is INJECTED into
  // FeeService (4th arg) instead of being silently dropped (`void configMap`).
  // Without this assertion, FeeService falls back to internal findOne per tenant
  // → N+1 query regression. KPI: 58 tenants × 1 call = 58 findOne vs 1 batch $in.
  it('TC-59-09 — Pre-loaded config injected into FeeService (NOT N internal findOne)', async () => {
    const curAgg = { gmv: 100_000_000, net: 100_000_000, athletes: 100 };
    const curOrders = [
      { id: 1, tenant_id: 200, race_id: 1, total_price: 50_000_000, total_discounts: 0, order_category: 'ORDINARY', payment_on: '2026-05-10', manual_ticket_count: null },
      { id: 2, tenant_id: 201, race_id: 2, total_price: 50_000_000, total_discounts: 0, order_category: 'ORDINARY', payment_on: '2026-05-11', manual_ticket_count: null },
    ];
    setupDbMock(curAgg, curOrders, { gmv: 0, net: 0, athletes: 0 }, []);

    mockFeeService.computeFeeForOrdersAggregate.mockResolvedValue(makeFeeResult(2_750_000));

    service = await buildModule();
    await service.getMtdKpis();

    // Critical 1: mockConfigModel.find called EXACTLY 1 time (batch $in pre-load).
    expect(mockConfigModel.find).toHaveBeenCalledTimes(1);

    // Critical 2: every FeeService call MUST receive 4th arg (NOT undefined).
    expect(mockFeeService.computeFeeForOrdersAggregate).toHaveBeenCalled();
    for (const call of mockFeeService.computeFeeForOrdersAggregate.mock.calls) {
      const injectedConfig = call[3];
      // null is OK (tenant has no config row); undefined means dashboard forgot
      // to inject → FeeService falls back to internal findOne (regression).
      expect(injectedConfig).not.toBeUndefined();
    }
  });
});
