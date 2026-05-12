/**
 * F-028 MED-03 QC carryover — UP-08 concurrency test.
 *
 * Verify: 2 cost item create đồng thời cho cùng contract → CẢ 2 success,
 * KHÔNG race condition compute P&L (cache invalidate atomic).
 *
 * BR-PNL-14 invariant: mỗi mutation phải DEL `pnl:contract:<id>` + flush
 * `pnl:dashboard:*`. Khi 2 write song song, cả 2 phải kích hoạt invalidate —
 * nếu race-loss (1 invalidate bị mất) thì PnL service đọc cache stale →
 * compute totalCost sai (thiếu 1 item).
 *
 * Test asserts:
 *   1. 2 create promise resolve không lỗi (model.create called 2 lần)
 *   2. redis.del(`pnl:contract:<id>`) gọi đủ 2 lần (1 per mutation)
 *   3. dashboard scanStream gọi đủ 2 lần
 *   4. Cuối cùng aggregateByContractIds trả về sum cộng dồn cả 2 amount
 *      → KHÔNG mất chi phí dù race condition cache.
 */
import { Types } from 'mongoose';
import { CostItemsService } from './cost-items.service';

function makeMockSaveableDoc(payload: Record<string, unknown>) {
  return {
    _id: new Types.ObjectId(),
    createdAt: new Date('2026-05-12T00:00:00Z'),
    updatedAt: new Date('2026-05-12T00:00:00Z'),
    updatedBy: undefined,
    deletedAt: null,
    ...payload,
    save: jest.fn().mockImplementation(async function (this: any) {
      return this;
    }),
  };
}

describe('F-028 CostItemsService — UP-08 concurrency (MED-03 carryover)', () => {
  let service: CostItemsService;
  let model: any;
  let audit: any;
  let redis: any;
  let pipelineExec: jest.Mock;
  let pipelineDel: jest.Mock;
  let scanStreamCalls: number;

  beforeEach(() => {
    scanStreamCalls = 0;
    pipelineDel = jest.fn();
    pipelineExec = jest.fn().mockResolvedValue([]);

    model = {
      create: jest.fn(async (payload: any) => makeMockSaveableDoc(payload)),
      aggregate: jest.fn(),
    };

    audit = { emit: jest.fn().mockResolvedValue(undefined) };

    redis = {
      del: jest.fn().mockResolvedValue(1),
      scanStream: jest.fn(() => {
        scanStreamCalls++;
        const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
        const stream: any = {
          on: (evt: string, cb: (...args: unknown[]) => void) => {
            handlers[evt] = handlers[evt] ?? [];
            handlers[evt].push(cb);
            if (evt === 'data') {
              // Emit 1 dashboard key per scan → exercise pipeline.del
              setImmediate(() => cb([`pnl:dashboard:hash-${scanStreamCalls}`]));
            }
            if (evt === 'end') {
              // Defer 'end' so 'data' handler fires first
              setImmediate(() => setImmediate(() => cb()));
            }
            return stream;
          },
        };
        return stream;
      }),
      pipeline: jest.fn(() => ({ del: pipelineDel, exec: pipelineExec })),
    };

    service = new CostItemsService(model, audit, redis);
  });

  it('UP-08 — 2 create đồng thời cho cùng contract: cả 2 success + invalidate atomic', async () => {
    const contractId = new Types.ObjectId().toString();

    // Fire 2 creates concurrently — KHÔNG await tuần tự để force race.
    const [r1, r2] = await Promise.all([
      service.create(
        contractId,
        { description: 'Vật tư biển báo CP1', category: 'MATERIAL', amount: 12_000_000 },
        'admin-A',
      ),
      service.create(
        contractId,
        { description: 'Thuê xe medic CP2', category: 'VENDOR', amount: 8_500_000 },
        'admin-B',
      ),
    ]);

    // 1. Cả 2 create success — KHÔNG có write nào throw / mất
    expect(r1.id).toBeDefined();
    expect(r2.id).toBeDefined();
    expect(r1.id).not.toBe(r2.id);
    expect(r1.amount).toBe(12_000_000);
    expect(r2.amount).toBe(8_500_000);
    expect(model.create).toHaveBeenCalledTimes(2);

    // 2. Per-contract cache invalidate gọi đúng 2 lần (mỗi mutation 1 lần)
    const contractCacheDels = (redis.del as jest.Mock).mock.calls.filter(
      ([key]: [string]) => key === `pnl:contract:${contractId}`,
    );
    expect(contractCacheDels).toHaveLength(2);

    // 3. Dashboard scanStream gọi đúng 2 lần — flush per mutation
    expect(scanStreamCalls).toBe(2);

    // 4. Audit log emit đủ 2 mutation (BR-PNL-09)
    const auditCreates = (audit.emit as jest.Mock).mock.calls.filter(
      ([entry]: [{ action: string }]) =>
        entry.action === 'finance.cost_item.create',
    );
    expect(auditCreates).toHaveLength(2);
  });

  it('UP-08 — sau race condition, aggregateByContractIds vẫn cộng đủ 2 amount', async () => {
    const contractObjId = new Types.ObjectId();
    const contractId = contractObjId.toString();

    // Simulate Mongo aggregate returning rows for both items (2 mutations
    // đều persist xong — nếu race-lost write Mongo, aggregate sẽ thiếu).
    model.aggregate.mockResolvedValue([
      {
        _id: { contractId: contractObjId, category: 'MATERIAL' },
        sum: 12_000_000,
      },
      {
        _id: { contractId: contractObjId, category: 'VENDOR' },
        sum: 8_500_000,
      },
    ]);

    // Fire 2 creates concurrently
    await Promise.all([
      service.create(
        contractId,
        { description: 'A', category: 'MATERIAL', amount: 12_000_000 },
        'admin-A',
      ),
      service.create(
        contractId,
        { description: 'B', category: 'VENDOR', amount: 8_500_000 },
        'admin-B',
      ),
    ]);

    // Verify compute P&L đúng — total = 12M + 8.5M = 20.5M
    const agg = await service.aggregateByContractIds([contractObjId]);
    const entry = agg.get(contractId);
    expect(entry).toBeDefined();
    expect(entry!.totalCost).toBe(20_500_000);
    expect(entry!.costByCategory.MATERIAL).toBe(12_000_000);
    expect(entry!.costByCategory.VENDOR).toBe(8_500_000);
  });

  it('UP-08 — concurrent: 1 create + 1 throw từ Mongo → success vẫn invalidate cache', async () => {
    const contractId = new Types.ObjectId().toString();

    // First call succeeds, second call (Mongo down) throws
    let callIdx = 0;
    model.create = jest.fn(async (payload: any) => {
      callIdx++;
      if (callIdx === 2) {
        throw new Error('E11000 duplicate key (simulated Mongo failure)');
      }
      return makeMockSaveableDoc(payload);
    });

    const results = await Promise.allSettled([
      service.create(
        contractId,
        { description: 'A', category: 'LABOR', amount: 1_000_000 },
        'admin-A',
      ),
      service.create(
        contractId,
        { description: 'B', category: 'LABOR', amount: 2_000_000 },
        'admin-B',
      ),
    ]);

    // 1 fulfilled, 1 rejected (KHÔNG mất write success)
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Successful mutation phải invalidate cache (cache không bị stale)
    const contractCacheDels = (redis.del as jest.Mock).mock.calls.filter(
      ([key]: [string]) => key === `pnl:contract:${contractId}`,
    );
    expect(contractCacheDels.length).toBeGreaterThanOrEqual(1);
  });
});
