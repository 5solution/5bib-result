import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { AnalyticsAggregatorCron } from '../services/analytics-aggregator.cron';
import { RepeatAthleteService } from '../services/repeat-athlete.service';
import { MerchantChurnService } from '../services/merchant-churn.service';
import { TimeToFillService } from '../services/time-to-fill.service';
import { ClaimRateService } from '../services/claim-rate.service';
import { GeographicDemographicService } from '../services/geographic-demographic.service';
import { RefundCancelService } from '../services/refund-cancel.service';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

function fakeAggregateOk() {
  return { aggregate: jest.fn().mockResolvedValue(undefined) };
}

function makeRedis(setReturn: 'OK' | null) {
  return {
    set: jest.fn().mockResolvedValue(setReturn),
    del: jest.fn().mockResolvedValue(1),
  } as unknown as Redis;
}

async function build(
  redis: Redis,
  overrides?: Partial<{
    repeat: { aggregate: jest.Mock };
    churn: { aggregate: jest.Mock };
    fill: { aggregate: jest.Mock };
    claim: { aggregate: jest.Mock };
    geo: { aggregate: jest.Mock };
    refund: { aggregate: jest.Mock };
  }>,
) {
  const repeat = overrides?.repeat ?? fakeAggregateOk();
  const churn = overrides?.churn ?? fakeAggregateOk();
  const fill = overrides?.fill ?? fakeAggregateOk();
  const claim = overrides?.claim ?? fakeAggregateOk();
  const geo = overrides?.geo ?? fakeAggregateOk();
  const refund = overrides?.refund ?? fakeAggregateOk();

  const m = await Test.createTestingModule({
    providers: [
      AnalyticsAggregatorCron,
      { provide: REDIS_TOKEN, useValue: redis },
      { provide: RepeatAthleteService, useValue: repeat },
      { provide: MerchantChurnService, useValue: churn },
      { provide: TimeToFillService, useValue: fill },
      { provide: ClaimRateService, useValue: claim },
      { provide: GeographicDemographicService, useValue: geo },
      { provide: RefundCancelService, useValue: refund },
    ],
  }).compile();
  return {
    cron: m.get(AnalyticsAggregatorCron),
    repeat,
    churn,
    fill,
    claim,
    geo,
    refund,
  };
}

describe('AnalyticsAggregatorCron', () => {
  it('lock SETNX OK → chạy 6 service', async () => {
    const redis = makeRedis('OK');
    const ctx = await build(redis);
    await ctx.cron.runHourly();
    expect(ctx.repeat.aggregate).toHaveBeenCalledTimes(1);
    expect(ctx.churn.aggregate).toHaveBeenCalledTimes(1);
    expect(ctx.fill.aggregate).toHaveBeenCalledTimes(1);
    expect(ctx.claim.aggregate).toHaveBeenCalledTimes(1);
    expect(ctx.geo.aggregate).toHaveBeenCalledTimes(1);
    expect(ctx.refund.aggregate).toHaveBeenCalledTimes(1);
  });

  it('lock không acquire → skip toàn bộ', async () => {
    const redis = makeRedis(null);
    const ctx = await build(redis);
    await ctx.cron.runHourly();
    expect(ctx.repeat.aggregate).not.toHaveBeenCalled();
  });

  it('1 service throw → các service khác vẫn chạy', async () => {
    const redis = makeRedis('OK');
    const failing = { aggregate: jest.fn().mockRejectedValue(new Error('boom')) };
    const ctx = await build(redis, { repeat: failing });
    await ctx.cron.runHourly();
    expect(ctx.churn.aggregate).toHaveBeenCalled();
    expect(ctx.refund.aggregate).toHaveBeenCalled();
  });

  it('finally: lock luôn được release dù throw', async () => {
    const redis = makeRedis('OK');
    const failing = { aggregate: jest.fn().mockRejectedValue(new Error('boom')) };
    const ctx = await build(redis, { repeat: failing });
    await ctx.cron.runHourly();
    expect((redis as unknown as { del: jest.Mock }).del).toHaveBeenCalledWith(
      'analytics:cron-lock:hourly',
    );
  });
});
