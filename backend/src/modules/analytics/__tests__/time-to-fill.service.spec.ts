import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { getDataSourceToken } from '@nestjs/typeorm';
import { TimeToFillService } from '../services/time-to-fill.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';
const makeRedis = () =>
  ({ get: jest.fn().mockResolvedValue(null), set: jest.fn() } as unknown as Redis);
const makeDb = (rows: unknown[] | Error) =>
  ({
    query: jest.fn().mockImplementation(() =>
      rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows),
    ),
  } as unknown as DataSource);

async function build(db: DataSource, redis: Redis) {
  const m = await Test.createTestingModule({
    providers: [
      TimeToFillService,
      { provide: getDataSourceToken('platform'), useValue: db },
      { provide: REDIS_TOKEN, useValue: redis },
    ],
  }).compile();
  return m.get(TimeToFillService);
}

describe('TimeToFillService', () => {
  it('tính hours-to-fill khi paid >= quota', async () => {
    const open = new Date('2026-04-01T00:00:00Z');
    const filled = new Date('2026-04-03T12:00:00Z'); // 60h sau
    const svc = await build(
      makeDb([
        {
          course_id: 1,
          course_name: '21K',
          quota: 100,
          race_id: 10,
          race_name: 'FUYU',
          open_at: open,
          paid_count: 100,
          last_paid_at: filled,
        },
      ]),
      makeRedis(),
    );
    const r = await svc.getTimeToFill({ period: 'quarter' });
    expect(r.courses[0].status).toBe('FILLED');
    expect(r.courses[0].hoursToFill).toBe(60);
    expect(r.courses[0].fillRate).toBe(100);
  });

  it('course chưa fill → status OPEN, hoursToFill null', async () => {
    const svc = await build(
      makeDb([
        {
          course_id: 2,
          course_name: '5K',
          quota: 200,
          race_id: 11,
          race_name: 'X',
          open_at: new Date(),
          paid_count: 50,
          last_paid_at: null,
        },
      ]),
      makeRedis(),
    );
    const r = await svc.getTimeToFill({ period: 'quarter' });
    expect(r.courses[0].status).toBe('OPEN');
    expect(r.courses[0].hoursToFill).toBeNull();
    expect(r.courses[0].fillRate).toBe(25);
  });

  it('quota = 0 → fillRate 0, không divide-by-zero', async () => {
    const svc = await build(
      makeDb([
        {
          course_id: 3,
          course_name: 'L',
          quota: 0,
          race_id: 12,
          race_name: 'Y',
          open_at: new Date(),
          paid_count: 5,
          last_paid_at: null,
        },
      ]),
      makeRedis(),
    );
    const r = await svc.getTimeToFill({ period: 'quarter' });
    expect(r.courses[0].fillRate).toBe(0);
  });

  it('schema fallback: query throw → trả empty array (không throw)', async () => {
    const svc = await build(
      makeDb(new Error('table not found')),
      makeRedis(),
    );
    const r = await svc.getTimeToFill({ period: 'quarter' });
    expect(r.courses).toEqual([]);
    expect(r.medianHoursToFill).toBeNull();
  });

  it('median hoursToFill chỉ tính course đã fill', async () => {
    const open = new Date('2026-04-01T00:00:00Z');
    const svc = await build(
      makeDb([
        {
          course_id: 1,
          course_name: 'A',
          quota: 50,
          race_id: 10,
          race_name: 'FUYU',
          open_at: open,
          paid_count: 50,
          last_paid_at: new Date(open.getTime() + 24 * 3600 * 1000),
        },
        {
          course_id: 2,
          course_name: 'B',
          quota: 100,
          race_id: 10,
          race_name: 'FUYU',
          open_at: open,
          paid_count: 30,
          last_paid_at: null,
        },
      ]),
      makeRedis(),
    );
    const r = await svc.getTimeToFill({ period: 'quarter' });
    expect(r.medianHoursToFill).toBe(24);
  });
});
