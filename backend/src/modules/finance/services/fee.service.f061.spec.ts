/**
 * FEATURE-061 — FeeService.computeFeeForOrdersAggregate cascade extend.
 *
 * Sau F-061, `isManual` được extend:
 *   cat === 'MANUAL' OR (cat ∈ SPLIT_BY_PAYMENT_REF AND isPaymentRefEmpty(paymentRef))
 *
 * Test coverage:
 *  - TC-61-07: ORDINARY no-ref → MANUAL fee = ticketCount × manual_fee_per_ticket
 *  - TC-61-08: ORDINARY with-ref → 5BIB GMV path (regression baseline)
 *  - TC-61-09: Backward compat — caller cũ KHÔNG inject paymentRef → fallback MANUAL khi cat ∈ SPLIT
 *  - TC-61-10: Whitespace defensive — paymentRef = "   " → MANUAL (PAUSE-61-BA-A)
 *  - TC-61-11: F-058 Tier 0 cascade vẫn áp cho MANUAL fee override (manual_fee_per_ticket override per-event)
 *  - TC-61-12: Mixed race 76 simulation — 850 ORDINARY no-ref + 50 ORDINARY with-ref → split aggregate
 *  - TC-61-PERF: Performance benchmark race 76 (909 orders) — p95 budget
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { FeeService } from './fee.service';
import { MerchantConfig } from '../../merchant/schemas/merchant-config.schema';
import { OrderReadonly } from '../entities/order-readonly.entity';
import { Tenant } from '../../merchant/entities/tenant.entity';
import type { OrderForFeeAggregate } from '../dto/fee-aggregate.dto';

describe('F-061 — FeeService.computeFeeForOrdersAggregate cascade extend', () => {
  let service: FeeService;
  let configModel: { findOne: jest.Mock };

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
      tenantId: opts.tenantId ?? 14,
      service_fee_rate: opts.service_fee_rate ?? 0, // race MOU intentional 0%
      manual_fee_per_ticket: opts.manual_fee_per_ticket ?? 5000,
      fee_vat_rate: opts.fee_vat_rate ?? 0,
      event_fee_overrides: opts.event_fee_overrides ?? [],
    };
  }

  function buildOrder(
    o: Partial<OrderForFeeAggregate>,
  ): OrderForFeeAggregate {
    return {
      id: o.id ?? 1,
      raceId: o.raceId ?? 215,
      totalPrice: o.totalPrice ?? 500_000,
      totalDiscounts: o.totalDiscounts ?? 0,
      orderCategory: o.orderCategory ?? 'ORDINARY',
      createdAt: o.createdAt ?? '2026-05-10',
      paymentRef: o.paymentRef,
      manualTicketCount: o.manualTicketCount,
    };
  }

  function makeMockConfigModel(
    initial: ReturnType<typeof buildConfig> | null,
  ) {
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
        {
          provide: getRepositoryToken(OrderReadonly, 'platform'),
          useValue: null,
        },
        {
          provide: getRepositoryToken(Tenant, 'platform'),
          useValue: null,
        },
        { provide: getModelToken(MerchantConfig.name), useValue: configMock },
        { provide: 'default_IORedisModuleConnectionToken', useValue: null },
      ],
    }).compile();
    return module.get(FeeService);
  }

  beforeEach(() => {
    configModel = makeMockConfigModel(null);
  });

  // ─── TC-61-07 ────────────────────────────────────────────────────────
  it('TC-61-07: ORDINARY no-ref → MANUAL fee = ticketCount × manual_fee_per_ticket (MOU intentional)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 14,
        service_fee_rate: 0, // intentional 0% override race MOU
        manual_fee_per_ticket: 5000,
      }),
    );
    service = await buildModule(configModel);

    const orders = [
      buildOrder({
        id: 1,
        raceId: 215,
        orderCategory: 'ORDINARY',
        paymentRef: null,
        manualTicketCount: 1,
        totalPrice: 500_000,
      }),
    ];

    const result = await service.computeFeeForOrdersAggregate(14, orders, {
      from: '2026-05-01',
      to: '2026-05-31',
    });

    expect(result.totalServiceFee).toBe(0); // 5BIB path skipped
    expect(result.totalManualFee).toBe(5000); // 1 ticket × 5000
    expect(result.totalVat).toBe(0);
    expect(result.totalNetGmv).toBe(0); // KHÔNG count vào 5BIB GMV
  });

  // ─── TC-61-08 ────────────────────────────────────────────────────────
  it('TC-61-08: ORDINARY with-ref → 5BIB GMV path (regression baseline)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({ tenantId: 14, service_fee_rate: 5 }),
    );
    service = await buildModule(configModel);

    const orders = [
      buildOrder({
        id: 1,
        orderCategory: 'ORDINARY',
        paymentRef: 'VNPAY-123',
        totalPrice: 1_000_000,
      }),
    ];

    const result = await service.computeFeeForOrdersAggregate(14, orders, {
      from: '2026-05-01',
      to: '2026-05-31',
    });

    expect(result.totalServiceFee).toBe(50_000); // 1M × 5%
    expect(result.totalManualFee).toBe(0);
    expect(result.totalNetGmv).toBe(1_000_000);
  });

  // ─── TC-61-09 ────────────────────────────────────────────────────────
  it('TC-61-09: Backward compat — caller cũ KHÔNG inject paymentRef → fallback MANUAL (BR-61-07)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 14,
        service_fee_rate: 5,
        manual_fee_per_ticket: 5000,
      }),
    );
    service = await buildModule(configModel);

    // Caller cũ KHÔNG inject paymentRef → undefined → isPaymentRefEmpty = true
    const orders: OrderForFeeAggregate[] = [
      {
        id: 1,
        raceId: 215,
        orderCategory: 'ORDINARY',
        totalPrice: 500_000,
        totalDiscounts: 0,
        createdAt: '2026-05-10',
        manualTicketCount: 1,
        // paymentRef intentionally omitted
      },
    ];

    const result = await service.computeFeeForOrdersAggregate(14, orders, {
      from: '2026-05-01',
      to: '2026-05-31',
    });

    // F-061 BR-61-07 — undefined paymentRef → MANUAL fallback
    expect(result.totalServiceFee).toBe(0);
    expect(result.totalManualFee).toBe(5000);
  });

  // ─── TC-61-10 ────────────────────────────────────────────────────────
  it('TC-61-10: Whitespace paymentRef "   " → MANUAL (PAUSE-61-BA-A defensive)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({ tenantId: 14, service_fee_rate: 5 }),
    );
    service = await buildModule(configModel);

    const orders = [
      buildOrder({
        id: 1,
        orderCategory: 'ORDINARY',
        paymentRef: '   ',
        totalPrice: 500_000,
        manualTicketCount: 1,
      }),
    ];

    const result = await service.computeFeeForOrdersAggregate(14, orders, {
      from: '2026-05-01',
      to: '2026-05-31',
    });

    expect(result.totalServiceFee).toBe(0);
    expect(result.totalManualFee).toBe(5000);
  });

  // ─── TC-61-11 ────────────────────────────────────────────────────────
  it('TC-61-11: F-058 Tier 0 cascade vẫn áp cho MANUAL fee override per-event', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 14,
        manual_fee_per_ticket: 5000,
        event_fee_overrides: [
          {
            raceId: 215,
            manual_fee_per_ticket: 10000, // race-specific override 10K
            effective_from: '2026-04-01',
          },
        ],
      }),
    );
    service = await buildModule(configModel);

    const orders = [
      buildOrder({
        id: 1,
        raceId: 215,
        orderCategory: 'ORDINARY',
        paymentRef: null, // fallback MANUAL
        manualTicketCount: 1,
        createdAt: '2026-05-10', // after effective_from
      }),
    ];

    const result = await service.computeFeeForOrdersAggregate(14, orders, {
      from: '2026-05-01',
      to: '2026-05-31',
    });

    // F-058 Tier 0 override 10K (NOT 5K Tier 1 default)
    expect(result.totalManualFee).toBe(10_000);
  });

  // ─── TC-61-12 ────────────────────────────────────────────────────────
  it('TC-61-12: Race 76 simulation — 850 ORDINARY no-ref + 50 ORDINARY with-ref + 9 MANUAL → correct split', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 23,
        service_fee_rate: 5,
        manual_fee_per_ticket: 5000,
      }),
    );
    service = await buildModule(configModel);

    const orders: OrderForFeeAggregate[] = [];
    for (let i = 0; i < 850; i++)
      orders.push(
        buildOrder({
          id: 1000 + i,
          raceId: 76,
          orderCategory: 'ORDINARY',
          paymentRef: null, // MOU pattern → MANUAL
          manualTicketCount: 1,
          totalPrice: 421_000, // approx average race 76
        }),
      );
    for (let i = 0; i < 50; i++)
      orders.push(
        buildOrder({
          id: 2000 + i,
          raceId: 76,
          orderCategory: 'ORDINARY',
          paymentRef: `VNPAY-${i}`,
          totalPrice: 421_000,
        }),
      );
    for (let i = 0; i < 9; i++)
      orders.push(
        buildOrder({
          id: 3000 + i,
          raceId: 76,
          orderCategory: 'MANUAL',
          paymentRef: null,
          manualTicketCount: 1,
        }),
      );

    const result = await service.computeFeeForOrdersAggregate(23, orders, {
      from: '2026-05-01',
      to: '2026-05-31',
    });

    // 850 MANUAL fallback + 9 native MANUAL = 859 × 5000 = 4,295,000
    expect(result.totalManualFee).toBe(859 * 5000);
    // 50 × 421K × 5% = 1,052,500
    expect(result.totalServiceFee).toBe(Math.round(50 * 421_000 * 0.05));
    // GMV 5BIB = 50 × 421K only
    expect(result.totalNetGmv).toBe(50 * 421_000);
  });

  // ─── TC-61-13 ────────────────────────────────────────────────────────
  it('TC-61-13: PERSONAL_GROUP no-ref still → MANUAL (existing BR-02 logic preserved)', async () => {
    configModel = makeMockConfigModel(
      buildConfig({ tenantId: 1, service_fee_rate: 5 }),
    );
    service = await buildModule(configModel);

    const orders = [
      buildOrder({
        id: 1,
        orderCategory: 'PERSONAL_GROUP',
        paymentRef: null,
        manualTicketCount: 1,
      }),
    ];

    const result = await service.computeFeeForOrdersAggregate(1, orders, {
      from: '2026-05-01',
      to: '2026-05-31',
    });

    expect(result.totalServiceFee).toBe(0);
    expect(result.totalManualFee).toBe(5000);
  });

  // ─── TC-61-PERF Performance Benchmark race 76 ────────────────────────
  it('TC-61-PERF: race 76 (909 orders) — p95 budget < 50ms', async () => {
    configModel = makeMockConfigModel(
      buildConfig({
        tenantId: 23,
        service_fee_rate: 5,
        manual_fee_per_ticket: 5000,
      }),
    );
    service = await buildModule(configModel);

    const orders: OrderForFeeAggregate[] = [];
    for (let i = 0; i < 850; i++)
      orders.push(
        buildOrder({
          id: 1000 + i,
          raceId: 76,
          orderCategory: 'ORDINARY',
          paymentRef: null,
          manualTicketCount: 1,
          totalPrice: 421_000,
        }),
      );
    for (let i = 0; i < 50; i++)
      orders.push(
        buildOrder({
          id: 2000 + i,
          raceId: 76,
          orderCategory: 'ORDINARY',
          paymentRef: `VNPAY-${i}`,
          totalPrice: 421_000,
        }),
      );
    for (let i = 0; i < 9; i++)
      orders.push(
        buildOrder({
          id: 3000 + i,
          raceId: 76,
          orderCategory: 'MANUAL',
          paymentRef: null,
          manualTicketCount: 1,
        }),
      );

    const durations: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = Date.now();
      await service.computeFeeForOrdersAggregate(23, orders, {
        from: '2026-05-01',
        to: '2026-05-31',
      });
      durations.push(Date.now() - t0);
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    // Log để paste vào implementation report
    // eslint-disable-next-line no-console
    console.log(
      `[F-061-PERF] race 76 (909 orders × 10 runs) — p50=${p50}ms p95=${p95}ms all=${sorted.join(',')}`,
    );

    // Budget per BR-61-14 — well below 50ms (typically 5-7ms in-process)
    expect(p95).toBeLessThan(50);
  });
});
