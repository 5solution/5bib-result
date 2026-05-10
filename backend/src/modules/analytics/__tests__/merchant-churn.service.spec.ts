import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MerchantChurnService } from '../services/merchant-churn.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

function makeRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  } as unknown as Redis;
}

function makeDb(rows: unknown[]) {
  return { query: jest.fn().mockResolvedValue(rows) } as unknown as DataSource;
}

async function build(db: DataSource, redis: Redis) {
  const m = await Test.createTestingModule({
    providers: [
      MerchantChurnService,
      { provide: getDataSourceToken('platform'), useValue: db },
      { provide: REDIS_TOKEN, useValue: redis },
    ],
  }).compile();
  return m.get(MerchantChurnService);
}

describe('MerchantChurnService', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const month = 30 * day;

  it('phân loại đúng: ACTIVE (<4mo) / AT_RISK (4-6mo) / CHURNED (≥6mo)', async () => {
    const db = makeDb([
      {
        tenant_id: 1,
        merchant_name: 'A',
        total_races: 5,
        last_race_date: new Date(now - 1 * month),
      },
      {
        tenant_id: 2,
        merchant_name: 'B',
        total_races: 3,
        last_race_date: new Date(now - 5 * month),
      },
      {
        tenant_id: 3,
        merchant_name: 'C',
        total_races: 1,
        last_race_date: new Date(now - 7 * month),
      },
    ]);
    const svc = await build(db, makeRedis());
    const r = await svc.getChurn({ period: 'quarter' });
    expect(r.totalMerchants).toBe(3);
    expect(r.atRiskCount).toBe(1);
    expect(r.churnedCount).toBe(1);
    expect(r.atRiskList[0].merchantName).toBe('B');
    expect(r.churnedList[0].merchantName).toBe('C');
  });

  it('edge: 0 merchants → churnRate 0', async () => {
    const svc = await build(makeDb([]), makeRedis());
    const r = await svc.getChurn({ period: 'year' });
    expect(r.churnRate).toBe(0);
  });

  it('edge: tất cả ACTIVE → churnRate 0', async () => {
    const db = makeDb([
      {
        tenant_id: 1,
        merchant_name: 'A',
        total_races: 1,
        last_race_date: new Date(now - 10 * day),
      },
    ]);
    const svc = await build(db, makeRedis());
    const r = await svc.getChurn({ period: 'quarter' });
    expect(r.churnRate).toBe(0);
    expect(r.atRiskCount).toBe(0);
  });

  it('invariant BR-04: SQL filter draft + deleted', async () => {
    const db = makeDb([]);
    const svc = await build(db, makeRedis());
    await svc.getChurn({ period: 'quarter' });
    const queryFn = (db as unknown as { query: jest.Mock }).query;
    const sql = String(queryFn.mock.calls[0][0]);
    expect(sql).toContain("status != 'draft'");
    expect(sql).toContain('is_delete = 0');
  });

  it('cache hit short-circuit', async () => {
    const cached = { churnRate: 5, totalMerchants: 10 };
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(cached)),
      set: jest.fn(),
    } as unknown as Redis;
    const db = makeDb([]);
    const svc = await build(db, redis);
    const r = await svc.getChurn({ period: 'quarter' });
    expect(r.churnRate).toBe(5);
    const queryFn = (db as unknown as { query: jest.Mock }).query;
    expect(queryFn).not.toHaveBeenCalled();
  });
});
