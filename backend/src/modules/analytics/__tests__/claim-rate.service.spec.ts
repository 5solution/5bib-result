import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import { getDataSourceToken } from '@nestjs/typeorm';
import { getModelToken } from '@nestjs/mongoose';
import { ClaimRateService } from '../services/claim-rate.service';
import { ResultClaim } from '../../race-result/schemas/result-claim.schema';
import { RaceResult } from '../../race-result/schemas/race-result.schema';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';
const makeRedis = () =>
  ({ get: jest.fn().mockResolvedValue(null), set: jest.fn() } as unknown as Redis);

function makeMongo(rows: unknown[]) {
  return {
    aggregate: jest.fn().mockResolvedValue(rows),
  } as unknown as Model<unknown>;
}

function makeDb(rows: unknown[] | Error) {
  return {
    query: jest.fn().mockImplementation(() =>
      rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows),
    ),
  } as unknown as DataSource;
}

async function build(opts: {
  claim: Model<unknown>;
  result: Model<unknown>;
  db: DataSource;
  redis: Redis;
}) {
  const m = await Test.createTestingModule({
    providers: [
      ClaimRateService,
      { provide: getDataSourceToken('platform'), useValue: opts.db },
      { provide: getModelToken(ResultClaim.name), useValue: opts.claim },
      { provide: getModelToken(RaceResult.name), useValue: opts.result },
      { provide: REDIS_TOKEN, useValue: opts.redis },
    ],
  }).compile();
  return m.get(ClaimRateService);
}

describe('ClaimRateService', () => {
  it('happy: claim/finishers + over-threshold flag', async () => {
    const claim = {
      aggregate: jest
        .fn()
        // first aggregate = perRace
        .mockResolvedValueOnce([
          { _id: '10', claims: 6, resolved: 5, withinSla: 4 },
        ])
        // second aggregate = SLA trend
        .mockResolvedValueOnce([
          { _id: '2026-04', resolved: 5, withinSla: 4 },
        ]),
    } as unknown as Model<unknown>;
    const result = makeMongo([{ _id: '10', finishers: 100 }]);
    const db = makeDb([{ race_id: 10, title: 'FUYU' }]);

    const svc = await build({ claim, result, db, redis: makeRedis() });
    const r = await svc.getClaimRate({ period: 'quarter' });
    expect(r.perRace[0].claimRate).toBe(6);
    expect(r.perRace[0].isOverThreshold).toBe(true);
    expect(r.slaPercentage).toBe(80);
  });

  it('edge: 0 claims → empty perRace + slaPercentage 0', async () => {
    const claim = {
      aggregate: jest.fn().mockResolvedValue([]),
    } as unknown as Model<unknown>;
    const svc = await build({
      claim,
      result: makeMongo([]),
      db: makeDb([]),
      redis: makeRedis(),
    });
    const r = await svc.getClaimRate({ period: 'quarter' });
    expect(r.perRace).toEqual([]);
    expect(r.slaPercentage).toBe(0);
  });

  it('edge: 0 finishers → claimRate 0, không divide-by-zero', async () => {
    const claim = {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce([
          { _id: '11', claims: 3, resolved: 2, withinSla: 2 },
        ])
        .mockResolvedValueOnce([]),
    } as unknown as Model<unknown>;
    const result = makeMongo([]); // 0 finishers
    const db = makeDb([{ race_id: 11, title: 'X' }]);
    const svc = await build({ claim, result, db, redis: makeRedis() });
    const r = await svc.getClaimRate({ period: 'quarter' });
    expect(r.perRace[0].claimRate).toBe(0);
  });

  it('BR-04: race draft loại bỏ qua MySQL lookup', async () => {
    const claim = {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce([
          { _id: '99', claims: 1, resolved: 1, withinSla: 1 },
        ])
        .mockResolvedValueOnce([]),
    } as unknown as Model<unknown>;
    const result = makeMongo([{ _id: '99', finishers: 50 }]);
    // raceId 99 không trong nameByRace (do MySQL trả [] vì status='draft')
    const db = makeDb([]);
    const svc = await build({ claim, result, db, redis: makeRedis() });
    const r = await svc.getClaimRate({ period: 'quarter' });
    expect(r.perRace).toEqual([]);
  });

  it('SLA calculation: 4/5 trong 24h → 80%', async () => {
    const claim = {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce([
          { _id: '10', claims: 5, resolved: 5, withinSla: 4 },
        ])
        .mockResolvedValueOnce([]),
    } as unknown as Model<unknown>;
    const result = makeMongo([{ _id: '10', finishers: 1000 }]);
    const db = makeDb([{ race_id: 10, title: 'A' }]);
    const svc = await build({ claim, result, db, redis: makeRedis() });
    const r = await svc.getClaimRate({ period: 'quarter' });
    expect(r.slaPercentage).toBe(80);
    expect(r.totalResolved).toBe(5);
    expect(r.resolvedWithinSla).toBe(4);
  });
});
