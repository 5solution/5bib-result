import { Test, TestingModule } from '@nestjs/testing';
import { DashboardSystemStatusService } from '../services/system-status.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('DashboardSystemStatusService', () => {
  let service: DashboardSystemStatusService;
  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    scan: jest.Mock;
  };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      // SCAN signature: scan(cursor, 'MATCH', pattern, 'COUNT', n) -> [nextCursor, keys[]]
      scan: jest.fn().mockResolvedValue(['0', []]),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardSystemStatusService,
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    service = moduleRef.get(DashboardSystemStatusService);
  });

  it('BR-DASH-19: trả 4 service status (api/mylaps/email/storage)', async () => {
    const res = await service.getSystemStatus();
    expect(res.services).toHaveLength(4);
    expect(res.services.map((s) => s.key)).toEqual([
      'api',
      'mylaps',
      'email',
      'storage',
    ]);
  });

  it('Cache hit: trả ngay từ Redis', async () => {
    const cached = {
      services: [],
      systemDown: false,
      checkedAt: '2026-05-10',
    };
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(cached));
    const res = await service.getSystemStatus();
    expect(res).toEqual(cached);
  });

  it('Cache miss: ghi cache TTL 60s', async () => {
    await service.getSystemStatus();
    expect(mockRedis.set).toHaveBeenCalledWith(
      'dashboard:system-status',
      expect.any(String),
      'EX',
      60,
    );
  });

  it('MyLaps degraded khi không có cron-lock keys', async () => {
    mockRedis.scan.mockResolvedValue(['0', []]);
    const res = await service.getSystemStatus();
    const mylaps = res.services.find((s) => s.key === 'mylaps');
    expect(mylaps?.status).toBe('degraded');
  });

  it('MyLaps OK khi có cron-lock active', async () => {
    mockRedis.scan.mockResolvedValue(['0', ['master:cron-lock:r1']]);
    const res = await service.getSystemStatus();
    const mylaps = res.services.find((s) => s.key === 'mylaps');
    expect(mylaps?.status).toBe('ok');
  });

  it('BR-DASH-25 circuit breaker: Redis timeout không block (mylaps=down)', async () => {
    mockRedis.scan.mockImplementation(
      () => new Promise(() => undefined), // hang forever
    );
    const start = Date.now();
    const res = await service.getSystemStatus();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(4500);
    const mylaps = res.services.find((s) => s.key === 'mylaps');
    expect(mylaps?.status).toBe('down');
  }, 6000);

  it('BR-DASH-19 KHÔNG leak credential trong response', async () => {
    const res = await service.getSystemStatus();
    const json = JSON.stringify(res);
    expect(json).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(json).not.toMatch(/secret/i);
  });

  it('systemDown = false khi không có service đỏ', async () => {
    const res = await service.getSystemStatus();
    expect(res.systemDown).toBe(false);
  });
});
