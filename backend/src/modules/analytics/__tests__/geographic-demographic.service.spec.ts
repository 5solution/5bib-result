import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { getDataSourceToken } from '@nestjs/typeorm';
import { GeographicDemographicService } from '../services/geographic-demographic.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';
const makeRedis = () =>
  ({ get: jest.fn().mockResolvedValue(null), set: jest.fn() } as unknown as Redis);

function makeDb(handlers: Array<unknown[] | Error>) {
  let i = 0;
  return {
    query: jest.fn().mockImplementation(() => {
      const h = handlers[Math.min(i++, handlers.length - 1)];
      return h instanceof Error ? Promise.reject(h) : Promise.resolve(h);
    }),
  } as unknown as DataSource;
}

async function build(db: DataSource, redis: Redis) {
  const m = await Test.createTestingModule({
    providers: [
      GeographicDemographicService,
      { provide: getDataSourceToken('platform'), useValue: db },
      { provide: REDIS_TOKEN, useValue: redis },
    ],
  }).compile();
  return m.get(GeographicDemographicService);
}

describe('GeographicDemographicService', () => {
  it('maps province → region đúng (HCM/HN/DN/KHAC)', async () => {
    // Order calls: Promise.all → demographic, geographic, total (theo file)
    const total = [{ total: 4 }];
    const demoRows = [
      { gender: 'MALE', dob: new Date('1990-01-01') },
      { gender: 'FEMALE', dob: new Date('2005-01-01') },
      { gender: 'MALE', dob: null },
      { gender: null, dob: null },
    ];
    const geoRows = [
      { province: 'Hồ Chí Minh' },
      { province: 'Hà Nội' },
      { province: 'Đà Nẵng' },
      { province: 'Bình Dương' },
    ];
    const svc = await build(makeDb([demoRows, geoRows, total]), makeRedis());
    const r = await svc.getGeoDemo({ period: 'quarter' });
    expect(r.totalAthletes).toBe(4);
    const hcm = r.geographic.regions.find((x) => x.region === 'HCM');
    expect(hcm?.count).toBe(1);
    expect(r.geographic.coverage).toBe(100);
  });

  it('age bucket: 25-34, 55+, UNKNOWN', async () => {
    const total = [{ total: 3 }];
    const today = new Date();
    const yearsAgo = (n: number) => {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - n);
      return d;
    };
    const demoRows = [
      { gender: 'MALE', dob: yearsAgo(28) },
      { gender: 'FEMALE', dob: yearsAgo(60) },
      { gender: 'MALE', dob: null },
    ];
    const svc = await build(makeDb([demoRows, [], total]), makeRedis());
    const r = await svc.getGeoDemo({ period: 'quarter' });
    const buckets = new Set(r.demographic.genderAge.map((x) => x.ageGroup));
    expect(buckets.has('25-34')).toBe(true);
    expect(buckets.has('55+')).toBe(true);
    expect(buckets.has('UNKNOWN')).toBe(true);
  });

  it('schema fallback geographic: query fail → coverage 0', async () => {
    const total = [{ total: 0 }];
    const svc = await build(
      makeDb([[], new Error('users table missing'), total]),
      makeRedis(),
    );
    const r = await svc.getGeoDemo({ period: 'quarter' });
    expect(r.geographic.coverage).toBe(0);
  });

  it('dobCoverage: 1/2 có DOB → 50%', async () => {
    const total = [{ total: 2 }];
    const demoRows = [
      { gender: 'MALE', dob: new Date('1990-01-01') },
      { gender: 'FEMALE', dob: null },
    ];
    const svc = await build(makeDb([demoRows, [], total]), makeRedis());
    const r = await svc.getGeoDemo({ period: 'quarter' });
    expect(r.demographic.dobCoverage).toBe(50);
  });

  it('invariant BR-05: SQL dùng athletes_id (không bib)', async () => {
    const db = makeDb([[], [], [{ total: 0 }]]);
    const svc = await build(db, makeRedis());
    await svc.getGeoDemo({ period: 'quarter' });
    const queryFn = (db as unknown as { query: jest.Mock }).query;
    const sqlCalls = queryFn.mock.calls.map((c) => String(c[0]));
    const hasAthletesGroup = sqlCalls.some((s) =>
      /athletes_id/i.test(s),
    );
    expect(hasAthletesGroup).toBe(true);
    expect(sqlCalls.some((s) => /GROUP BY[^;]*bib_number/i.test(s))).toBe(false);
  });
});
