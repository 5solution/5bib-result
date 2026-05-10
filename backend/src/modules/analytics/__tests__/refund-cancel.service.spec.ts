import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { getDataSourceToken } from '@nestjs/typeorm';
import { RefundCancelService } from '../services/refund-cancel.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';
const makeRedis = () =>
  ({ get: jest.fn().mockResolvedValue(null), set: jest.fn() } as unknown as Redis);

function makeDbSeq(responses: unknown[][]) {
  let i = 0;
  return {
    query: jest.fn().mockImplementation(() =>
      Promise.resolve(responses[Math.min(i++, responses.length - 1)]),
    ),
  } as unknown as DataSource;
}

async function build(db: DataSource, redis: Redis) {
  const m = await Test.createTestingModule({
    providers: [
      RefundCancelService,
      { provide: getDataSourceToken('platform'), useValue: db },
      { provide: REDIS_TOKEN, useValue: redis },
    ],
  }).compile();
  return m.get(RefundCancelService);
}

describe('RefundCancelService', () => {
  it('happy: refund=4%, cancel=2% → refundOverThreshold true', async () => {
    const status = [
      { status: 'paid', cnt: 90 },
      { status: 'refunded', cnt: 4 },
      { status: 'cancelled', cnt: 2 },
      { status: 'voided', cnt: 4 },
    ];
    const svc = await build(
      makeDbSeq([status, [], []]),
      makeRedis(),
    );
    const r = await svc.getRefundCancel({ period: 'quarter' });
    expect(r.totalOrders).toBe(100);
    expect(r.refundRate).toBe(4);
    expect(r.cancelRate).toBe(2);
    expect(r.refundOverThreshold).toBe(true);
  });

  it('refund 3.0% chính xác KHÔNG over (rule >3, không >=)', async () => {
    const svc = await build(
      makeDbSeq([
        [
          { status: 'paid', cnt: 97 },
          { status: 'refunded', cnt: 3 },
        ],
        [],
        [],
      ]),
      makeRedis(),
    );
    const r = await svc.getRefundCancel({ period: 'quarter' });
    expect(r.refundRate).toBe(3);
    expect(r.refundOverThreshold).toBe(false);
  });

  it('edge: 0 orders → cả 2 rate = 0, không over', async () => {
    const svc = await build(makeDbSeq([[], [], []]), makeRedis());
    const r = await svc.getRefundCancel({ period: '7d' });
    expect(r.totalOrders).toBe(0);
    expect(r.refundRate).toBe(0);
    expect(r.refundOverThreshold).toBe(false);
  });

  it('invariant BR-04: SQL filter status != draft', async () => {
    const db = makeDbSeq([[], [], []]);
    const svc = await build(db, makeRedis());
    await svc.getRefundCancel({ period: '7d' });
    const queryFn = (db as unknown as { query: jest.Mock }).query;
    const sqlCalls = queryFn.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.every((s) => s.includes("status != 'draft'"))).toBe(true);
  });

  it('drill-down raceId: SQL có race_id = ?', async () => {
    const db = makeDbSeq([[], [], []]);
    const svc = await build(db, makeRedis());
    await svc.getRefundCancel({ period: '7d', raceId: '42' });
    const queryFn = (db as unknown as { query: jest.Mock }).query;
    const sqlCalls = queryFn.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('r.race_id = ?'))).toBe(true);
  });
});
