import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { getDataSourceToken } from '@nestjs/typeorm';
import { RepeatAthleteService } from '../services/repeat-athlete.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

function makeRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  } as unknown as Redis;
}

function makeDb(rows: unknown[]) {
  return {
    query: jest.fn().mockResolvedValue(rows),
  } as unknown as DataSource;
}

async function build(db: DataSource, redis: Redis) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RepeatAthleteService,
      { provide: getDataSourceToken('platform'), useValue: db },
      { provide: REDIS_TOKEN, useValue: redis },
    ],
  }).compile();
  return moduleRef.get(RepeatAthleteService);
}

describe('RepeatAthleteService', () => {
  it('happy path: 2/4 athletes lặp → rate 50%', async () => {
    const db = makeDb([
      { athletes_id: 1, race_count: 2 },
      { athletes_id: 2, race_count: 1 },
      { athletes_id: 3, race_count: 3 },
      { athletes_id: 4, race_count: 1 },
    ]);
    const svc = await build(db, makeRedis());
    const r = await svc.getRate({ period: 'rolling12m' });
    expect(r.totalAthletes).toBe(4);
    expect(r.repeatAthletes).toBe(2);
    expect(r.rate).toBe(50);
  });

  it('edge: 0 athletes → rate 0, không divide-by-zero', async () => {
    const svc = await build(makeDb([]), makeRedis());
    const r = await svc.getRate({ period: '30d' });
    expect(r.rate).toBe(0);
    expect(r.totalAthletes).toBe(0);
  });

  it('edge: tất cả athletes chỉ 1 race → repeat 0', async () => {
    const db = makeDb([
      { athletes_id: 1, race_count: 1 },
      { athletes_id: 2, race_count: 1 },
    ]);
    const svc = await build(db, makeRedis());
    const r = await svc.getRate({ period: '30d' });
    expect(r.repeatAthletes).toBe(0);
    expect(r.rate).toBe(0);
  });

  it('invariant BR-04: SQL phải có status != draft + is_delete = 0', async () => {
    const db = makeDb([{ athletes_id: 1, race_count: 2 }]);
    const svc = await build(db, makeRedis());
    await svc.getRate({ period: '7d' });
    const queryFn = (db as unknown as { query: jest.Mock }).query;
    const sqlCalls = queryFn.mock.calls.map((c) => String(c[0]));
    const matches = sqlCalls.filter(
      (s) => s.includes("status != 'draft'") && s.includes('is_delete = 0'),
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  it('invariant BR-05: dedupe theo athletes_id (KHÔNG bib)', async () => {
    const db = makeDb([{ athletes_id: 99, race_count: 2 }]);
    const svc = await build(db, makeRedis());
    await svc.getRate({ period: '7d' });
    const queryFn = (db as unknown as { query: jest.Mock }).query;
    const sqlCalls = queryFn.mock.calls.map((c) => String(c[0]));
    const groupCalls = sqlCalls.filter((s) => s.includes('GROUP BY a.athletes_id'));
    expect(groupCalls.length).toBeGreaterThan(0);
    expect(sqlCalls.some((s) => /GROUP BY[^;]*bib_number/i.test(s))).toBe(false);
  });
});
