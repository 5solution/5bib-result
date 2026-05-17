/**
 * F-028 pnl.service.spec.ts
 *
 * Covers:
 *   - BR-PNL-01 revenue priority rule (DRAFT BBNT → Estimated;
 *     FINALIZED → Actual)
 *   - BR-PNL-04 TICKET_SALES cross-DB pull (mock FeeService)
 *   - BR-PNL-06 + BR-PNL-07 compute correctness
 *   - Cache hit pattern
 */
import { Types } from 'mongoose';
import { PnLService } from './pnl.service';

function makeContract(overrides: Partial<any> = {}): any {
  return {
    _id: new Types.ObjectId(),
    contractType: 'TIMING',
    status: 'ACTIVE',
    totalAmount: 100_000_000,
    acceptanceReport: undefined,
    revenueShare: undefined,
    templateOverrides: {},
    raceName: 'Sample Race',
    contractNumber: 'CN-001',
    deletedAt: null,
    ...overrides,
  };
}

function setupService(
  contract: any,
  costItems: any[] = [],
  feeResult: { revenue: number | null; warning?: string } = { revenue: null },
) {
  const contractModel = {
    findById: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue(contract),
    })),
  };
  const costItemsService = {
    findAllActiveByContract: jest.fn().mockResolvedValue(costItems),
  };
  // F-040 — derive new-shape result from legacy feeResult for backward compat.
  // Legacy tests pass { revenue, warning } → adapter wraps into the F-040
  // getFeeForContract return shape. Legacy `revenue=null` means cross-DB
  // pulled empty → fall back to estimatedFee; emulate by using estimatedFee
  // as the F-040 fee with source=ESTIMATED + propagating warning.
  const legacyHasRevenue =
    feeResult.revenue !== null && (feeResult.revenue ?? 0) > 0;
  const estimatedFallback =
    (contract as { revenueShare?: { estimatedFee?: number } }).revenueShare
      ?.estimatedFee ?? 0;
  const fee = legacyHasRevenue ? (feeResult.revenue as number) : estimatedFallback;
  const source = legacyHasRevenue ? 'SELF_COMPUTE' : 'ESTIMATED';
  const f040Result = {
    fee,
    source,
    grossGMV: legacyHasRevenue ? (feeResult.revenue as number) : 0,
    breakdown: {
      contractId: String(contract._id),
      feeSource: source,
      totalFee: fee,
      grossGMV: legacyHasRevenue ? (feeResult.revenue as number) : 0,
      reconciliations: [],
      computedAt: new Date().toISOString(),
      warnings: feeResult.warning ? [feeResult.warning] : undefined,
    },
    warnings: feeResult.warning ? [feeResult.warning] : [],
  };
  const feeService = {
    getActualRevenueForRace: jest.fn().mockResolvedValue(feeResult),
    getFeeForContract: jest.fn().mockResolvedValue(f040Result),
    getFeeForContractsBulk: jest.fn().mockImplementation((contracts: any[]) => {
      const map = new Map();
      for (const c of contracts) map.set(String(c._id), f040Result);
      return Promise.resolve(map);
    }),
  };
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };
  const service = new PnLService(
    contractModel as any,
    costItemsService as any,
    feeService as any,
    redis as any,
  );
  return { service, contractModel, costItemsService, feeService, redis };
}

describe('F-028 PnLService.getSummary', () => {
  it('BR-PNL-01 — TIMING contract, no BBNT → revenue=totalAmount, source=ESTIMATED', async () => {
    const contract = makeContract({ totalAmount: 100_000_000 });
    const { service } = setupService(contract, [
      { amount: 30_000_000, category: 'LABOR' },
      { amount: 20_000_000, category: 'MATERIAL' },
    ]);

    const result = await service.getSummary(contract._id.toString());
    expect(result.revenue).toBe(100_000_000);
    expect(result.revenueSource).toBe('ESTIMATED');
    expect(result.totalCost).toBe(50_000_000);
    expect(result.profit).toBe(50_000_000);
    expect(result.margin).toBe(50);
    expect(result.marginTier).toBe('healthy');
    expect(result.costItemCount).toBe(2);
    expect(result.costByCategory.LABOR).toBe(30_000_000);
    expect(result.costByCategory.MATERIAL).toBe(20_000_000);
    expect(result.costByCategory.VENDOR).toBe(0); // default 5 categories present
  });

  it('BR-PNL-01 — BBNT FINALIZED → revenue=actualTotalWithVat, source=ACTUAL', async () => {
    const contract = makeContract({
      totalAmount: 100_000_000,
      acceptanceReport: {
        status: 'FINALIZED',
        actualTotalWithVat: 115_000_000,
      },
    });
    const { service } = setupService(contract, [{ amount: 80_000_000, category: 'VENDOR' }]);
    const result = await service.getSummary(contract._id.toString());
    expect(result.revenue).toBe(115_000_000);
    expect(result.revenueSource).toBe('ACTUAL');
    expect(result.profit).toBe(35_000_000);
  });

  it('BR-PNL-01 — BBNT DRAFT (status != FINALIZED) → Estimated', async () => {
    const contract = makeContract({
      totalAmount: 100_000_000,
      acceptanceReport: { status: 'DRAFT', actualTotalWithVat: 99_000_000 },
    });
    const { service } = setupService(contract);
    const result = await service.getSummary(contract._id.toString());
    expect(result.revenue).toBe(100_000_000);
    expect(result.revenueSource).toBe('ESTIMATED');
  });

  it('BR-PNL-04 — TICKET_SALES, FeeService trả revenue > 0 → ACTUAL', async () => {
    const contract = makeContract({
      contractType: 'TICKET_SALES',
      totalAmount: 0,
      revenueShare: { estimatedFee: 5_000_000 } as any,
      templateOverrides: {
        __platformTenantId: '12',
        __platformMysqlRaceId: '148',
      },
    });
    const { service } = setupService(contract, [], { revenue: 8_500_000 });
    const result = await service.getSummary(contract._id.toString());
    expect(result.revenue).toBe(8_500_000);
    expect(result.revenueSource).toBe('ACTUAL');
  });

  it('UP-07 — TICKET_SALES, FeeService null → fallback estimatedFee Estimated + warning', async () => {
    const contract = makeContract({
      contractType: 'TICKET_SALES',
      revenueShare: { estimatedFee: 3_000_000 } as any,
      templateOverrides: {},
    });
    const { service } = setupService(contract, [], {
      revenue: null,
      warning: 'Chưa link platform',
    });
    const result = await service.getSummary(contract._id.toString());
    expect(result.revenue).toBe(3_000_000);
    expect(result.revenueSource).toBe('ESTIMATED');
    expect(result.warning).toMatch(/Chưa link platform/);
  });

  it('BR-PNL-07 — revenue=0 → margin null', async () => {
    const contract = makeContract({ totalAmount: 0 });
    const { service } = setupService(contract, [{ amount: 1_000_000, category: 'OTHER' }]);
    const result = await service.getSummary(contract._id.toString());
    expect(result.margin).toBeNull();
    expect(result.profit).toBe(-1_000_000);
  });

  /* ────────────────────────────────────────────────────────────────────────
   * FEATURE-036 — Line-item cost + cost_items ADDITIVE (Danny 2026-05-14
   * fix F-033 semantic bug).
   *
   * cost_items = chi phí phát sinh THÊM (KHÔNG override line_items.cost).
   * totalCost = estimatedCost (line_items) + actualCost (cost_items).
   *
   * Source attribution descriptive:
   *   'none'      → cả 2 = 0
   *   'estimated' → chỉ line_items có cost
   *   'actual'    → chỉ cost_items có data
   *   'mixed'     → cả 2 có data
   * ──────────────────────────────────────────────────────────────────────── */

  it('TC-LIC-01: line_items có cost, no cost_items → estimated=32.5M, total=32.5M, source=estimated', async () => {
    const contract = makeContract({
      totalAmount: 100_000_000,
      lineItems: [
        { quantity: 10, cost: 2_000_000, selected: true }, // 20M
        { quantity: 5, cost: 1_500_000, selected: true }, //   7.5M
        { quantity: 100, cost: 50_000, selected: true }, //   5M
      ],
    });
    const { service } = setupService(contract, []);

    const result = await service.getSummary(contract._id.toString());
    expect(result.estimatedCost).toBe(32_500_000);
    expect(result.actualCost).toBe(0);
    expect(result.totalCost).toBe(32_500_000);
    expect(result.totalCostSource).toBe('estimated');
    expect(result.profit).toBe(67_500_000);
  });

  it('TC-LIC-02 (F-036 FIX): cost_items ADD-ON line_items, KHÔNG override → totalCost = sum cả 2', async () => {
    const contract = makeContract({
      totalAmount: 100_000_000,
      lineItems: [
        { quantity: 10, cost: 2_000_000, selected: true }, // estimated 20M
      ],
    });
    const { service } = setupService(contract, [
      { amount: 30_000_000, category: 'LABOR' }, // actual 50M
      { amount: 20_000_000, category: 'MATERIAL' },
    ]);

    const result = await service.getSummary(contract._id.toString());
    expect(result.estimatedCost).toBe(20_000_000);
    expect(result.actualCost).toBe(50_000_000);
    expect(result.totalCost).toBe(70_000_000); // ADDITIVE — F-036 fix
    expect(result.totalCostSource).toBe('mixed');
    expect(result.profit).toBe(30_000_000);
  });

  it('TC-LIC-03: line_items selected=false → KHÔNG tính vào estimated', async () => {
    const contract = makeContract({
      totalAmount: 100_000_000,
      lineItems: [
        { quantity: 10, cost: 2_000_000, selected: true }, // 20M counted
        { quantity: 5, cost: 10_000_000, selected: false }, // SKIP
      ],
    });
    const { service } = setupService(contract, []);

    const result = await service.getSummary(contract._id.toString());
    expect(result.estimatedCost).toBe(20_000_000);
    expect(result.actualCost).toBe(0);
    expect(result.totalCost).toBe(20_000_000);
    expect(result.totalCostSource).toBe('estimated');
  });

  it('TC-LIC-04: Cả cost_items + line_items.cost = 0 → totalCost=0, source=none', async () => {
    const contract = makeContract({
      totalAmount: 50_000_000,
      lineItems: [{ quantity: 10, cost: 0, selected: true }],
    });
    const { service } = setupService(contract, []);

    const result = await service.getSummary(contract._id.toString());
    expect(result.estimatedCost).toBe(0);
    expect(result.actualCost).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.totalCostSource).toBe('none');
    expect(result.profit).toBe(50_000_000);
    expect(result.margin).toBe(100);
  });

  it('TC-LIC-05: Backward compat — HĐ cũ không có field cost + có cost_items → source=actual', async () => {
    const contract = makeContract({
      totalAmount: 50_000_000,
      lineItems: [
        { quantity: 10, unitPrice: 5_000_000, selected: true }, // no cost field
      ],
    });
    const { service } = setupService(contract, [
      { amount: 5_000_000, category: 'OTHER' },
    ]);

    const result = await service.getSummary(contract._id.toString());
    expect(result.estimatedCost).toBe(0);
    expect(result.actualCost).toBe(5_000_000);
    expect(result.totalCost).toBe(5_000_000);
    expect(result.totalCostSource).toBe('actual');
  });

  it('TC-LIC-06 (F-036 NEW): Danny screenshot scenario — estimated 185M + actual 1M = 186M total', async () => {
    // HĐ 11.05/2026/HDDV/CTTXT5-5BIB-20 — 3 line items với cost ước tính
    // + 1 cost_item "Đút lót chính quyền" 1M phát sinh thêm.
    const contract = makeContract({
      totalAmount: 209_199_994,
      lineItems: [
        { quantity: 1000, cost: 30_000, selected: true }, // 30M chip
        { quantity: 1, cost: 30_000_000, selected: true }, // 30M cổng
        { quantity: 10, cost: 12_500_000, selected: true }, // 125M nhân sự
      ],
    });
    const { service } = setupService(contract, [
      { amount: 1_000_000, category: 'OTHER' },
    ]);

    const result = await service.getSummary(contract._id.toString());
    expect(result.estimatedCost).toBe(185_000_000);
    expect(result.actualCost).toBe(1_000_000);
    expect(result.totalCost).toBe(186_000_000);
    expect(result.totalCostSource).toBe('mixed');
    expect(result.profit).toBe(23_199_994);
    expect(result.margin).toBeCloseTo(11.1, 0);
  });

  it('UP-04 — Contract không tồn tại → NotFoundException', async () => {
    const contractModel = {
      findById: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue(null),
      })),
    };
    const service = new PnLService(
      contractModel as any,
      { findAllActiveByContract: jest.fn() } as any,
      { getActualRevenueForRace: jest.fn() } as any,
      undefined,
    );
    await expect(
      service.getSummary(new Types.ObjectId().toString()),
    ).rejects.toThrow(/không tồn tại/);
  });

  // ────────────────────────────────────────────────────────────────────
  // F-028 Phase 2 — getDashboardData
  // ────────────────────────────────────────────────────────────────────

  function setupDashboardService(opts: {
    contracts: any[];
    costMap?: Map<
      string,
      { totalCost: number; costByCategory: Record<string, number> }
    >;
    feeResult?: { revenue: number | null; warning?: string };
    redisGetReturn?: string | null;
  }) {
    const contractModel = {
      find: jest.fn(() => ({
        lean: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue(opts.contracts),
        })),
      })),
      findById: jest.fn(),
    };
    const costItemsService = {
      findAllActiveByContract: jest.fn().mockResolvedValue([]),
      aggregateByContractIds: jest
        .fn()
        .mockResolvedValue(opts.costMap ?? new Map()),
    };
    const feeService = {
      getActualRevenueForRace: jest
        .fn()
        .mockResolvedValue(opts.feeResult ?? { revenue: null }),
      // F-029 HIGH-PERF-01 — bulk version used by getDashboardData batch.
      // Default: empty Map (no MySQL revenue) → fallback to estimatedFee
      // semantic identical with previous single-race revenue=null path.
      getActualRevenueForRaces: jest
        .fn()
        .mockResolvedValue(new Map<number, number>()),
      // F-040 — new bulk fee compute. Default empty Map → all TICKET_SALES
      // contracts fall through to revenueShare.estimatedFee fallback in
      // resolveRevenueSync (BR-40-02 tier 4 parity).
      getFeeForContractsBulk: jest
        .fn()
        .mockResolvedValue(new Map<string, any>()),
      getFeeForContract: jest.fn().mockResolvedValue({
        fee: 0,
        source: 'ESTIMATED',
        grossGMV: 0,
        breakdown: {
          contractId: '',
          feeSource: 'ESTIMATED',
          totalFee: 0,
          grossGMV: 0,
          reconciliations: [],
          computedAt: new Date().toISOString(),
        },
        warnings: [],
      }),
    };
    const redis: any = {
      get: jest.fn().mockResolvedValue(opts.redisGetReturn ?? null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    const service = new PnLService(
      contractModel as any,
      costItemsService as any,
      feeService as any,
      redis as any,
    );
    return { service, contractModel, costItemsService, feeService, redis };
  }

  function makeC(overrides: Partial<any> = {}) {
    return {
      _id: new Types.ObjectId(),
      contractType: 'TIMING',
      status: 'ACTIVE',
      totalAmount: 100_000_000,
      acceptanceReport: undefined,
      revenueShare: undefined,
      templateOverrides: {},
      raceName: 'Race A',
      contractNumber: 'CN-X',
      client: { entityName: 'Partner A' },
      deletedAt: null,
      signDate: new Date('2026-04-15T00:00:00Z'),
      createdAt: new Date('2026-04-10T00:00:00Z'),
      ...overrides,
    };
  }

  describe('Phase 2 getDashboardData', () => {
    it('Happy path — 3 contracts aggregated correctly', async () => {
      const c1 = makeC({ totalAmount: 100_000_000 });
      const c2 = makeC({
        totalAmount: 50_000_000,
        contractType: 'RACEKIT',
        client: { entityName: 'Partner B' },
      });
      const c3 = makeC({
        totalAmount: 200_000_000,
        contractType: 'TIMING',
        client: { entityName: 'Partner A' },
      });

      const costMap = new Map<
        string,
        { totalCost: number; costByCategory: Record<string, number> }
      >();
      costMap.set(c1._id.toString(), {
        totalCost: 30_000_000,
        costByCategory: { LABOR: 30_000_000, MATERIAL: 0, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
      });
      costMap.set(c2._id.toString(), {
        totalCost: 60_000_000,
        costByCategory: { LABOR: 0, MATERIAL: 60_000_000, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
      });
      const { service } = setupDashboardService({
        contracts: [c1, c2, c3],
        costMap,
      });

      const result = await service.getDashboardData({});
      expect(result.totals.contractCount).toBe(3);
      expect(result.totals.totalRevenue).toBe(350_000_000);
      expect(result.totals.totalCost).toBe(90_000_000);
      expect(result.totals.totalProfit).toBe(260_000_000);
    });

    it('GroupBy contractType — buckets aggregate correctly', async () => {
      const c1 = makeC({ totalAmount: 100_000_000, contractType: 'TIMING' });
      const c2 = makeC({ totalAmount: 200_000_000, contractType: 'TIMING' });
      const c3 = makeC({ totalAmount: 50_000_000, contractType: 'RACEKIT' });
      const { service } = setupDashboardService({ contracts: [c1, c2, c3] });

      const result = await service.getDashboardData({});
      const timing = result.byType.find((b) => b.key === 'TIMING');
      expect(timing).toBeDefined();
      expect(timing!.contractCount).toBe(2);
      expect(timing!.totalRevenue).toBe(300_000_000);
      const racekit = result.byType.find((b) => b.key === 'RACEKIT');
      expect(racekit!.contractCount).toBe(1);
    });

    it('GroupBy partner — sorted by profit DESC', async () => {
      const c1 = makeC({
        totalAmount: 100_000_000,
        client: { entityName: 'Partner A' },
      });
      const c2 = makeC({
        totalAmount: 500_000_000,
        client: { entityName: 'Partner B' },
      });
      const { service } = setupDashboardService({ contracts: [c1, c2] });

      const result = await service.getDashboardData({});
      expect(result.byPartner[0].key).toBe('Partner B');
      expect(result.byPartner[1].key).toBe('Partner A');
    });

    it('GroupBy month — sorted ASC by YYYY-MM key', async () => {
      const c1 = makeC({ signDate: new Date('2026-02-15T00:00:00Z') });
      const c2 = makeC({ signDate: new Date('2026-04-20T00:00:00Z') });
      const c3 = makeC({ signDate: new Date('2026-03-10T00:00:00Z') });
      const { service } = setupDashboardService({ contracts: [c1, c2, c3] });

      const result = await service.getDashboardData({});
      const keys = result.byMonth.map((b) => b.key);
      expect(keys).toEqual([...keys].sort());
      expect(keys).toContain('2026-02');
      expect(keys).toContain('2026-03');
      expect(keys).toContain('2026-04');
    });

    it('BR-PNL-08 — STRICT whitelist ACTIVE + COMPLETED via Mongo $in filter (Danny chốt 2026-05-12)', async () => {
      // We mock contractModel.find — verify call params include status $in
      // whitelist ['ACTIVE', 'COMPLETED']. HĐ chưa chốt (DRAFT + quotation
      // pipeline + CANCELLED + REJECTED) phải bị loại khỏi dashboard P&L.
      const { service, contractModel } = setupDashboardService({
        contracts: [],
      });
      await service.getDashboardData({});
      const calls = contractModel.find.mock.calls as any[];
      const arg = calls[0][0] as { status: { $in: string[] } };
      expect(arg.status.$in).toEqual(['ACTIVE', 'COMPLETED']);
      // Defense in depth — KHÔNG được dùng $nin pattern cũ
      expect((arg.status as any).$nin).toBeUndefined();
    });

    it('BR-PNL-08 — filter loại DRAFT + quotation pipeline + CANCELLED + REJECTED', async () => {
      // Verify whitelist không chứa các status sau:
      const excludedStatuses = [
        'DRAFT',
        'SENT',
        'ACCEPTED',
        'CONVERTED_TO_CONTRACT',
        'CANCELLED',
        'REJECTED',
      ];
      const { service, contractModel } = setupDashboardService({
        contracts: [],
      });
      await service.getDashboardData({});
      const arg = (contractModel.find.mock.calls as any[])[0][0] as {
        status: { $in: string[] };
      };
      for (const excluded of excludedStatuses) {
        expect(arg.status.$in).not.toContain(excluded);
      }
    });

    it('BR-PNL-08 — include ACTIVE + COMPLETED contracts only in aggregation', async () => {
      // Functional test: nếu Mongo $in filter chạy đúng thì những contract
      // ACTIVE / COMPLETED truyền vào sẽ được aggregate. Ở unit test ta mock
      // contractModel.find trả về thẳng list nên không re-test filter Mongo
      // (đã cover ở test trên), mà verify pipeline xử lý đúng các status hợp lệ.
      const c1 = makeC({ status: 'ACTIVE', totalAmount: 100_000_000 });
      const c2 = makeC({ status: 'COMPLETED', totalAmount: 200_000_000 });
      const { service } = setupDashboardService({ contracts: [c1, c2] });
      const result = await service.getDashboardData({});
      expect(result.totals.contractCount).toBe(2);
      expect(result.totals.totalRevenue).toBe(300_000_000);
      // Both statuses appear in items
      const statuses = result.topProfit.map((i) => i.status).sort();
      expect(statuses).toEqual(['ACTIVE', 'COMPLETED']);
    });

    it('Top profit — limit 10 sort DESC', async () => {
      const contracts = Array.from({ length: 15 }, (_, i) =>
        makeC({ totalAmount: (i + 1) * 10_000_000 }),
      );
      const { service } = setupDashboardService({ contracts });
      const result = await service.getDashboardData({});
      expect(result.topProfit).toHaveLength(10);
      // profit DESC: first item is highest totalAmount (15 × 10M = 150M)
      expect(result.topProfit[0].revenue).toBe(150_000_000);
      expect(result.topProfit[9].revenue).toBe(60_000_000);
    });

    it('Loss-making — margin < 0', async () => {
      const c1 = makeC({ totalAmount: 100_000_000 });
      const c2 = makeC({ totalAmount: 50_000_000 });
      const costMap = new Map<
        string,
        { totalCost: number; costByCategory: Record<string, number> }
      >();
      // c1 profit, c2 loss
      costMap.set(c1._id.toString(), {
        totalCost: 30_000_000,
        costByCategory: { LABOR: 30_000_000, MATERIAL: 0, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
      });
      costMap.set(c2._id.toString(), {
        totalCost: 80_000_000,
        costByCategory: { LABOR: 80_000_000, MATERIAL: 0, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
      });
      const { service } = setupDashboardService({
        contracts: [c1, c2],
        costMap,
      });
      const result = await service.getDashboardData({});
      expect(result.lossMaking).toHaveLength(1);
      expect(result.lossMaking[0].contractId).toBe(c2._id.toString());
      expect(result.lossMaking[0].margin).toBeLessThan(0);
    });

    it('Cache hit 120s — second call returns cached payload, no DB hit', async () => {
      const cachedPayload = JSON.stringify({
        period: 'last_3_months',
        dateFrom: '2026-02-01',
        dateTo: '2026-05-12',
        generatedAt: '2026-05-12T00:00:00.000Z',
        totals: {
          contractCount: 1,
          totalRevenue: 1,
          totalCost: 0,
          totalProfit: 1,
          avgMargin: 100,
          costByCategory: { LABOR: 0, MATERIAL: 0, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
        },
        byType: [],
        byPartner: [],
        byMonth: [],
        topProfit: [],
        lossMaking: [],
      });
      const { service, contractModel } = setupDashboardService({
        contracts: [],
        redisGetReturn: cachedPayload,
      });
      const result = await service.getDashboardData({});
      expect(result.totals.contractCount).toBe(1);
      expect(contractModel.find).not.toHaveBeenCalled();
    });

    it('Empty dashboard — 0 contracts → safe empty result', async () => {
      const { service } = setupDashboardService({ contracts: [] });
      const result = await service.getDashboardData({});
      expect(result.totals.contractCount).toBe(0);
      expect(result.totals.totalRevenue).toBe(0);
      expect(result.totals.avgMargin).toBeNull();
      expect(result.byType).toEqual([]);
      expect(result.byPartner).toEqual([]);
      expect(result.byMonth).toEqual([]);
      expect(result.topProfit).toEqual([]);
      expect(result.lossMaking).toEqual([]);
    });

    it('Cache key changes when filter changes (period custom vs last_3_months)', async () => {
      const { service, redis } = setupDashboardService({ contracts: [] });
      await service.getDashboardData({ period: 'last_3_months' });
      await service.getDashboardData({
        period: 'custom',
        dateFrom: '2026-01-01',
        dateTo: '2026-03-01',
      });
      const setKey1 = redis.set.mock.calls[0][0];
      const setKey2 = redis.set.mock.calls[1][0];
      expect(setKey1).not.toEqual(setKey2);
      // Both should be 120s TTL
      expect(redis.set.mock.calls[0][3]).toBe(120);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // F-029 HIGH-PERF-01 — Batch refactor (N+1 elimination)
  // ────────────────────────────────────────────────────────────────────

  describe('F-029 HIGH-PERF-01 batch refactor', () => {
    it('0 contracts → skip MySQL bulk call entirely (no N+1, no chunks)', async () => {
      const { service, feeService } = setupDashboardService({ contracts: [] });
      const result = await service.getDashboardData({});
      expect(feeService.getActualRevenueForRaces).not.toHaveBeenCalled();
      expect(feeService.getActualRevenueForRace).not.toHaveBeenCalled();
      expect(result.totals.contractCount).toBe(0);
    });

    it('Only BBNT contracts (TIMING/RACEKIT/OPERATIONS) → 0 MySQL queries', async () => {
      const c1 = makeC({ contractType: 'TIMING', totalAmount: 100_000_000 });
      const c2 = makeC({ contractType: 'RACEKIT', totalAmount: 50_000_000 });
      const { service, feeService } = setupDashboardService({
        contracts: [c1, c2],
      });
      await service.getDashboardData({});
      // No TICKET_SALES → no MySQL bulk call needed.
      expect(feeService.getActualRevenueForRaces).not.toHaveBeenCalled();
      expect(feeService.getActualRevenueForRace).not.toHaveBeenCalled();
    });

    it('TICKET_SALES with linkage → 1 bulk MySQL call (not N calls)', async () => {
      const c1 = makeC({
        contractType: 'TICKET_SALES',
        linkedTenantId: 10,
        linkedMysqlRaceId: 100,
        revenueShare: { estimatedFee: 1_000_000 },
      });
      const c2 = makeC({
        contractType: 'TICKET_SALES',
        linkedTenantId: 10,
        linkedMysqlRaceId: 200,
        revenueShare: { estimatedFee: 2_000_000 },
      });
      const c3 = makeC({
        contractType: 'TICKET_SALES',
        linkedTenantId: 11,
        linkedMysqlRaceId: 300,
        revenueShare: { estimatedFee: 3_000_000 },
      });

      const { service, feeService } = setupDashboardService({
        contracts: [c1, c2, c3],
      });
      // F-040 — bulk fee result Map for 2/3 contracts; 3rd falls back to estimatedFee.
      feeService.getFeeForContractsBulk.mockResolvedValue(
        new Map<string, any>([
          [
            String(c1._id),
            {
              fee: 10_000_000,
              source: 'SELF_COMPUTE',
              grossGMV: 100_000_000,
              breakdown: { contractId: String(c1._id), feeSource: 'SELF_COMPUTE', totalFee: 10_000_000, grossGMV: 100_000_000, reconciliations: [], computedAt: new Date().toISOString() },
              warnings: [],
            },
          ],
          [
            String(c2._id),
            {
              fee: 20_000_000,
              source: 'SELF_COMPUTE',
              grossGMV: 200_000_000,
              breakdown: { contractId: String(c2._id), feeSource: 'SELF_COMPUTE', totalFee: 20_000_000, grossGMV: 200_000_000, reconciliations: [], computedAt: new Date().toISOString() },
              warnings: [],
            },
          ],
        ]),
      );

      const result = await service.getDashboardData({});

      // ASSERTION: exactly 1 bulk call (N+1 eliminated).
      expect(feeService.getFeeForContractsBulk).toHaveBeenCalledTimes(1);
      // Per-contract single method should NOT be called by batch flow.
      expect(feeService.getFeeForContract).not.toHaveBeenCalled();
      // Verify all 3 TICKET_SALES contracts in bulk call.
      const calledContracts = feeService.getFeeForContractsBulk.mock.calls[0][0];
      expect(calledContracts).toHaveLength(3);

      // Revenue: c1 + c2 from Map, c3 fallback estimatedFee.
      expect(result.totals.totalRevenue).toBe(
        10_000_000 + 20_000_000 + 3_000_000,
      );
    });

    it('Mixed TICKET_SALES + BBNT → 1 bulk call covering only TICKET_SALES contracts', async () => {
      const cTicket = makeC({
        contractType: 'TICKET_SALES',
        linkedTenantId: 10,
        linkedMysqlRaceId: 100,
        revenueShare: { estimatedFee: 1_000_000 },
      });
      const cBbnt = makeC({
        contractType: 'TIMING',
        totalAmount: 50_000_000,
      });

      const { service, feeService } = setupDashboardService({
        contracts: [cTicket, cBbnt],
      });
      feeService.getFeeForContractsBulk.mockResolvedValue(
        new Map<string, any>([
          [
            String(cTicket._id),
            {
              fee: 5_000_000,
              source: 'SELF_COMPUTE',
              grossGMV: 50_000_000,
              breakdown: { contractId: String(cTicket._id), feeSource: 'SELF_COMPUTE', totalFee: 5_000_000, grossGMV: 50_000_000, reconciliations: [], computedAt: new Date().toISOString() },
              warnings: [],
            },
          ],
        ]),
      );

      const result = await service.getDashboardData({});

      expect(feeService.getFeeForContractsBulk).toHaveBeenCalledTimes(1);
      // Only TICKET_SALES contract in bulk call — BBNT NOT included.
      const calledContracts = feeService.getFeeForContractsBulk.mock.calls[0][0];
      expect(calledContracts).toHaveLength(1);
      expect(String(calledContracts[0]._id)).toBe(String(cTicket._id));
      expect(result.totals.totalRevenue).toBe(5_000_000 + 50_000_000);
    });

    it('TICKET_SALES with missing linkage (linkedMysqlRaceId=null) → fallback estimatedFee', async () => {
      const cNoLinkage = makeC({
        contractType: 'TICKET_SALES',
        linkedTenantId: null,
        linkedMysqlRaceId: null,
        revenueShare: { estimatedFee: 7_000_000 },
      });

      const { service, feeService } = setupDashboardService({
        contracts: [cNoLinkage],
      });
      // Bulk returns empty Map → resolveRevenueSync falls back to estimatedFee.
      feeService.getFeeForContractsBulk.mockResolvedValue(new Map());

      const result = await service.getDashboardData({});

      // Revenue = estimatedFee with ESTIMATED source.
      expect(result.totals.totalRevenue).toBe(7_000_000);
      expect(result.topProfit[0].revenue).toBe(7_000_000);
      expect(result.topProfit[0].revenueSource).toBe('ESTIMATED');
    });

    it('Snapshot equivalence — TICKET_SALES revenue values match pre-refactor semantics', async () => {
      const c = makeC({
        contractType: 'TICKET_SALES',
        linkedTenantId: 10,
        linkedMysqlRaceId: 500,
        revenueShare: { estimatedFee: 0 },
      });

      const { service, feeService } = setupDashboardService({
        contracts: [c],
      });
      feeService.getFeeForContractsBulk.mockResolvedValue(
        new Map<string, any>([
          [
            String(c._id),
            {
              fee: 12_345_000,
              source: 'SELF_COMPUTE',
              grossGMV: 123_450_000,
              breakdown: { contractId: String(c._id), feeSource: 'SELF_COMPUTE', totalFee: 12_345_000, grossGMV: 123_450_000, reconciliations: [], computedAt: new Date().toISOString() },
              warnings: [],
            },
          ],
        ]),
      );

      const result = await service.getDashboardData({});

      // Same revenue + source as legacy single-race resolveRevenue would emit.
      expect(result.totals.totalRevenue).toBe(12_345_000);
      expect(result.topProfit[0].revenue).toBe(12_345_000);
      expect(result.topProfit[0].revenueSource).toBe('ACTUAL');
    });
  });

  it('Cache hit — Redis cached JSON returned without DB hit', async () => {
    const cached = {
      contractId: 'abc',
      revenue: 1,
      revenueSource: 'ESTIMATED',
      totalCost: 0,
      profit: 1,
      margin: 100,
      marginTier: 'healthy',
      costItemCount: 0,
      costByCategory: {},
    };
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(cached)),
      set: jest.fn(),
    };
    const contractModel = { findById: jest.fn() };
    const service = new PnLService(
      contractModel as any,
      { findAllActiveByContract: jest.fn() } as any,
      { getActualRevenueForRace: jest.fn() } as any,
      redis as any,
    );
    const result = await service.getSummary(new Types.ObjectId().toString());
    expect(result).toEqual(cached);
    expect(contractModel.findById).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────────
  // FEATURE-038 — getContractsList (paginated P&L list)
  // ────────────────────────────────────────────────────────────────────

  describe('FEATURE-038 getContractsList', () => {
    it('TC-CL-01 — Default filter returns paginated 20 items + totals shape correct', async () => {
      // 25 contracts → page 1 limit 20 → 20 items, total 25, totalPages 2
      const contracts = Array.from({ length: 25 }, (_, i) =>
        makeC({
          totalAmount: 1_000_000 * (i + 1),
          contractType: 'TIMING',
          contractNumber: `CN-${String(i + 1).padStart(3, '0')}`,
          client: { entityName: `Partner ${i + 1}` },
        }),
      );
      const { service } = setupDashboardService({ contracts });

      const result = await service.getContractsList({});

      expect(result.items).toHaveLength(20);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(2);
      expect(result.totals.contractCount).toBe(25);
      // Item shape per row
      const first = result.items[0];
      expect(first).toHaveProperty('contractId');
      expect(first).toHaveProperty('contractNumber');
      expect(first).toHaveProperty('partnerName');
      expect(first).toHaveProperty('revenue');
      expect(first).toHaveProperty('totalCost');
      expect(first).toHaveProperty('profit');
      expect(first).toHaveProperty('margin');
      expect(first).toHaveProperty('marginTier');
      expect(first).toHaveProperty('anchorMonth');
    });

    it('TC-CL-02 — Status whitelist applied at Mongo query (ACTIVE+COMPLETED only)', async () => {
      const { service, contractModel } = setupDashboardService({ contracts: [] });
      await service.getContractsList({});
      const arg = (contractModel.find.mock.calls as any[])[0][0] as {
        status: { $in: string[] };
      };
      expect(arg.status.$in).toEqual(['ACTIVE', 'COMPLETED']);
      for (const excluded of [
        'DRAFT',
        'SENT',
        'ACCEPTED',
        'CONVERTED_TO_CONTRACT',
        'CANCELLED',
        'REJECTED',
      ]) {
        expect(arg.status.$in).not.toContain(excluded);
      }
    });

    it('TC-CL-03 — Search combined matches contractNumber OR partnerName OR raceName', async () => {
      const cA = makeC({
        contractNumber: '14.05/2026/HDDV',
        client: { entityName: 'Zaha' },
        raceName: 'Hai Phong',
      });
      const cB = makeC({
        contractNumber: 'CN-OTHER',
        client: { entityName: 'Thach Sanh' },
        raceName: 'Mau Son',
      });
      const cC = makeC({
        contractNumber: 'CN-XYZ',
        client: { entityName: 'Zaha SubCo' },
        raceName: 'Da Lat',
      });
      const { service } = setupDashboardService({ contracts: [cA, cB, cC] });

      const result = await service.getContractsList({ q: 'Zaha' });
      expect(result.items).toHaveLength(2);
      const ids = result.items.map((i) => i.contractId);
      expect(ids).toContain(cA._id.toString());
      expect(ids).toContain(cC._id.toString());
      expect(ids).not.toContain(cB._id.toString());

      // Match raceName
      const byRace = await service.getContractsList({ q: 'Hai Phong' });
      expect(byRace.items).toHaveLength(1);
      expect(byRace.items[0].contractId).toBe(cA._id.toString());

      // Match contractNumber prefix
      const byNum = await service.getContractsList({ q: '14.05' });
      expect(byNum.items).toHaveLength(1);
      expect(byNum.items[0].contractId).toBe(cA._id.toString());
    });

    it('TC-CL-04 — Pagination boundary: page=2 limit=20 returns items[20..39]', async () => {
      const contracts = Array.from({ length: 50 }, (_, i) =>
        makeC({
          contractNumber: `CN-${String(i + 1).padStart(3, '0')}`,
          // varying signDate so anchorMonth DESC default sort is deterministic
          signDate: new Date(2026, 0, i + 1),
        }),
      );
      const { service } = setupDashboardService({ contracts });

      const page1 = await service.getContractsList({ page: 1, limit: 20 });
      const page2 = await service.getContractsList({ page: 2, limit: 20 });
      const page3 = await service.getContractsList({ page: 3, limit: 20 });

      expect(page1.items).toHaveLength(20);
      expect(page2.items).toHaveLength(20);
      expect(page3.items).toHaveLength(10);
      expect(page2.total).toBe(50);
      expect(page2.totalPages).toBe(3);
      expect(page2.page).toBe(2);

      // No overlap between pages
      const ids1 = new Set(page1.items.map((i) => i.contractId));
      const ids2 = new Set(page2.items.map((i) => i.contractId));
      for (const id of ids2) {
        expect(ids1.has(id)).toBe(false);
      }
    });

    it('TC-CL-05 — Sort margin ASC: loss tier first, neutral (null) LAST', async () => {
      // A healthy (margin=50%), B loss (-10%), C thin (5%), D neutral (rev=0)
      const cA = makeC({
        totalAmount: 200_000_000,
        contractNumber: 'A',
      });
      const cB = makeC({
        totalAmount: 100_000_000,
        contractNumber: 'B',
      });
      const cC = makeC({
        totalAmount: 100_000_000,
        contractNumber: 'C',
      });
      const cD = makeC({
        totalAmount: 0,
        contractNumber: 'D',
      });
      const costMap = new Map<
        string,
        { totalCost: number; costByCategory: Record<string, number> }
      >();
      // A: cost 100M → margin 50% (healthy)
      costMap.set(cA._id.toString(), {
        totalCost: 100_000_000,
        costByCategory: { LABOR: 100_000_000, MATERIAL: 0, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
      });
      // B: cost 110M → margin -10% (loss)
      costMap.set(cB._id.toString(), {
        totalCost: 110_000_000,
        costByCategory: { LABOR: 110_000_000, MATERIAL: 0, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
      });
      // C: cost 95M → margin 5% (thin)
      costMap.set(cC._id.toString(), {
        totalCost: 95_000_000,
        costByCategory: { LABOR: 95_000_000, MATERIAL: 0, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
      });
      // D: rev=0 → margin null (neutral)
      const { service } = setupDashboardService({
        contracts: [cA, cB, cC, cD],
        costMap,
      });

      const result = await service.getContractsList({
        sortBy: 'margin',
        sortDir: 'asc',
      });

      const nums = result.items.map((i) => i.contractNumber);
      expect(nums).toEqual(['B', 'C', 'A', 'D']); // loss → thin → healthy → neutral last
    });

    it('TC-CL-06 — Search regex escape: ReDoS pattern (a+)+$ does NOT timeout, no 500', async () => {
      const c1 = makeC({ contractNumber: 'CN-AAA', client: { entityName: 'aaa' } });
      const { service } = setupDashboardService({ contracts: [c1] });

      const start = Date.now();
      const result = await service.getContractsList({ q: '(a+)+$' });
      const elapsed = Date.now() - start;

      // No timeout — service returns normally
      expect(elapsed).toBeLessThan(500);
      // No match (literal '(a+)+$' không tồn tại trong fixture)
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('TC-CL-07 — Cache hit: 2 same-filter calls → 2nd returns cached without recompute', async () => {
      const c1 = makeC({ totalAmount: 100_000_000 });
      const { service, contractModel, redis } = setupDashboardService({
        contracts: [c1],
      });

      // 1st call — cache miss → compute + SET
      const r1 = await service.getContractsList({ period: 'last_3_months' });
      expect(contractModel.find).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
      const setCallArgs = (redis.set as jest.Mock).mock.calls[0];
      expect(setCallArgs[0]).toMatch(/^pnl:contracts-list:/);
      expect(setCallArgs[2]).toBe('EX');
      expect(setCallArgs[3]).toBe(60);

      // 2nd call — simulate cache hit by returning serialized result
      (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(r1));
      const r2 = await service.getContractsList({ period: 'last_3_months' });

      // contractModel.find called only ONCE total (not twice)
      expect(contractModel.find).toHaveBeenCalledTimes(1);
      expect(r2).toEqual(r1);
    });

    it('TC-CL-08 — Graceful when Redis unavailable (no redis injected) → still computes + returns', async () => {
      const c1 = makeC({ totalAmount: 100_000_000 });
      const contractModel = {
        find: jest.fn(() => ({
          lean: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([c1]) })),
        })),
        findById: jest.fn(),
      };
      const costItemsService = {
        findAllActiveByContract: jest.fn().mockResolvedValue([]),
        aggregateByContractIds: jest.fn().mockResolvedValue(new Map()),
      };
      const feeService = {
        getActualRevenueForRace: jest.fn(),
        getActualRevenueForRaces: jest.fn().mockResolvedValue(new Map()),
      };
      // NO redis (undefined)
      const service = new PnLService(
        contractModel as any,
        costItemsService as any,
        feeService as any,
        undefined,
      );

      const result = await service.getContractsList({});
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('TC-CL-09 — Cache miss + Redis SET fail → graceful, response still returned', async () => {
      const c1 = makeC({ totalAmount: 100_000_000 });
      const { service, redis } = setupDashboardService({ contracts: [c1] });
      (redis.set as jest.Mock).mockRejectedValue(new Error('redis down'));

      // Should NOT throw
      const result = await service.getContractsList({});
      expect(result.items).toHaveLength(1);
    });

    it('TC-CL-10 — Sort by profit DESC: highest profit first', async () => {
      const cA = makeC({
        totalAmount: 100_000_000,
        contractNumber: 'A',
      });
      const cB = makeC({
        totalAmount: 200_000_000,
        contractNumber: 'B',
      });
      const cC = makeC({
        totalAmount: 50_000_000,
        contractNumber: 'C',
      });
      const { service } = setupDashboardService({
        contracts: [cA, cB, cC],
      });

      const result = await service.getContractsList({
        sortBy: 'profit',
        sortDir: 'desc',
      });

      expect(result.items.map((i) => i.contractNumber)).toEqual(['B', 'A', 'C']);
    });

    it('TC-CL-11 — Sort by contractNumber ASC (locale compare for natural order)', async () => {
      const c1 = makeC({ contractNumber: 'CN-003' });
      const c2 = makeC({ contractNumber: 'CN-001' });
      const c3 = makeC({ contractNumber: 'CN-002' });
      const { service } = setupDashboardService({ contracts: [c1, c2, c3] });

      const result = await service.getContractsList({
        sortBy: 'contractNumber',
        sortDir: 'asc',
      });

      expect(result.items.map((i) => i.contractNumber)).toEqual([
        'CN-001',
        'CN-002',
        'CN-003',
      ]);
    });

    it('TC-CL-12 — hashContractsListFilter deterministic across key order', async () => {
      const c1 = makeC({ totalAmount: 100_000_000 });
      const { service, redis } = setupDashboardService({ contracts: [c1] });

      // 2 filters with same logical content but different field set order
      await service.getContractsList({
        page: 1,
        limit: 20,
        period: 'last_3_months',
        sortBy: 'profit',
        sortDir: 'desc',
        q: 'foo',
      });
      await service.getContractsList({
        q: 'foo',
        sortDir: 'desc',
        sortBy: 'profit',
        period: 'last_3_months',
        limit: 20,
        page: 1,
      });

      // Both calls produce SAME cache key (deterministic hash)
      const setKey1 = (redis.set as jest.Mock).mock.calls[0][0];
      const setKey2 = (redis.set as jest.Mock).mock.calls[1][0];
      expect(setKey1).toBe(setKey2);
    });

    it('TC-CL-13 — Empty result: 0 contracts → items=[], total=0, totalPages=0, totals zero', async () => {
      const { service } = setupDashboardService({ contracts: [] });
      const result = await service.getContractsList({});
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.totals.contractCount).toBe(0);
      expect(result.totals.totalRevenue).toBe(0);
      expect(result.totals.totalCost).toBe(0);
    });

    it('TC-CL-14 — Filtered totals reflect search subset (not dataset-wide contractCount)', async () => {
      const cA = makeC({
        totalAmount: 100_000_000,
        client: { entityName: 'Zaha' },
      });
      const cB = makeC({
        totalAmount: 200_000_000,
        client: { entityName: 'Other' },
      });
      const { service } = setupDashboardService({ contracts: [cA, cB] });

      const result = await service.getContractsList({ q: 'Zaha' });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      // Footer summary reflects ONLY filtered (1 contract, 100M), not dataset 2 contracts/300M
      expect(result.totals.contractCount).toBe(1);
      expect(result.totals.totalRevenue).toBe(100_000_000);
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// FEATURE-040 — PnLService integration with FeeService new fee compute
// ════════════════════════════════════════════════════════════════════

describe('F-040 PnLService — fee source integration', () => {
  function buildF040Service(opts: {
    contract: any;
    feeForContract?: any;
    costItems?: any[];
  }) {
    const contractModel = {
      findById: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue(opts.contract),
      })),
    };
    const costItemsService = {
      findAllActiveByContract: jest.fn().mockResolvedValue(opts.costItems ?? []),
    };
    const feeService = {
      getActualRevenueForRace: jest.fn(),
      getFeeForContract: jest.fn().mockResolvedValue(
        opts.feeForContract ?? {
          fee: 0,
          source: 'ESTIMATED',
          grossGMV: 0,
          breakdown: {
            contractId: '',
            feeSource: 'ESTIMATED',
            totalFee: 0,
            grossGMV: 0,
            reconciliations: [],
            computedAt: new Date().toISOString(),
          },
          warnings: [],
        },
      ),
      getFeeForContractsBulk: jest.fn().mockResolvedValue(new Map()),
    };
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    const service = new PnLService(
      contractModel as any,
      costItemsService as any,
      feeService as any,
      redis as any,
    );
    return { service, feeService, redis };
  }

  it('TC-FE-04: Reconciliation full-period override (recon > self-compute priority)', async () => {
    const contract = {
      _id: new Types.ObjectId(),
      contractType: 'TICKET_SALES',
      status: 'ACTIVE',
      linkedTenantId: 20,
      linkedMysqlRaceId: 194,
      effectiveDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      revenueShare: { estimatedFee: 999_999, feePercentage: 7 },
      totalAmount: 0,
      lineItems: [],
      deletedAt: null,
    };
    const { service, feeService } = buildF040Service({
      contract,
      feeForContract: {
        fee: 700_000,
        source: 'RECONCILIATION',
        grossGMV: 18_000_000,
        breakdown: {
          contractId: String(contract._id),
          feeSource: 'RECONCILIATION',
          totalFee: 700_000,
          grossGMV: 18_000_000,
          reconciliations: [
            {
              reconciliationId: 'rec1',
              periodStart: '2026-05-01',
              periodEnd: '2026-05-31',
              status: 'signed',
              feeAmount: 500_000,
              manualFeeAmount: 200_000,
              finalizedAt: '2026-06-01',
            },
          ],
          computedAt: new Date().toISOString(),
        },
        warnings: [],
      },
    });

    const result = await service.getSummary(String(contract._id));
    expect(result.revenue).toBe(700_000);
    expect(result.feeSource).toBe('RECONCILIATION');
    expect(result.feeBreakdown?.reconciliations).toHaveLength(1);
    expect(feeService.getFeeForContract).toHaveBeenCalled();
  });

  it('TC-FE-05: MIXED source — recon partial period + self-compute gap', async () => {
    const contract = {
      _id: new Types.ObjectId(),
      contractType: 'TICKET_SALES',
      status: 'ACTIVE',
      linkedTenantId: 20,
      linkedMysqlRaceId: 194,
      effectiveDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
      revenueShare: { estimatedFee: 0 },
      totalAmount: 0,
      lineItems: [],
      deletedAt: null,
    };
    const { service } = buildF040Service({
      contract,
      feeForContract: {
        fee: 800_000,
        source: 'MIXED',
        grossGMV: 20_000_000,
        breakdown: {
          contractId: String(contract._id),
          feeSource: 'MIXED',
          totalFee: 800_000,
          grossGMV: 20_000_000,
          reconciliations: [
            {
              reconciliationId: 'rec-may',
              periodStart: '2026-05-01',
              periodEnd: '2026-05-31',
              status: 'signed',
              feeAmount: 500_000,
              manualFeeAmount: 100_000,
              finalizedAt: '2026-06-01',
            },
          ],
          selfCompute: {
            count5BIB: 5,
            gross5BIB: 2_000_000,
            feeRatePercent: 7,
            fee5BIB: 140_000,
            countManual: 12,
            manualTicketCount: 12,
            manualFeePerTicket: 5000,
            feeManual: 60_000,
            periodGapStart: '2026-01-01',
            periodGapEnd: '2026-04-30',
          },
          computedAt: new Date().toISOString(),
        },
        warnings: [],
      },
    });

    const result = await service.getSummary(String(contract._id));
    expect(result.revenue).toBe(800_000);
    expect(result.feeSource).toBe('MIXED');
    expect(result.feeBreakdown?.selfCompute?.periodGapStart).toBe('2026-01-01');
  });

  it('TC-FE-09: DRAFT status recon excluded → SELF_COMPUTE (mocked via FeeService)', async () => {
    // FeeService is responsible for filtering; PnLService just consumes result.
    // Verify pass-through semantic: if FeeService returns SELF_COMPUTE (because
    // it filtered DRAFT), PnLService propagates source correctly.
    const contract = {
      _id: new Types.ObjectId(),
      contractType: 'TICKET_SALES',
      status: 'ACTIVE',
      linkedTenantId: 20,
      linkedMysqlRaceId: 194,
      effectiveDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      revenueShare: { estimatedFee: 0 },
      totalAmount: 0,
      lineItems: [],
      deletedAt: null,
    };
    const { service } = buildF040Service({
      contract,
      feeForContract: {
        fee: 1_500_000,
        source: 'SELF_COMPUTE',
        grossGMV: 15_000_000,
        breakdown: {
          contractId: String(contract._id),
          feeSource: 'SELF_COMPUTE',
          totalFee: 1_500_000,
          grossGMV: 15_000_000,
          reconciliations: [], // DRAFT recons filtered out at FeeService layer
          computedAt: new Date().toISOString(),
        },
        warnings: [],
      },
    });
    const result = await service.getSummary(String(contract._id));
    expect(result.feeSource).toBe('SELF_COMPUTE');
    expect(result.feeBreakdown?.reconciliations).toEqual([]);
  });

  it('TC-FE-10: Cache hit — 2 consecutive calls (single contract), Redis get cached value', async () => {
    // PnLService caches summary at `pnl:contract:<id>` (existing F-028). Verify
    // 2nd call returns cached result, FeeService NOT re-invoked.
    const contract = {
      _id: new Types.ObjectId(),
      contractType: 'TICKET_SALES',
      status: 'ACTIVE',
      linkedTenantId: 20,
      linkedMysqlRaceId: 194,
      effectiveDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      revenueShare: { estimatedFee: 0 },
      totalAmount: 0,
      lineItems: [],
      deletedAt: null,
    };
    const cachedSummary = {
      contractId: String(contract._id),
      revenue: 1_279_880,
      revenueSource: 'ACTUAL',
      feeSource: 'SELF_COMPUTE',
      totalCost: 0,
      estimatedCost: 0,
      actualCost: 0,
      totalCostSource: 'none',
      profit: 1_279_880,
      margin: 100,
      marginTier: 'healthy',
      costItemCount: 0,
      costByCategory: { LABOR: 0, MATERIAL: 0, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
    };
    const contractModel = {
      findById: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue(contract),
      })),
    };
    const feeService = {
      getActualRevenueForRace: jest.fn(),
      getFeeForContract: jest.fn(),
      getFeeForContractsBulk: jest.fn(),
    };
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(cachedSummary)),
      set: jest.fn(),
    };
    const service = new PnLService(
      contractModel as any,
      { findAllActiveByContract: jest.fn() } as any,
      feeService as any,
      redis as any,
    );
    const r = await service.getSummary(String(contract._id));
    expect(r.revenue).toBe(1_279_880);
    expect(feeService.getFeeForContract).not.toHaveBeenCalled();
    expect(contractModel.findById).not.toHaveBeenCalled();
  });

  it('TC-FE-16: F-038 list filter by feeSource → only matching items returned', async () => {
    // Inline helpers (this describe block is at module-top scope; can't reach
    // outer-describe-scoped makeC/setupDashboardService).
    const localMake = (over: any = {}) => ({
      _id: new Types.ObjectId(),
      contractType: 'TIMING',
      status: 'ACTIVE',
      totalAmount: 100_000_000,
      acceptanceReport: undefined,
      revenueShare: undefined,
      templateOverrides: {},
      raceName: 'R',
      contractNumber: 'CN',
      deletedAt: null,
      signDate: new Date(),
      createdAt: new Date(),
      lineItems: [],
      ...over,
    });
    const cTicket1 = localMake({
      contractType: 'TICKET_SALES',
      linkedTenantId: 10,
      linkedMysqlRaceId: 100,
      revenueShare: { estimatedFee: 0 },
    });
    const cTicket2 = localMake({
      contractType: 'TICKET_SALES',
      linkedTenantId: 11,
      linkedMysqlRaceId: 200,
      revenueShare: { estimatedFee: 0 },
    });
    const cTicket3 = localMake({
      contractType: 'TICKET_SALES',
      linkedTenantId: 12,
      linkedMysqlRaceId: 300,
      revenueShare: { estimatedFee: 0 },
    });
    const contractModel = {
      find: jest.fn(() => ({
        lean: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue([cTicket1, cTicket2, cTicket3]),
        })),
      })),
      findById: jest.fn(),
    };
    const costItemsService = {
      findAllActiveByContract: jest.fn().mockResolvedValue([]),
      aggregateByContractIds: jest.fn().mockResolvedValue(new Map()),
    };
    const feeService = {
      getActualRevenueForRace: jest.fn(),
      getActualRevenueForRaces: jest.fn().mockResolvedValue(new Map()),
      getFeeForContract: jest.fn(),
      getFeeForContractsBulk: jest.fn().mockResolvedValue(
        new Map<string, any>([
          [String(cTicket1._id), { fee: 100_000, source: 'RECONCILIATION', grossGMV: 1_000_000, breakdown: { contractId: String(cTicket1._id), feeSource: 'RECONCILIATION', totalFee: 100_000, grossGMV: 1_000_000, reconciliations: [], computedAt: new Date().toISOString() }, warnings: [] }],
          [String(cTicket2._id), { fee: 200_000, source: 'SELF_COMPUTE', grossGMV: 2_000_000, breakdown: { contractId: String(cTicket2._id), feeSource: 'SELF_COMPUTE', totalFee: 200_000, grossGMV: 2_000_000, reconciliations: [], computedAt: new Date().toISOString() }, warnings: [] }],
          [String(cTicket3._id), { fee: 300_000, source: 'SELF_COMPUTE', grossGMV: 3_000_000, breakdown: { contractId: String(cTicket3._id), feeSource: 'SELF_COMPUTE', totalFee: 300_000, grossGMV: 3_000_000, reconciliations: [], computedAt: new Date().toISOString() }, warnings: [] }],
        ]),
      ),
    };
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    const service = new PnLService(
      contractModel as any,
      costItemsService as any,
      feeService as any,
      redis as any,
    );

    const r = await service.getContractsList({
      feeSource: 'SELF_COMPUTE',
    } as any);
    expect(r.items).toHaveLength(2);
    expect(r.items.every((i) => i.feeSource === 'SELF_COMPUTE')).toBe(true);
    expect(r.totals.feeSourceMix.reconciliation).toBe(1);
    expect(r.totals.feeSourceMix.selfCompute).toBe(2);
  });
});
