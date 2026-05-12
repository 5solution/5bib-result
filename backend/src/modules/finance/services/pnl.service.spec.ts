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
