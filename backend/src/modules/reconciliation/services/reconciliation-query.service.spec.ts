import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
import { ReconciliationQueryService } from './reconciliation-query.service';
import { Reconciliation } from '../schemas/reconciliation.schema';
import { Tenant } from '../../merchant/entities/tenant.entity';

/**
 * FEATURE-016 v1.6.5 PATCH — Unit tests cho category filter logic.
 *
 * Tests run categorize() via queryOrders() (manager.query mocked to return rows directly).
 * Covers BR-01..BR-04 from `01-ba-prd.md`:
 *   - BR-01: 6 categories trong FIVE_BIB_CATEGORIES
 *   - BR-02: payment_ref split cho 4 categories (PERSONAL_GROUP + 3 mới)
 *   - BR-03: ORDINARY + CHANGE_COURSE preserve (KHÔNG split)
 *   - BR-04: defensive null/unknown → unknownCategoryCount + log warning
 */
describe('ReconciliationQueryService — categorize (FEATURE-016 v1.6.5)', () => {
  let service: ReconciliationQueryService;
  let mockManager: { query: jest.Mock };
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockManager = { query: jest.fn() };
    const mockTenantRepo = { manager: mockManager };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationQueryService,
        { provide: getRepositoryToken(Tenant, 'platform'), useValue: mockTenantRepo },
        // F-040 — Reconciliation model needed by getReconciledFeeForContract.
        // Existing tests only exercise queryOrders → minimal stub OK.
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

    service = module.get<ReconciliationQueryService>(ReconciliationQueryService);
    // Silent logger warn so test output không noise; spy để verify warning emit
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  /**
   * Helper: pass rows directly through queryOrders → categorize.
   */
  async function categorizeRows(rows: Record<string, unknown>[]) {
    mockManager.query.mockResolvedValue(rows);
    return service.queryOrders(117, '2026-04-01', '2026-04-30');
  }

  // ============================================================
  // F-061 BR-61-01/02 — ORDINARY uniform split by payment_ref (drop BR-03 special)
  // ============================================================

  describe('F-061 ORDINARY uniform split', () => {
    it('TC-CAT-Q-01: ORDINARY w/ payment_ref → fiveBibOrders', async () => {
      const result = await categorizeRows([
        { order_category: 'ORDINARY', payment_ref: 'VNPAY-123', subtotal_price: 500000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(1);
      expect(result.manualOrders).toHaveLength(0);
      expect(result.unknownCategoryCount).toBe(0);
    });

    it('TC-CAT-Q-02 (F-061 NEW): ORDINARY w/o payment_ref → manualOrders (MOU intentional)', async () => {
      const result = await categorizeRows([
        { order_category: 'ORDINARY', payment_ref: null, subtotal_price: 100000 },
        { order_category: 'ORDINARY', payment_ref: '', subtotal_price: 100000 },
      ]);
      // F-061 — empty payment_ref → MANUAL fallback (drop BR-03 5BIB-regardless)
      expect(result.fiveBibOrders).toHaveLength(0);
      expect(result.manualOrders).toHaveLength(2);
      // missingPaymentRef semantic now flags SPLIT-fallback orders
      expect(result.missingPaymentRef).toHaveLength(2);
    });
  });

  // ============================================================
  // BR-02 — PERSONAL_GROUP split (existing pattern)
  // ============================================================

  describe('BR-02 PERSONAL_GROUP split', () => {
    it('TC-CAT-Q-03: PERSONAL_GROUP w/ payment_ref → fiveBibOrders', async () => {
      const result = await categorizeRows([
        { order_category: 'PERSONAL_GROUP', payment_ref: 'VNPAY-456', subtotal_price: 300000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(1);
      expect(result.manualOrders).toHaveLength(0);
    });

    it('TC-CAT-Q-04: PERSONAL_GROUP w/o payment_ref → manualOrders', async () => {
      const result = await categorizeRows([
        { order_category: 'PERSONAL_GROUP', payment_ref: null, subtotal_price: 300000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(0);
      expect(result.manualOrders).toHaveLength(1);
    });
  });

  // ============================================================
  // F-061 BR-61-01/02 — CHANGE_COURSE uniform split (drop BR-03 special)
  // ============================================================

  describe('F-061 CHANGE_COURSE uniform split', () => {
    it('TC-CAT-Q-05: CHANGE_COURSE w/ payment_ref → fiveBibOrders', async () => {
      const result = await categorizeRows([
        { order_category: 'CHANGE_COURSE', payment_ref: 'VNPAY-789', subtotal_price: 100000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(1);
    });

    it('TC-CAT-Q-06 (F-061 NEW): CHANGE_COURSE w/o payment_ref → manualOrders', async () => {
      const result = await categorizeRows([
        { order_category: 'CHANGE_COURSE', payment_ref: null, subtotal_price: 50000 },
      ]);
      // F-061 — empty payment_ref → MANUAL fallback (drop BR-03 5BIB-regardless)
      expect(result.fiveBibOrders).toHaveLength(0);
      expect(result.manualOrders).toHaveLength(1);
      expect(result.missingPaymentRef).toHaveLength(1);
    });
  });

  // ============================================================
  // BR-01 + BR-02 — GROUP_BUY split (NEW — F-016 critical fix)
  // ============================================================

  describe('BR-01 GROUP_BUY (NEW)', () => {
    it('TC-CAT-Q-07: GROUP_BUY w/ payment_ref → fiveBibOrders (race 117 case Cat Tien T4)', async () => {
      const result = await categorizeRows([
        // Real data from prod: order 200026030 chị Nguyễn Ngọc Trinh
        {
          order_category: 'GROUP_BUY',
          payment_ref: '123456789-VNPAY',
          subtotal_price: 10366400,
          order_id: 200026030,
        },
      ]);
      expect(result.fiveBibOrders).toHaveLength(1);
      expect(result.fiveBibOrders[0].subtotal_price).toBe(10366400);
      expect(result.manualOrders).toHaveLength(0);
    });

    it('TC-CAT-Q-08: GROUP_BUY w/o payment_ref → manualOrders (BR-02 split fallback)', async () => {
      const result = await categorizeRows([
        { order_category: 'GROUP_BUY', payment_ref: null, subtotal_price: 500000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(0);
      expect(result.manualOrders).toHaveLength(1);
    });
  });

  // ============================================================
  // BR-01 + BR-02 — GROUP_BUY_FIXED split (NEW — biggest dropout)
  // ============================================================

  describe('BR-01 GROUP_BUY_FIXED (NEW — biggest impact 517 orders prod)', () => {
    it('TC-CAT-Q-09: GROUP_BUY_FIXED w/ payment_ref → fiveBibOrders', async () => {
      const result = await categorizeRows([
        { order_category: 'GROUP_BUY_FIXED', payment_ref: 'VNPAY-fixed', subtotal_price: 800000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(1);
      expect(result.manualOrders).toHaveLength(0);
    });

    it('TC-CAT-Q-10: GROUP_BUY_FIXED w/o payment_ref → manualOrders', async () => {
      const result = await categorizeRows([
        { order_category: 'GROUP_BUY_FIXED', payment_ref: '', subtotal_price: 800000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(0);
      expect(result.manualOrders).toHaveLength(1);
    });
  });

  // ============================================================
  // BR-01 + BR-02 — CODE_TRANSFER split (NEW — smallest 17 orders)
  // ============================================================

  describe('BR-01 CODE_TRANSFER (NEW)', () => {
    it('TC-CAT-Q-11: CODE_TRANSFER w/ payment_ref → fiveBibOrders', async () => {
      const result = await categorizeRows([
        { order_category: 'CODE_TRANSFER', payment_ref: 'VNPAY-xfer', subtotal_price: 200000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(1);
    });

    it('TC-CAT-Q-12: CODE_TRANSFER w/o payment_ref → manualOrders', async () => {
      const result = await categorizeRows([
        { order_category: 'CODE_TRANSFER', payment_ref: null, subtotal_price: 200000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(0);
      expect(result.manualOrders).toHaveLength(1);
    });
  });

  // ============================================================
  // MANUAL → manualOrders (existing behavior)
  // ============================================================

  describe('MANUAL preserve', () => {
    it('TC-CAT-Q-13: MANUAL → manualOrders (regardless of payment_ref)', async () => {
      const result = await categorizeRows([
        { order_category: 'MANUAL', payment_ref: null, subtotal_price: 100000 },
        { order_category: 'MANUAL', payment_ref: 'something', subtotal_price: 100000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(0);
      expect(result.manualOrders).toHaveLength(2);
      expect(result.unknownCategoryCount).toBe(0);
    });
  });

  // ============================================================
  // BR-04 — Defensive null/unknown category guard
  // ============================================================

  describe('BR-04 defensive null/unknown category guard', () => {
    it('TC-CAT-Q-14: order_category = null → drop, unknownCategoryCount: 1, log warning', async () => {
      const result = await categorizeRows([
        { order_category: null, payment_ref: null, subtotal_price: 100000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(0);
      expect(result.manualOrders).toHaveLength(0);
      expect(result.unknownCategoryCount).toBe(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown order_category dropped'),
        expect.objectContaining({ dropped_count: 1 }),
      );
    });

    it('TC-CAT-Q-15: unknown category "CORPORATE" → drop, unknownCategoryCount: 1', async () => {
      const result = await categorizeRows([
        { order_category: 'CORPORATE', payment_ref: 'x', subtotal_price: 100000 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(0);
      expect(result.manualOrders).toHaveLength(0);
      expect(result.unknownCategoryCount).toBe(1);
    });

    it('TC-CAT-Q-15b: mixed null + unknown → unknownCategoryCount aggregated, distribution logged', async () => {
      const result = await categorizeRows([
        { order_category: null, subtotal_price: 100 },
        { order_category: 'CORPORATE', subtotal_price: 200 },
        { order_category: null, subtotal_price: 300 },
        { order_category: 'ORDINARY', payment_ref: 'ok', subtotal_price: 400 },
      ]);
      expect(result.fiveBibOrders).toHaveLength(1);
      expect(result.unknownCategoryCount).toBe(3);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dropped_count: 3,
          category_distribution: expect.objectContaining({ NULL: 2, CORPORATE: 1 }),
        }),
      );
    });

    it('TC-CAT-Q-15c: empty rows → unknownCategoryCount: 0, no warning', async () => {
      const result = await categorizeRows([]);
      expect(result.unknownCategoryCount).toBe(0);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // INTEGRATION: Race 117 fixture trial (TC-CAT-01 from PRD)
  // ============================================================

  describe('Integration — Race 117 Cat Tien April 2026 fixture (TC-CAT-01)', () => {
    it('mixed real-world rows: ORDINARY + GROUP_BUY + MANUAL all categorize correctly', async () => {
      // Simulate real Cat Tien T4 data shape: 1 ORDINARY + 1 GROUP_BUY + 1 MANUAL
      const result = await categorizeRows([
        // Đơn ORDINARY thường (web)
        {
          order_category: 'ORDINARY',
          payment_ref: 'VNPAY-001',
          order_id: 200026000,
          subtotal_price: 22596000, // ≈ existing 5BIB GMV (recon cũ)
        },
        // Đơn GROUP_BUY 200026030 (case Danny phát hiện) — đây là cái drop trước F-016
        {
          order_category: 'GROUP_BUY',
          payment_ref: '15014055-VNPAY',
          order_id: 200026030,
          subtotal_price: 10366400,
        },
        // Đơn MANUAL (BTC nhập tay)
        {
          order_category: 'MANUAL',
          payment_ref: null,
          order_id: 9999000,
          subtotal_price: 500000,
        },
      ]);

      expect(result.fiveBibOrders).toHaveLength(2); // ORDINARY + GROUP_BUY (NEW)
      expect(result.manualOrders).toHaveLength(1); // MANUAL only
      expect(result.unknownCategoryCount).toBe(0);

      // Sum 5BIB GMV phải khớp manual nhân viên (32,962,400)
      const fiveBibGmv = result.fiveBibOrders.reduce(
        (s, r) => s + Number(r.subtotal_price ?? 0),
        0,
      );
      expect(fiveBibGmv).toBe(32962400);
    });
  });
});

// ============================================================
// FEATURE-040 — getReconciledFeeForContract
// ============================================================

describe('ReconciliationQueryService — getReconciledFeeForContract (F-040)', () => {
  let service: ReconciliationQueryService;
  let reconciliationFindMock: jest.Mock;
  let warnSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;

  function setupService(docsReturn: unknown[]) {
    reconciliationFindMock = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(docsReturn),
      }),
    });
    const mockTenantRepo = { manager: { query: jest.fn() } };
    service = new ReconciliationQueryService(
      mockTenantRepo as never,
      { find: reconciliationFindMock } as never,
    );
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    infoSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  }

  afterEach(() => {
    warnSpy?.mockRestore();
    infoSpy?.mockRestore();
  });

  it('TC-FE-19: duplicate recon docs for same (raceId,tenantId,period) → SUM all + log WARN', async () => {
    setupService([
      {
        _id: 'rec1',
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        status: 'signed',
        fee_amount: 500_000,
        manual_fee_amount: 100_000,
        signed_at: new Date('2026-06-01'),
        createdAt: new Date('2026-05-15'),
      },
      {
        _id: 'rec2',
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        status: 'reviewed',
        fee_amount: 500_000,
        manual_fee_amount: 100_000,
        reviewed_at: new Date('2026-06-02'),
        createdAt: new Date('2026-05-15'),
      },
    ]);

    const slices = await service.getReconciledFeeForContract(
      194,
      20,
      '2026-05-01',
      '2026-05-31',
    );
    expect(slices).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[F-040] duplicate recon docs detected'),
    );
    const total = slices.reduce((s, r) => s + r.feeAmount + r.manualFeeAmount, 0);
    expect(total).toBe(1_200_000);
  });

  it('Status whitelist — non-whitelist statuses excluded via Mongo query filter', async () => {
    setupService([]);
    await service.getReconciledFeeForContract(100, 10, '2026-01-01', '2026-12-31');
    const filterArg = reconciliationFindMock.mock.calls[0][0];
    expect(filterArg.status.$in).toEqual([
      'signed',
      'reviewed',
      'completed',
      'sent',
    ]);
  });

  it('Period overlap filter — period_end >= from AND period_start <= to', async () => {
    setupService([]);
    await service.getReconciledFeeForContract(
      100,
      10,
      new Date('2026-05-01'),
      new Date('2026-12-31'),
    );
    const filterArg = reconciliationFindMock.mock.calls[0][0];
    expect(filterArg.period_end.$gte).toBe('2026-05-01');
    expect(filterArg.period_start.$lte).toBe('2026-12-31');
  });

  it('BR-40-12 legacy warning — pre-2026-05-08 recon gets legacyWarning set', async () => {
    setupService([
      {
        _id: 'rec-legacy',
        period_start: '2026-04-01',
        period_end: '2026-04-30',
        status: 'signed',
        fee_amount: 700_000,
        manual_fee_amount: 0,
        signed_at: new Date('2026-04-30'),
        createdAt: new Date('2026-04-15'), // PRE-cutoff
      },
    ]);
    const slices = await service.getReconciledFeeForContract(
      194,
      20,
      '2026-04-01',
      '2026-04-30',
    );
    expect(slices[0].legacyWarning).toMatch(/pre-F016/);
  });

  it('Post-cutoff recon gets NO legacyWarning', async () => {
    setupService([
      {
        _id: 'rec-fresh',
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        status: 'signed',
        fee_amount: 100_000,
        manual_fee_amount: 0,
        signed_at: new Date('2026-06-01'),
        createdAt: new Date('2026-06-01'), // POST-cutoff
      },
    ]);
    const slices = await service.getReconciledFeeForContract(
      100,
      10,
      '2026-05-01',
      '2026-05-31',
    );
    expect(slices[0].legacyWarning).toBeUndefined();
  });
});

