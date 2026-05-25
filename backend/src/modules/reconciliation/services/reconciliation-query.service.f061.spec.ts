import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
import { ReconciliationQueryService } from './reconciliation-query.service';
import { Reconciliation } from '../schemas/reconciliation.schema';
import { Tenant } from '../../merchant/entities/tenant.entity';

/**
 * FEATURE-061 — SPLIT_BY_PAYMENT_REF Extend to ORDINARY + CHANGE_COURSE.
 *
 * Tests cover BR-61-01..02 + PAUSE-BA-A whitespace edge case.
 *
 * Coverage:
 *  - TC-61-01: ORDINARY with payment_ref → 5BIB (regression baseline)
 *  - TC-61-02: ORDINARY no payment_ref → MANUAL (F-061 NEW)
 *  - TC-61-03: ORDINARY whitespace "   " → MANUAL (PAUSE-61-BA-A defensive)
 *  - TC-61-04: CHANGE_COURSE no payment_ref → MANUAL (F-061 NEW)
 *  - TC-61-05: PERSONAL_GROUP / GROUP_BUY existing split preserve
 *  - TC-61-06: MANUAL category native preserved + missingPaymentRef semantic
 */
describe('ReconciliationQueryService — categorize F-061', () => {
  let service: ReconciliationQueryService;
  let mockManager: { query: jest.Mock };

  beforeEach(async () => {
    mockManager = { query: jest.fn() };
    const mockTenantRepo = { manager: mockManager };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationQueryService,
        {
          provide: getRepositoryToken(Tenant, 'platform'),
          useValue: mockTenantRepo,
        },
        {
          provide: getModelToken(Reconciliation.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([]),
              }),
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ReconciliationQueryService);
    // Silence logger noise during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  async function categorizeRows(rows: Record<string, unknown>[]) {
    mockManager.query.mockResolvedValue(rows);
    return service.queryOrders(215, '2026-05-01', '2026-05-31');
  }

  it('TC-61-01: ORDINARY with payment_ref → fiveBibOrders (regression baseline)', async () => {
    const result = await categorizeRows([
      {
        order_category: 'ORDINARY',
        payment_ref: 'VNPAY-123',
        total_price: 500000,
        order_id: 1,
      },
    ]);
    expect(result.fiveBibOrders).toHaveLength(1);
    expect(result.manualOrders).toHaveLength(0);
    expect(result.missingPaymentRef).toHaveLength(0);
    expect(result.unknownCategoryCount).toBe(0);
  });

  it('TC-61-02: ORDINARY no payment_ref → manualOrders (F-061 NEW behavior)', async () => {
    const result = await categorizeRows([
      {
        order_category: 'ORDINARY',
        payment_ref: null,
        total_price: 200000,
        order_id: 2,
      },
    ]);
    expect(result.fiveBibOrders).toHaveLength(0);
    expect(result.manualOrders).toHaveLength(1);
    // missingPaymentRef now flags MANUAL-fallback orders for preflight WARNING
    expect(result.missingPaymentRef).toHaveLength(1);
  });

  it('TC-61-03: ORDINARY whitespace "   " → manualOrders (PAUSE-61-BA-A defensive)', async () => {
    const result = await categorizeRows([
      {
        order_category: 'ORDINARY',
        payment_ref: '   ',
        total_price: 300000,
        order_id: 3,
      },
    ]);
    expect(result.fiveBibOrders).toHaveLength(0);
    expect(result.manualOrders).toHaveLength(1);
    expect(result.missingPaymentRef).toHaveLength(1);
  });

  it('TC-61-04: CHANGE_COURSE no payment_ref → manualOrders (F-061 NEW)', async () => {
    const result = await categorizeRows([
      {
        order_category: 'CHANGE_COURSE',
        payment_ref: '',
        total_price: 100000,
        order_id: 4,
      },
    ]);
    expect(result.manualOrders).toHaveLength(1);
    expect(result.fiveBibOrders).toHaveLength(0);
    expect(result.missingPaymentRef).toHaveLength(1);
  });

  it('TC-61-05: PERSONAL_GROUP + GROUP_BUY existing SPLIT preserve', async () => {
    const result = await categorizeRows([
      {
        order_category: 'PERSONAL_GROUP',
        payment_ref: 'STRIPE-x',
        order_id: 5,
      },
      { order_category: 'PERSONAL_GROUP', payment_ref: null, order_id: 6 },
      { order_category: 'GROUP_BUY', payment_ref: 'PAYPAL-y', order_id: 7 },
      { order_category: 'GROUP_BUY_FIXED', payment_ref: null, order_id: 8 },
      { order_category: 'CODE_TRANSFER', payment_ref: 'CASH-1', order_id: 9 },
    ]);
    // 3 with truthy ref → 5BIB; 2 with falsy ref → MANUAL
    expect(result.fiveBibOrders).toHaveLength(3);
    expect(result.manualOrders).toHaveLength(2);
    expect(result.missingPaymentRef).toHaveLength(2);
  });

  // ─── TC-61.1-PROMO-FREE-1 (HOTFIX) ─────────────────────────────────
  it('TC-61.1-RECON-FREE-1: ORDINARY no_ref + total_price = 0 → freeOrders bucket (NOT manual)', async () => {
    const result = await categorizeRows([
      {
        order_category: 'ORDINARY',
        payment_ref: null,
        total_price: 0, // 100% promo FREE
        order_id: 100,
      },
    ]);
    expect(result.fiveBibOrders).toHaveLength(0);
    expect(result.manualOrders).toHaveLength(0);
    expect(result.missingPaymentRef).toHaveLength(0);
    expect(result.freeOrders).toHaveLength(1);
    expect(result.unknownCategoryCount).toBe(0);
  });

  // ─── TC-61.1-PROMO-FREE-2 (HOTFIX MIXED) ───────────────────────────
  it('TC-61.1-RECON-FREE-2: Mixed Pattern A + Pattern B — only A count manual', async () => {
    const rows: Record<string, unknown>[] = [];
    // 863 paid no_ref (Pattern A — MOU thu hộ)
    for (let i = 0; i < 863; i++)
      rows.push({
        order_category: 'ORDINARY',
        payment_ref: null,
        total_price: 421_000,
        order_id: 5000 + i,
      });
    // 46 FREE no_ref (Pattern B)
    for (let i = 0; i < 46; i++)
      rows.push({
        order_category: 'ORDINARY',
        payment_ref: null,
        total_price: 0,
        order_id: 6000 + i,
      });
    // 5 paid with-ref (5BIB)
    for (let i = 0; i < 5; i++)
      rows.push({
        order_category: 'ORDINARY',
        payment_ref: `VNPAY-${i}`,
        total_price: 421_000,
        order_id: 7000 + i,
      });

    const result = await categorizeRows(rows);
    expect(result.fiveBibOrders).toHaveLength(5);
    expect(result.manualOrders).toHaveLength(863); // Pattern A only
    expect(result.missingPaymentRef).toHaveLength(863);
    expect(result.freeOrders).toHaveLength(46); // Pattern B isolated
  });

  // ─── TC-61.1-PURE-A-PRESERVE (HOTFIX REGRESSION) ───────────────────
  it('TC-61.1-RECON-PURE-A: Race 215 PURE_A (79 paid no_ref) → manualOrders unchanged', async () => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 79; i++)
      rows.push({
        order_category: 'ORDINARY',
        payment_ref: null,
        total_price: 500_000, // > 0 → Pattern A
        order_id: 8000 + i,
      });
    const result = await categorizeRows(rows);
    expect(result.manualOrders).toHaveLength(79);
    expect(result.missingPaymentRef).toHaveLength(79);
    expect(result.freeOrders).toHaveLength(0);
  });

  it('TC-61-06: Realistic race 76 simulation — 850 ORDINARY no-ref + 50 ORDINARY with-ref + 9 MANUAL', async () => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 850; i++)
      rows.push({
        order_category: 'ORDINARY',
        payment_ref: null,
        order_id: 1000 + i,
      });
    for (let i = 0; i < 50; i++)
      rows.push({
        order_category: 'ORDINARY',
        payment_ref: `VNPAY-${i}`,
        order_id: 2000 + i,
      });
    for (let i = 0; i < 9; i++)
      rows.push({
        order_category: 'MANUAL',
        payment_ref: null,
        order_id: 3000 + i,
      });

    const result = await categorizeRows(rows);
    expect(result.fiveBibOrders).toHaveLength(50);
    expect(result.manualOrders).toHaveLength(850 + 9); // 850 ORDINARY no-ref fallback + 9 native MANUAL
    // Only SPLIT-category empty-ref flagged (NOT native MANUAL)
    expect(result.missingPaymentRef).toHaveLength(850);
    expect(result.unknownCategoryCount).toBe(0);
  });
});
