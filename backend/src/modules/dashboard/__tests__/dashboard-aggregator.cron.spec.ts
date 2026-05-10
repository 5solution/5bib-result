import { Test, TestingModule } from '@nestjs/testing';
import { DashboardAggregatorCron } from '../services/dashboard-aggregator.cron';
import { DashboardSparklineService } from '../services/sparkline.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('DashboardAggregatorCron', () => {
  let cron: DashboardAggregatorCron;
  let mockSparkline: { refreshCache: jest.Mock };
  let mockRedis: { set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    mockSparkline = { refreshCache: jest.fn().mockResolvedValue(undefined) };
    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardAggregatorCron,
        {
          provide: DashboardSparklineService,
          useValue: mockSparkline,
        },
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    cron = moduleRef.get(DashboardAggregatorCron);
  });

  it('SETNX lock acquire OK → call refreshCache + DEL lock', async () => {
    await cron.aggregate();
    expect(mockRedis.set).toHaveBeenCalledWith(
      'dashboard:cron-lock:sparkline',
      expect.any(String),
      'EX',
      3300,
      'NX',
    );
    expect(mockSparkline.refreshCache).toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalledWith('dashboard:cron-lock:sparkline');
  });

  it('SETNX lock fail (đã có cron khác) → skip không call refreshCache', async () => {
    mockRedis.set.mockResolvedValue(null);
    await cron.aggregate();
    expect(mockSparkline.refreshCache).not.toHaveBeenCalled();
  });

  it('refreshCache throw → vẫn DEL lock (finally)', async () => {
    mockSparkline.refreshCache.mockRejectedValue(new Error('boom'));
    await cron.aggregate();
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('Resilient: SETNX throw → log + return false (skip)', async () => {
    mockRedis.set.mockRejectedValue(new Error('redis down'));
    await cron.aggregate();
    expect(mockSparkline.refreshCache).not.toHaveBeenCalled();
  });
});
