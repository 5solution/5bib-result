/**
 * F-028 cost-items.service.spec.ts
 *
 * Covers:
 *   - BR-PNL-09 audit log mọi mutation
 *   - BR-PNL-10 soft delete
 *   - BR-PNL-11 edit anytime kể cả COMPLETED contract (KHÔNG check status)
 *   - BR-PNL-14 cache invalidate triggers
 *   - validation amount/category — UP-01, UP-02 (handled via DTO class-validator,
 *     here verify mapping + ObjectId guard)
 */
import { Types } from 'mongoose';
import { CostItemsService } from './cost-items.service';

function mockSaveable(doc: Record<string, unknown>) {
  return {
    ...doc,
    save: jest.fn().mockImplementation(async function (this: any) {
      return this;
    }),
  };
}

describe('F-028 CostItemsService', () => {
  let service: CostItemsService;
  let model: any;
  let audit: any;
  let redis: any;
  let saved: any;

  beforeEach(() => {
    const contractObjectId = new Types.ObjectId();

    saved = mockSaveable({
      _id: new Types.ObjectId(),
      contractId: contractObjectId,
      description: 'Existing item',
      category: 'LABOR',
      amount: 5_000_000,
      note: undefined,
      incurredDate: undefined,
      createdBy: 'u-1',
      updatedBy: undefined,
      deletedAt: null,
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
    });

    model = {
      create: jest.fn(async (payload: any) =>
        mockSaveable({
          _id: new Types.ObjectId(),
          createdAt: new Date('2026-05-12T00:00:00Z'),
          updatedAt: new Date('2026-05-12T00:00:00Z'),
          updatedBy: undefined,
          deletedAt: null,
          ...payload,
        }),
      ),
      find: jest.fn(() => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              exec: jest.fn().mockResolvedValue([saved]),
            }),
          }),
        }),
        exec: jest.fn().mockResolvedValue([saved]),
      })),
      countDocuments: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue(1),
      })),
      findById: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue(saved),
      })),
    };

    audit = { emit: jest.fn().mockResolvedValue(undefined) };

    redis = {
      del: jest.fn().mockResolvedValue(1),
      scanStream: jest.fn(() => {
        const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
        const stream = {
          on: (evt: string, cb: (...args: unknown[]) => void) => {
            handlers[evt] = handlers[evt] ?? [];
            handlers[evt].push(cb);
            // trigger end synchronously
            if (evt === 'end') {
              setImmediate(() => cb());
            }
            return stream;
          },
        };
        return stream;
      }),
      pipeline: jest.fn(() => ({ del: jest.fn(), exec: jest.fn() })),
    };

    service = new CostItemsService(model, audit, redis);
  });

  it('BR-PNL-09 create cost item → audit log emit + cache invalidate', async () => {
    const contractId = new Types.ObjectId().toString();
    const result = await service.create(
      contractId,
      {
        description: 'Vật tư biển báo',
        category: 'MATERIAL',
        amount: 12_000_000,
      },
      'admin-1',
    );

    expect(result.description).toBe('Vật tư biển báo');
    expect(result.category).toBe('MATERIAL');
    expect(result.amount).toBe(12_000_000);
    expect(result.id).toBeDefined();
    expect(result.contractId).toBe(contractId);

    expect(model.create).toHaveBeenCalled();
    expect(audit.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance.cost_item.create',
        actor: { userId: 'admin-1' },
      }),
    );
    expect(redis.del).toHaveBeenCalledWith(`pnl:contract:${contractId}`);
  });

  it('Invalid contractId → BadRequestException', async () => {
    await expect(
      service.create(
        'not-an-objectid',
        { description: 'x', category: 'OTHER', amount: 0 },
        'admin',
      ),
    ).rejects.toThrow(/Invalid contractId/);
  });

  it('BR-PNL-11 update — edit anytime kể cả deletedAt=null (no freeze)', async () => {
    const contractId = saved.contractId.toString();
    const result = await service.update(
      contractId,
      saved._id.toString(),
      { amount: 7_500_000, note: 'cập nhật sau race' },
      'admin-2',
    );

    expect(result.amount).toBe(7_500_000);
    expect(result.note).toBe('cập nhật sau race');
    expect(saved.save).toHaveBeenCalled();
    expect(audit.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance.cost_item.update',
        metadata: expect.objectContaining({
          before: expect.objectContaining({ amount: 5_000_000 }),
        }),
      }),
    );
  });

  it('UP-05 — update soft-deleted cost item → BadRequestException', async () => {
    saved.deletedAt = new Date();
    await expect(
      service.update(
        saved.contractId.toString(),
        saved._id.toString(),
        { amount: 1 },
        'admin',
      ),
    ).rejects.toThrow(/đã xóa/);
  });

  it('BR-PNL-10 softDelete sets deletedAt + audit log delete', async () => {
    const contractId = saved.contractId.toString();
    const result = await service.softDelete(
      contractId,
      saved._id.toString(),
      'admin-3',
    );

    expect(result).toEqual({ success: true });
    expect(saved.deletedAt).toBeInstanceOf(Date);
    expect(audit.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance.cost_item.delete',
      }),
    );
  });

  it('softDelete idempotent — delete twice không throw', async () => {
    saved.deletedAt = new Date();
    const result = await service.softDelete(
      saved.contractId.toString(),
      saved._id.toString(),
      'admin',
    );
    expect(result).toEqual({ success: true });
  });

  it('findOne — cost item của contract khác → NotFoundException (boundary)', async () => {
    await expect(
      service.findOne(new Types.ObjectId().toString(), saved._id.toString()),
    ).rejects.toThrow(/không thuộc contract/);
  });

  it('list — pagination + sort createdAt desc', async () => {
    const contractId = saved.contractId.toString();
    const result = await service.list(contractId, 1, 20);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(saved._id.toString());
  });
});
