import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DashboardRecentActivityService } from '../services/recent-activity.service';
import { AuditLog } from '../../audit/schemas/audit-log.schema';

describe('DashboardRecentActivityService', () => {
  let service: DashboardRecentActivityService;
  let mockModel: { find: jest.Mock };

  beforeEach(async () => {
    mockModel = { find: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardRecentActivityService,
        { provide: getModelToken(AuditLog.name), useValue: mockModel },
      ],
    }).compile();
    service = moduleRef.get(DashboardRecentActivityService);
  });

  function mockChain(docs: unknown[]) {
    mockModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(docs),
    });
  }

  it('BR-DASH-16: sort createdAt DESC, limit mặc định 10', async () => {
    mockChain([]);
    await service.getRecentActivity();
    const chain = mockModel.find.mock.results[0].value;
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('Map document → DTO đầy đủ field', async () => {
    const id = new Types.ObjectId();
    const at = new Date('2026-05-10T03:00:00Z');
    mockChain([
      {
        _id: id,
        actor: { userId: 'u1', displayName: 'Danny', role: 'admin' },
        action: 'race.publish',
        entity: { type: 'race', id: 'r1', displayName: 'VMM' },
        metadata: { from: 'pre_race', to: 'live' },
        createdAt: at,
      },
    ]);
    const res = await service.getRecentActivity();
    expect(res.items).toHaveLength(1);
    const item = res.items[0];
    expect(item.action).toBe('race.publish');
    expect(item.actor.displayName).toBe('Danny');
    expect(item.entity.id).toBe('r1');
    expect(item.metadata).toEqual({ from: 'pre_race', to: 'live' });
    expect(item.createdAt).toBe(at.toISOString());
  });

  it('Edge: limit > MAX → clamp về 50', async () => {
    mockChain([]);
    await service.getRecentActivity(999);
    const chain = mockModel.find.mock.results[0].value;
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('Edge: limit ≤ 0 → clamp về 1', async () => {
    mockChain([]);
    await service.getRecentActivity(0);
    const chain = mockModel.find.mock.results[0].value;
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('Resilient: DB fail → trả mảng rỗng', async () => {
    mockModel.find.mockImplementation(() => {
      throw new Error('mongo down');
    });
    const res = await service.getRecentActivity();
    expect(res.items).toEqual([]);
  });
});
