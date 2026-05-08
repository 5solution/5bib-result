import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReconciliationPreflightService } from './reconciliation-preflight.service';
import { ReconciliationQueryService } from './reconciliation-query.service';
import { ReconciliationCalcService } from './reconciliation-calc.service';
import { Reconciliation } from '../schemas/reconciliation.schema';
import { MerchantConfig } from '../../merchant/schemas/merchant-config.schema';

describe('ReconciliationPreflightService.runRange — BR-11 overlap detection', () => {
  let service: ReconciliationPreflightService;
  let mockReconciliationModel: any;
  let mockConfigModel: any;
  let mockQueryService: any;

  const baseRequest = {
    tenant_id: 47,
    mysql_race_id: 148,
    period_start: '2026-02-01',
    period_end: '2026-04-30',
  };

  beforeEach(async () => {
    mockReconciliationModel = {
      find: jest.fn().mockReturnThis(),
      lean: jest.fn(),
    };
    mockConfigModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ service_fee_rate: 5.5 }),
      }),
    };
    mockQueryService = {
      getTenant: jest.fn().mockResolvedValue({ name: 'Vu Media' }),
      getRacesByTenant: jest
        .fn()
        .mockResolvedValue([{ race_id: '148', title: 'Marathon X' }]),
      queryOrders: jest.fn().mockResolvedValue({
        fiveBibOrders: [],
        manualOrders: [],
        missingPaymentRef: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationPreflightService,
        { provide: ReconciliationQueryService, useValue: mockQueryService },
        { provide: ReconciliationCalcService, useValue: {} },
        { provide: getModelToken(Reconciliation.name), useValue: mockReconciliationModel },
        { provide: getModelToken(MerchantConfig.name), useValue: mockConfigModel },
      ],
    }).compile();

    service = module.get(ReconciliationPreflightService);
  });

  it('flags overlap when existing recon has exact same range (status=ready)', async () => {
    mockReconciliationModel.lean.mockResolvedValue([
      {
        _id: 'existing-1',
        period_start: '2026-02-01',
        period_end: '2026-04-30',
        status: 'ready',
      },
    ]);
    const result = await service.runRange(baseRequest);
    expect(result.overlap_warnings).toHaveLength(1);
    expect(result.overlap_warnings[0].existing_id).toBe('existing-1');
    expect(result.warnings.some((w) => w.type === 'RANGE_OVERLAP_WITH_EXISTING')).toBe(true);
  });

  it('flags overlap when existing partially overlaps (Jan→Mar vs Feb→Apr)', async () => {
    mockReconciliationModel.lean.mockResolvedValue([
      {
        _id: 'existing-2',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        status: 'approved',
      },
    ]);
    const result = await service.runRange(baseRequest);
    expect(result.overlap_warnings).toHaveLength(1);
  });

  it('does NOT flag when existing range is disjoint (Jan vs Feb→Apr)', async () => {
    mockReconciliationModel.lean.mockResolvedValue([]);
    const result = await service.runRange(baseRequest);
    expect(result.overlap_warnings).toHaveLength(0);
    expect(result.warnings.some((w) => w.type === 'RANGE_OVERLAP_WITH_EXISTING')).toBe(false);
  });

  it('passes status filter $ne draft to MongoDB query (Caveat-01)', async () => {
    mockReconciliationModel.lean.mockResolvedValue([]);
    await service.runRange(baseRequest);
    const findArgs = mockReconciliationModel.find.mock.calls[0][0];
    expect(findArgs.status).toEqual({ $ne: 'draft' });
    expect(findArgs.tenant_id).toBe(47);
    expect(findArgs.mysql_race_id).toBe(148);
    // Standard overlap predicates
    expect(findArgs.period_start).toEqual({ $lte: '2026-04-30' });
    expect(findArgs.period_end).toEqual({ $gte: '2026-02-01' });
  });

  it('returns multiple overlap_warnings when multiple existing recon overlap', async () => {
    mockReconciliationModel.lean.mockResolvedValue([
      { _id: 'a', period_start: '2026-01-01', period_end: '2026-02-28', status: 'ready' },
      { _id: 'b', period_start: '2026-03-01', period_end: '2026-03-31', status: 'sent' },
    ]);
    const result = await service.runRange(baseRequest);
    expect(result.overlap_warnings).toHaveLength(2);
  });

  it('reports can_create=false when no orders found in range', async () => {
    mockReconciliationModel.lean.mockResolvedValue([]);
    mockQueryService.queryOrders.mockResolvedValue({
      fiveBibOrders: [],
      manualOrders: [],
      missingPaymentRef: [],
    });
    const result = await service.runRange(baseRequest);
    expect(result.can_create).toBe(false);
    expect(result.races_skipped).toHaveLength(1);
  });

  it('reports can_create=true and totals when orders exist', async () => {
    mockReconciliationModel.lean.mockResolvedValue([]);
    mockQueryService.queryOrders.mockResolvedValue({
      fiveBibOrders: [{ order_id: 1, subtotal_price: 500000 }],
      manualOrders: [{ order_id: 2, subtotal_price: 100000 }],
      missingPaymentRef: [],
    });
    const result = await service.runRange(baseRequest);
    expect(result.can_create).toBe(true);
    expect(result.summary.total_orders).toBe(1);
    expect(result.summary.estimated_gross_revenue).toBe(600000);
  });

  // ============================================================
  // FEATURE-016 v1.6.5 BR-04 — UNKNOWN_CATEGORY_DROPPED warning emission
  // ============================================================

  describe('BR-04 UNKNOWN_CATEGORY_DROPPED warning (FEATURE-016 v1.6.5)', () => {
    it('TC-QC-PRE-01: emits UNKNOWN_CATEGORY_DROPPED ERROR when queryService reports unknownCategoryCount > 0', async () => {
      mockReconciliationModel.lean.mockResolvedValue([]);
      mockQueryService.queryOrders.mockResolvedValue({
        fiveBibOrders: [{ order_id: 1, subtotal_price: 500000 }],
        manualOrders: [],
        missingPaymentRef: [],
        unknownCategoryCount: 3, // 3 dirty rows dropped
      });
      const result = await service.runRange(baseRequest);
      const unknownWarning = result.warnings.find(
        (w) => w.type === 'UNKNOWN_CATEGORY_DROPPED',
      );
      expect(unknownWarning).toBeDefined();
      expect(unknownWarning?.severity).toBe('ERROR');
      expect(unknownWarning?.count).toBe(3);
      expect(unknownWarning?.message).toContain('3 đơn');
      expect(unknownWarning?.message).toContain('không xác định');
    });

    it('TC-QC-PRE-02: NO UNKNOWN_CATEGORY_DROPPED warning when count = 0 (clean recon)', async () => {
      mockReconciliationModel.lean.mockResolvedValue([]);
      mockQueryService.queryOrders.mockResolvedValue({
        fiveBibOrders: [{ order_id: 1, subtotal_price: 500000 }],
        manualOrders: [],
        missingPaymentRef: [],
        unknownCategoryCount: 0,
      });
      const result = await service.runRange(baseRequest);
      const unknownWarning = result.warnings.find(
        (w) => w.type === 'UNKNOWN_CATEGORY_DROPPED',
      );
      expect(unknownWarning).toBeUndefined();
    });

    it('TC-QC-PRE-03: emits UNKNOWN_CATEGORY_DROPPED ngay cả khi totalOrders=0 (race rỗng nhưng có dirty data)', async () => {
      mockReconciliationModel.lean.mockResolvedValue([]);
      mockQueryService.queryOrders.mockResolvedValue({
        fiveBibOrders: [],
        manualOrders: [],
        missingPaymentRef: [],
        unknownCategoryCount: 5, // race rỗng nhưng có 5 đơn null category
      });
      const result = await service.runRange(baseRequest);
      const unknownWarning = result.warnings.find(
        (w) => w.type === 'UNKNOWN_CATEGORY_DROPPED',
      );
      expect(unknownWarning).toBeDefined();
      expect(unknownWarning?.count).toBe(5);
      // Race vẫn skipped vì totalOrders=0
      expect(result.races_skipped).toHaveLength(1);
    });

    it('TC-QC-PRE-04 (backward compat): runRange xử lý đúng khi queryService KHÔNG return unknownCategoryCount field (undefined → falsy → no warning)', async () => {
      // Old caller pre-F-016 không trả field này. Defensive — preflight không crash.
      mockReconciliationModel.lean.mockResolvedValue([]);
      mockQueryService.queryOrders.mockResolvedValue({
        fiveBibOrders: [{ order_id: 1, subtotal_price: 100000 }],
        manualOrders: [],
        missingPaymentRef: [],
        // unknownCategoryCount field absent
      });
      const result = await service.runRange(baseRequest);
      const unknownWarning = result.warnings.find(
        (w) => w.type === 'UNKNOWN_CATEGORY_DROPPED',
      );
      expect(unknownWarning).toBeUndefined();
      expect(result.can_create).toBe(true);
    });
  });
});
