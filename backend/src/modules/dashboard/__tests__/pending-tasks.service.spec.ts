import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardPendingTasksService } from '../services/pending-tasks.service';
import { ResultClaim } from '../../race-result/schemas/result-claim.schema';
import { Reconciliation } from '../../reconciliation/schemas/reconciliation.schema';
import { Race } from '../../races/schemas/race.schema';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('DashboardPendingTasksService', () => {
  let service: DashboardPendingTasksService;
  let mockClaim: { countDocuments: jest.Mock };
  let mockRecon: { countDocuments: jest.Mock };
  let mockRace: { find: jest.Mock };
  let mockRedis: { get: jest.Mock; set: jest.Mock; hlen: jest.Mock };

  beforeEach(async () => {
    mockClaim = { countDocuments: jest.fn().mockResolvedValue(0) };
    mockRecon = { countDocuments: jest.fn().mockResolvedValue(0) };
    mockRace = { find: jest.fn() };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      hlen: jest.fn().mockResolvedValue(0),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardPendingTasksService,
        { provide: getModelToken(ResultClaim.name), useValue: mockClaim },
        { provide: getModelToken(Reconciliation.name), useValue: mockRecon },
        { provide: getModelToken(Race.name), useValue: mockRace },
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    service = moduleRef.get(DashboardPendingTasksService);

    mockRace.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
  });

  it('BR-DASH-13: trả 4 nhóm cố định + total', async () => {
    mockClaim.countDocuments.mockResolvedValue(7);
    mockRecon.countDocuments.mockResolvedValue(2);
    const res = await service.getPendingTasks();
    expect(res.groups).toHaveLength(4);
    expect(res.groups.map((g) => g.key)).toEqual([
      'claims',
      'recon',
      'master_data',
      'chip',
    ]);
    expect(res.total).toBe(9);
  });

  it('Claim count chỉ tính status=pending', async () => {
    await service.getPendingTasks();
    expect(mockClaim.countDocuments).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('Recon count tính draft/ready/flagged', async () => {
    await service.getPendingTasks();
    expect(mockRecon.countDocuments).toHaveBeenCalledWith({
      status: { $in: ['draft', 'ready', 'flagged'] },
    });
  });

  it('BR-DASH-14: cache hit trả ngay không count DB', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify({ groups: [], total: 99 }),
    );
    const res = await service.getPendingTasks();
    expect(res.total).toBe(99);
    expect(mockClaim.countDocuments).not.toHaveBeenCalled();
  });

  it('BR-DASH-14: cache miss → ghi cache TTL 60s', async () => {
    await service.getPendingTasks();
    expect(mockRedis.set).toHaveBeenCalledWith(
      'dashboard:pending-tasks',
      expect.any(String),
      'EX',
      60,
    );
  });

  it('BR-DASH-22: total = 0 → vẫn trả 4 nhóm (UI render empty)', async () => {
    const res = await service.getPendingTasks();
    expect(res.groups).toHaveLength(4);
    expect(res.total).toBe(0);
  });

  it('Resilient: countDocuments lỗi → trả 0 không throw', async () => {
    mockClaim.countDocuments.mockRejectedValue(new Error('mongo down'));
    const res = await service.getPendingTasks();
    const claims = res.groups.find((g) => g.key === 'claims');
    expect(claims?.count).toBe(0);
  });
});
