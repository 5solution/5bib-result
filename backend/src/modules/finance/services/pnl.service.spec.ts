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
  const feeService = {
    getActualRevenueForRace: jest.fn().mockResolvedValue(feeResult),
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
});
