/**
 * F-058 — Analytics Cascade Fee Integration tests.
 *
 * Test target: `FeeService.computeFeeForOrdersAggregate()` — the core method
 * powering F-058. Direct service-level testing (lighter than full Analytics
 * NestJS context, faster, deterministic).
 *
 * TC-58-01: Clean tenant no override → output unchanged baseline
 * TC-58-02: Tier 0 service_fee_rate override applied
 * TC-58-03: Per-order pro-rate theo created_at vs effective_from
 * TC-58-04: Per-field cascade independent (rate Tier 0, manual Tier 1, vat Tier 1)
 * TC-58-05: Override absent / wrong race → Tier 1 fallback
 * TC-58-06: Legacy tenant no MerchantConfig → Tier 3 platform default 5.5%
 * TC-58-07: effective_from boundary inclusive
 * TC-58-08: MANUAL category uses manual_fee_per_ticket (not rate)
 * TC-58-09: Multi-race aggregate — orders mixed across races
 * TC-58-10: Idempotent — same input → same output
 *
 * Endpoint-level verdict coverage (F-058 BR-58-08/09 — added per QC rework 2026-05-22):
 * TC-58-11: MATCH verdict       — analytics ≈ reconciliation (deltaPct ≤ 0.1%)
 * TC-58-12: MINOR_DRIFT verdict — 0.1% < deltaPct < 1%
 * TC-58-13: MAJOR_DRIFT verdict — deltaPct ≥ 1% (finance escalate)
 * TC-58-14: NO_RECONCILIATION   — reconciliation chưa tạo cho period
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { getDataSourceToken } from '@nestjs/typeorm';
import { FeeService } from '../finance/services/fee.service';
import { MerchantConfig } from '../merchant/schemas/merchant-config.schema';
import { Reconciliation } from '../reconciliation/schemas/reconciliation.schema';
import { OrderReadonly } from '../finance/entities/order-readonly.entity';
import { Tenant } from '../merchant/entities/tenant.entity';
import { AnalyticsService } from './analytics.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import type { OrderForFeeAggregate } from '../finance/dto/fee-aggregate.dto';

describe('F-058 — FeeService.computeFeeForOrdersAggregate (Analytics cascade)', () => {
  let service: FeeService;
  let configModel: { findOne: jest.Mock };

  /** Build minimal MerchantConfig stub */
  function buildConfig(opts: {
    tenantId?: number;
    service_fee_rate?: number | null;
    manual_fee_per_ticket?: number;
    fee_vat_rate?: number;
    event_fee_overrides?: Array<{
      raceId: number;
      service_fee_rate?: number | null;
      manual_fee_per_ticket?: number | null;
      fee_vat_rate?: number | null;
      effective_from: string;
    }>;
  } = {}) {
    return {
      tenantId: opts.tenantId ?? 100,
      service_fee_rate: opts.service_fee_rate ?? 5,
      manual_fee_per_ticket: opts.manual_fee_per_ticket ?? 5000,
      fee_vat_rate: opts.fee_vat_rate ?? 0,
      event_fee_overrides: opts.event_fee_overrides ?? [],
    };
  }

  function buildOrder(o: Partial<OrderForFeeAggregate>): OrderForFeeAggregate {
    return {
      id: o.id ?? 1,
      raceId: o.raceId ?? 12345,
      totalPrice: o.totalPrice ?? 10_000_000,
      totalDiscounts: o.totalDiscounts ?? 0,
      orderCategory: o.orderCategory ?? 'ORDINARY',
      createdAt: o.createdAt ?? '2026-06-15',
      manualTicketCount: o.manualTicketCount,
    };
  }

  function makeMockConfigModel(initial: ReturnType<typeof buildConfig> | null) {
    return {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(initial),
        }),
      }),
    };
  }

  async function buildModule(configMock: { findOne: jest.Mock }) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeService,
        { provide: getRepositoryToken(OrderReadonly, 'platform'), useValue: null },
        { provide: getRepositoryToken(Tenant, 'platform'), useValue: null },
        { provide: getModelToken(MerchantConfig.name), useValue: configMock },
        { provide: 'default_IORedisModuleConnectionToken', useValue: null },
      ],
    }).compile();
    return module.get(FeeService);
  }

  beforeEach(() => {
    configModel = makeMockConfigModel(null);
  });

  // ─── TC-58-01 ──────────────────────────────────────────────────────────
  it('TC-58-01 — Clean tenant no override → applies Tier 1 merchant default 5%', async () => {
    configModel = makeMockConfigModel(buildConfig({ tenantId: 100 }));
    service = await buildModule(configModel);

    const orders = [
      buildOrder({ id: 1, raceId: 999, totalPrice: 50_000_000, createdAt: '2026-06-10' }),
      buildOrder({ id: 2, raceId: 999, totalPrice: 50_000_000, createdAt: '2026-06-20' }),
    ];
    const result = await service.computeFeeForOrdersAggregate(100, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    // 100M × 5% = 5,000,000
    expect(result.totalServiceFee).toBe(5_000_000);
    expect(result.totalManualFee).toBe(0);
    expect(result.totalVat).toBe(0);
    expect(result.totalFee).toBe(5_000_000);
    expect(result.feeSourceBreakdown).toEqual([
      { source: 'merchant_default', totalFee: 5_000_000, orderCount: 2 },
    ]);
    expect(result.appliedOverrides).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  // ─── TC-58-02 ──────────────────────────────────────────────────────────
  it('TC-58-02 — Tier 0 service_fee_rate override applied (7% beats 5%)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 101,
        service_fee_rate: 5,
        event_fee_overrides: [
          {
            raceId: 12345,
            service_fee_rate: 7,
            manual_fee_per_ticket: null,
            fee_vat_rate: null,
            effective_from: '2026-06-01',
          },
        ],
      }),
    );
    service = await buildModule(configModel);

    const orders = [
      buildOrder({ id: 1, raceId: 12345, totalPrice: 50_000_000, createdAt: '2026-06-15' }),
    ];
    const result = await service.computeFeeForOrdersAggregate(101, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    // 50M × 7% = 3,500,000
    expect(result.totalServiceFee).toBe(3_500_000);
    expect(result.feeSourceBreakdown[0].source).toBe('event_override');
    expect(result.appliedOverrides).toEqual([
      {
        raceId: 12345,
        field: 'service_fee_rate',
        value: 7,
        effectiveFrom: '2026-06-01',
      },
    ]);
  });

  // ─── TC-58-03 ──────────────────────────────────────────────────────────
  it('TC-58-03 — Per-order pro-rate: order before effective_from → default, after → override', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 102,
        service_fee_rate: 5,
        event_fee_overrides: [
          {
            raceId: 200,
            service_fee_rate: 10,
            manual_fee_per_ticket: null,
            fee_vat_rate: null,
            effective_from: '2026-06-15',
          },
        ],
      }),
    );
    service = await buildModule(configModel);

    const orders = [
      // 2 orders trước effective_from (5%)
      buildOrder({ id: 1, raceId: 200, totalPrice: 25_000_000, createdAt: '2026-06-10' }),
      buildOrder({ id: 2, raceId: 200, totalPrice: 25_000_000, createdAt: '2026-06-10' }),
      // 2 orders sau effective_from (10%)
      buildOrder({ id: 3, raceId: 200, totalPrice: 25_000_000, createdAt: '2026-06-20' }),
      buildOrder({ id: 4, raceId: 200, totalPrice: 25_000_000, createdAt: '2026-06-20' }),
    ];
    const result = await service.computeFeeForOrdersAggregate(102, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    // 50M × 5% + 50M × 10% = 2.5M + 5M = 7,500,000
    expect(result.totalServiceFee).toBe(7_500_000);
    expect(result.feeSourceBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'merchant_default', orderCount: 2 }),
        expect.objectContaining({ source: 'event_override', orderCount: 2 }),
      ]),
    );
  });

  // ─── TC-58-04 ──────────────────────────────────────────────────────────
  it('TC-58-04 — Per-field cascade independent (rate Tier 0, manual Tier 1, vat Tier 1)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 103,
        service_fee_rate: 5,
        manual_fee_per_ticket: 5000,
        fee_vat_rate: 10,
        event_fee_overrides: [
          {
            raceId: 300,
            service_fee_rate: 7, // override
            manual_fee_per_ticket: null, // fallback Tier 1
            fee_vat_rate: null, // fallback Tier 1
            effective_from: '2026-06-01',
          },
        ],
      }),
    );
    service = await buildModule(configModel);

    const orders = [
      // 10 paid ORDINARY = 30M net_gmv (3M each)
      ...Array.from({ length: 10 }, (_, i) =>
        buildOrder({
          id: i + 1,
          raceId: 300,
          totalPrice: 3_000_000,
          orderCategory: 'ORDINARY',
          createdAt: '2026-06-15',
        }),
      ),
      // 5 MANUAL orders with 2 tickets each = 10 tickets total
      ...Array.from({ length: 5 }, (_, i) =>
        buildOrder({
          id: i + 11,
          raceId: 300,
          totalPrice: 0,
          orderCategory: 'MANUAL',
          manualTicketCount: 2,
          createdAt: '2026-06-15',
        }),
      ),
    ];
    const result = await service.computeFeeForOrdersAggregate(103, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    // service_fee = 30M × 7% = 2,100,000 (Tier 0)
    // manual_fee = 10 × 5000 = 50,000 (Tier 1)
    // vat = 2.1M × 10% = 210,000 (Tier 1 vat applied on service_fee)
    expect(result.totalServiceFee).toBe(2_100_000);
    expect(result.totalManualFee).toBe(50_000);
    expect(result.totalVat).toBe(210_000);
    expect(result.totalFee).toBe(2_360_000);
  });

  // ─── TC-58-05 ──────────────────────────────────────────────────────────
  it('TC-58-05 — Override absent for race → Tier 1 fallback', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 104,
        service_fee_rate: 5,
        event_fee_overrides: [
          {
            raceId: 400,
            service_fee_rate: 10,
            manual_fee_per_ticket: null,
            fee_vat_rate: null,
            effective_from: '2026-06-01',
          },
        ],
      }),
    );
    service = await buildModule(configModel);

    // Query race 500 — không có override
    const orders = [
      buildOrder({ id: 1, raceId: 500, totalPrice: 100_000_000, createdAt: '2026-06-15' }),
    ];
    const result = await service.computeFeeForOrdersAggregate(104, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    // 100M × 5% = 5,000,000 (Tier 1)
    expect(result.totalServiceFee).toBe(5_000_000);
    expect(result.feeSourceBreakdown[0].source).toBe('merchant_default');
  });

  // ─── TC-58-06 ──────────────────────────────────────────────────────────
  it('TC-58-06 — Legacy tenant no MerchantConfig → Tier 3 platform default 5.5%', async () => {
    configModel = makeMockConfigModel(null); // no config
    service = await buildModule(configModel);

    const orders = [
      buildOrder({ id: 1, raceId: 999, totalPrice: 10_000_000, createdAt: '2026-06-15' }),
    ];
    const result = await service.computeFeeForOrdersAggregate(105, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    // 10M × 5.5% = 550,000
    expect(result.totalServiceFee).toBe(550_000);
    expect(result.feeSourceBreakdown[0].source).toBe('platform_default');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Tier 3');
  });

  // ─── TC-58-07 ──────────────────────────────────────────────────────────
  it('TC-58-07 — effective_from boundary inclusive (order created on effective_from gets override)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 106,
        service_fee_rate: 5,
        event_fee_overrides: [
          {
            raceId: 600,
            service_fee_rate: 10,
            manual_fee_per_ticket: null,
            fee_vat_rate: null,
            effective_from: '2026-06-15',
          },
        ],
      }),
    );
    service = await buildModule(configModel);

    const orders = [
      // Order A — created on effective_from day → áp override
      buildOrder({ id: 1, raceId: 600, totalPrice: 10_000_000, createdAt: '2026-06-15' }),
      // Order B — created day before → áp default
      buildOrder({ id: 2, raceId: 600, totalPrice: 10_000_000, createdAt: '2026-06-14' }),
    ];
    const result = await service.computeFeeForOrdersAggregate(106, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    // Order A: 10M × 10% = 1M (override)
    // Order B: 10M × 5% = 500k (default)
    expect(result.totalServiceFee).toBe(1_500_000);
  });

  // ─── TC-58-08 ──────────────────────────────────────────────────────────
  it('TC-58-08 — MANUAL category uses manual_fee_per_ticket (not rate)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 107,
        service_fee_rate: 5,
        manual_fee_per_ticket: 5000,
        event_fee_overrides: [
          {
            raceId: 700,
            service_fee_rate: null,
            manual_fee_per_ticket: 8000, // override manual fee
            fee_vat_rate: null,
            effective_from: '2026-06-01',
          },
        ],
      }),
    );
    service = await buildModule(configModel);

    const orders = [
      buildOrder({
        id: 1,
        raceId: 700,
        totalPrice: 0,
        orderCategory: 'MANUAL',
        manualTicketCount: 10,
        createdAt: '2026-06-15',
      }),
    ];
    const result = await service.computeFeeForOrdersAggregate(107, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    // 10 tickets × 8000 = 80,000 (Tier 0 manual override)
    expect(result.totalManualFee).toBe(80_000);
    expect(result.totalServiceFee).toBe(0);
    expect(result.appliedOverrides).toEqual([
      {
        raceId: 700,
        field: 'manual_fee_per_ticket',
        value: 8000,
        effectiveFrom: '2026-06-01',
      },
    ]);
  });

  // ─── TC-58-09 ──────────────────────────────────────────────────────────
  it('TC-58-09 — Multi-race aggregate — mix orders, mix sources, correct total', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 108,
        service_fee_rate: 5,
        event_fee_overrides: [
          {
            raceId: 800,
            service_fee_rate: 8,
            manual_fee_per_ticket: null,
            fee_vat_rate: null,
            effective_from: '2026-06-01',
          },
        ],
      }),
    );
    service = await buildModule(configModel);

    const orders = [
      buildOrder({ id: 1, raceId: 800, totalPrice: 50_000_000, createdAt: '2026-06-15' }),
      buildOrder({ id: 2, raceId: 801, totalPrice: 50_000_000, createdAt: '2026-06-15' }),
    ];
    const result = await service.computeFeeForOrdersAggregate(108, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    // Race 800: 50M × 8% = 4M (override)
    // Race 801: 50M × 5% = 2.5M (default)
    expect(result.totalServiceFee).toBe(6_500_000);
    expect(result.feeSourceBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'event_override', orderCount: 1, totalFee: 4_000_000 }),
        expect.objectContaining({ source: 'merchant_default', orderCount: 1, totalFee: 2_500_000 }),
      ]),
    );
  });

  // ─── TC-58-10 ──────────────────────────────────────────────────────────
  it('TC-58-10 — Idempotent: same input → same output (read-only, no side effect)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 109,
        service_fee_rate: 6,
        event_fee_overrides: [
          {
            raceId: 900,
            service_fee_rate: 7,
            manual_fee_per_ticket: null,
            fee_vat_rate: null,
            effective_from: '2026-06-01',
          },
        ],
      }),
    );
    service = await buildModule(configModel);

    const orders = [
      buildOrder({ id: 1, raceId: 900, totalPrice: 10_000_000, createdAt: '2026-06-15' }),
    ];
    const r1 = await service.computeFeeForOrdersAggregate(109, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });
    const r2 = await service.computeFeeForOrdersAggregate(109, orders, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    expect(r1).toEqual(r2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// F-058 — AnalyticsService.getDiscrepancyCheck() endpoint verdict tests
// (BR-58-08/09 — added per QC rework 2026-05-22)
//
// Thresholds (per analytics.service.ts:1226-1227):
//   - MATCH        : |delta| ≤ 1000 VND  OR  |pct| ≤ 0.1%
//   - MINOR_DRIFT  : 0.1% < pct < 1%
//   - MAJOR_DRIFT  : pct ≥ 1%
//   - NO_RECONCILIATION : reconCount === 0
// ────────────────────────────────────────────────────────────────────────────
describe('F-058 — AnalyticsService.getDiscrepancyCheck (4 verdict branches)', () => {
  let analyticsService: AnalyticsService;
  let reconciliationService: { getTotalsByTenantMonth: jest.Mock };
  let feeService: { computeFeeForOrdersAggregate: jest.Mock };

  function buildAnalyticsResult(totalFee: number) {
    return {
      totalServiceFee: totalFee,
      totalManualFee: 0,
      totalVat: 0,
      totalFee,
      feeSourceBreakdown: [],
      appliedOverrides: [],
      warnings: [],
    };
  }

  function buildReconTotals(opts: { totalFee?: number; reconCount?: number }) {
    return {
      totalServiceFee: opts.totalFee ?? 0,
      totalManualFee: 0,
      totalVat: 0,
      totalFee: opts.totalFee ?? 0,
      totalNetGmv: 0,
      reconCount: opts.reconCount ?? 1,
      reconciliationIds: opts.reconCount && opts.reconCount > 0 ? ['recon-abc'] : [],
    };
  }

  async function buildAnalyticsModule(opts: {
    analyticsTotalFee: number;
    reconTotalFee: number;
    reconCount: number;
  }) {
    feeService = {
      computeFeeForOrdersAggregate: jest
        .fn()
        .mockResolvedValue(buildAnalyticsResult(opts.analyticsTotalFee)),
    };
    reconciliationService = {
      getTotalsByTenantMonth: jest.fn().mockResolvedValue(
        buildReconTotals({
          totalFee: opts.reconTotalFee,
          reconCount: opts.reconCount,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getDataSourceToken('platform'), useValue: { query: jest.fn().mockResolvedValue([]) } },
        { provide: getModelToken(MerchantConfig.name), useValue: { findOne: jest.fn() } },
        { provide: getModelToken(Reconciliation.name), useValue: { find: jest.fn() } },
        { provide: 'default_IORedisModuleConnectionToken', useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') } },
        { provide: FeeService, useValue: feeService },
        { provide: ReconciliationService, useValue: reconciliationService },
      ],
    }).compile();
    return module.get(AnalyticsService);
  }

  // ─── TC-58-11 ──────────────────────────────────────────────────────────
  it('TC-58-11 — MATCH verdict: analytics ≈ reconciliation (deltaPct ≤ 0.1%)', async () => {
    // analytics 10,000,500 vs recon 10,000,000 → delta 500 VND, pct = 0.005% (≤ 0.1%)
    analyticsService = await buildAnalyticsModule({
      analyticsTotalFee: 10_000_500,
      reconTotalFee: 10_000_000,
      reconCount: 1,
    });

    const result = await analyticsService.getDiscrepancyCheck({
      tenantId: 100,
      month: '2026-04',
    });

    expect(result.verdict).toBe('MATCH');
    expect(result.delta?.absVnd).toBe(500);
    expect(result.delta?.pctOfReconciliation).toBeCloseTo(0.01, 2);
    expect(result.thresholdAbsVnd).toBe(1000);
    expect(result.thresholdPct).toBe(0.1);
    expect(reconciliationService.getTotalsByTenantMonth).toHaveBeenCalledWith(100, '2026-04');
  });

  // ─── TC-58-12 ──────────────────────────────────────────────────────────
  it('TC-58-12 — MINOR_DRIFT verdict: 0.1% < deltaPct < 1%', async () => {
    // analytics 10,050,000 vs recon 10,000,000 → delta 50,000 VND, pct = 0.5% (in (0.1%, 1%))
    analyticsService = await buildAnalyticsModule({
      analyticsTotalFee: 10_050_000,
      reconTotalFee: 10_000_000,
      reconCount: 1,
    });

    const result = await analyticsService.getDiscrepancyCheck({
      tenantId: 101,
      month: '2026-04',
    });

    expect(result.verdict).toBe('MINOR_DRIFT');
    expect(result.delta?.absVnd).toBe(50_000);
    expect(result.delta?.pctOfReconciliation).toBeCloseTo(0.5, 2);
  });

  // ─── TC-58-13 ──────────────────────────────────────────────────────────
  it('TC-58-13 — MAJOR_DRIFT verdict: deltaPct ≥ 1% (finance escalate)', async () => {
    // analytics 10,500,000 vs recon 10,000,000 → delta 500,000 VND, pct = 5% (≥ 1%)
    analyticsService = await buildAnalyticsModule({
      analyticsTotalFee: 10_500_000,
      reconTotalFee: 10_000_000,
      reconCount: 1,
    });

    const result = await analyticsService.getDiscrepancyCheck({
      tenantId: 102,
      month: '2026-04',
    });

    expect(result.verdict).toBe('MAJOR_DRIFT');
    expect(result.delta?.absVnd).toBe(500_000);
    expect(result.delta?.pctOfReconciliation).toBeCloseTo(5, 2);
    expect(result.reconciliationAggregate.reconCount).toBe(1);
  });

  // ─── TC-58-14 ──────────────────────────────────────────────────────────
  it('TC-58-14 — NO_RECONCILIATION verdict: reconciliation chưa tạo cho period', async () => {
    // reconCount = 0 → short-circuit verdict, delta = null
    analyticsService = await buildAnalyticsModule({
      analyticsTotalFee: 12_345_000,
      reconTotalFee: 0,
      reconCount: 0,
    });

    const result = await analyticsService.getDiscrepancyCheck({
      tenantId: 103,
      month: '2026-04',
    });

    expect(result.verdict).toBe('NO_RECONCILIATION');
    expect(result.delta).toBeNull();
    expect(result.reconciliationAggregate.reconCount).toBe(0);
    expect(result.reconciliationAggregate.reconciliationIds).toEqual([]);
    expect(result.analyticsAggregate.totalFee).toBe(12_345_000);
  });
});
