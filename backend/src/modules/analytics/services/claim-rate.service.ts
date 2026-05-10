import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  ResultClaim,
  ResultClaimDocument,
} from '../../race-result/schemas/result-claim.schema';
import {
  RaceResult,
  RaceResultDocument,
} from '../../race-result/schemas/race-result.schema';
import {
  resolvePeriod,
  buildMetricCacheKey,
  PeriodKind,
} from './period-resolver';
import {
  ClaimRateResponseDto,
  ClaimRatePerRaceDto,
  SlaTrendPointDto,
} from '../dto/claim-rate.dto';

/**
 * F-026 BR-ANALYTICS-16/17 — Claim Rate per Race + Resolution SLA.
 *
 * Cross-DB: Mongo (`result_claims`, `race_results`) + MySQL (`races` lookup name).
 *
 * Claim Rate per race = claims / finishers × 100.
 * SLA = #(resolved trong 24h) / #(resolved total) × 100.
 *
 * BR-04: race draft loại bằng cách filter raceIds qua MySQL trước khi map name.
 *        race_results đã được sync từ vendor → race draft chưa có result data.
 */
@Injectable()
export class ClaimRateService {
  private readonly logger = new Logger(ClaimRateService.name);
  private readonly TTL = 3600;

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectModel(ResultClaim.name)
    private readonly claimModel: Model<ResultClaimDocument>,
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getClaimRate(params: {
    period: PeriodKind;
    from?: string;
    to?: string;
    raceId?: string;
  }): Promise<ClaimRateResponseDto> {
    const current = resolvePeriod({
      kind: params.period,
      from: params.from,
      to: params.to,
    });

    const scope =
      params.raceId != null
        ? ({ raceId: params.raceId } as const)
        : ('platform' as const);
    const cacheKey = buildMetricCacheKey(
      'claim-rate',
      scope,
      current.periodKey,
    );

    const cached = await this.readCache<ClaimRateResponseDto>(cacheKey);
    if (cached) return cached;

    const fromDate = new Date(current.fromIso);
    const toDate = new Date(current.toIso);

    // Bước 1: claims trong period
    const claimMatch: Record<string, unknown> = {
      created_at: { $gte: fromDate, $lt: toDate },
    };
    if (params.raceId) claimMatch.raceId = params.raceId;

    const claimAgg = await this.claimModel.aggregate<{
      _id: string;
      claims: number;
      resolved: number;
      withinSla: number;
    }>([
      { $match: claimMatch },
      {
        $group: {
          _id: '$raceId',
          claims: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $in: ['$status', ['approved', 'rejected']] }, 1, 0],
            },
          },
          withinSla: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['approved', 'rejected']] },
                    { $ne: ['$resolvedAt', null] },
                    {
                      $lte: [
                        {
                          $divide: [
                            { $subtract: ['$resolvedAt', '$created_at'] },
                            3_600_000,
                          ],
                        },
                        24,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Bước 2: finishers (race_results) per race
    const raceIds = claimAgg.map((c) => c._id);
    const finisherMatch: Record<string, unknown> =
      raceIds.length > 0 ? { raceId: { $in: raceIds } } : {};
    if (params.raceId) finisherMatch.raceId = params.raceId;

    const finisherAgg = await this.resultModel.aggregate<{
      _id: string;
      finishers: number;
    }>([
      { $match: finisherMatch },
      { $group: { _id: '$raceId', finishers: { $sum: 1 } } },
    ]);
    const finishersByRace = new Map<string, number>(
      finisherAgg.map((r) => [r._id, Number(r.finishers)]),
    );

    // Bước 3: race name lookup từ MySQL (BR-04 bonus filter)
    let nameByRace = new Map<string, string>();
    if (raceIds.length > 0) {
      const numeric = raceIds
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n));
      if (numeric.length > 0) {
        try {
          const placeholders = numeric.map(() => '?').join(',');
          const rows: Array<{ race_id: number; title: string }> =
            await this.db.query(
              `SELECT race_id, title FROM races
               WHERE race_id IN (${placeholders})
                 AND status != 'draft' AND is_delete = 0`,
              numeric,
            );
          nameByRace = new Map(
            rows.map((r) => [String(r.race_id), r.title ?? `Race ${r.race_id}`]),
          );
        } catch (e) {
          this.logger.warn(`race name lookup fail: ${(e as Error).message}`);
        }
      }
    }

    const perRace: ClaimRatePerRaceDto[] = claimAgg
      .filter((c) => {
        // Lọc race draft: nếu raceId không có trong nameByRace + có numeric
        // → có thể là draft → loại
        const numeric = Number(c._id);
        if (Number.isFinite(numeric) && !nameByRace.has(String(numeric))) {
          return false;
        }
        return true;
      })
      .map((c) => {
        const finishers = finishersByRace.get(c._id) ?? 0;
        const claims = Number(c.claims) || 0;
        const claimRate =
          finishers > 0 ? Math.round((claims / finishers) * 10000) / 100 : 0;
        return {
          raceId: c._id,
          raceName: nameByRace.get(c._id) ?? `Race ${c._id}`,
          finishers,
          claims,
          claimRate,
          isOverThreshold: claimRate > 5,
        };
      })
      .sort((a, b) => b.claimRate - a.claimRate);

    let totalClaims = 0;
    let totalResolved = 0;
    let resolvedWithinSla = 0;
    for (const c of claimAgg) {
      totalClaims += Number(c.claims) || 0;
      totalResolved += Number(c.resolved) || 0;
      resolvedWithinSla += Number(c.withinSla) || 0;
    }
    const slaPercentage =
      totalResolved > 0
        ? Math.round((resolvedWithinSla / totalResolved) * 10000) / 100
        : 0;

    const slaTrend = await this.computeSlaTrend(fromDate, toDate, params.raceId);

    const response: ClaimRateResponseDto = {
      perRace,
      slaPercentage,
      totalClaims,
      totalResolved,
      resolvedWithinSla,
      slaTrend,
    };
    await this.writeCache(cacheKey, response);
    return response;
  }

  async aggregate(): Promise<void> {
    await this.getClaimRate({ period: 'rolling12m' });
  }

  private async computeSlaTrend(
    fromDate: Date,
    toDate: Date,
    raceId?: string,
  ): Promise<SlaTrendPointDto[]> {
    const match: Record<string, unknown> = {
      created_at: { $gte: fromDate, $lt: toDate },
    };
    if (raceId) match.raceId = raceId;

    const rows = await this.claimModel.aggregate<{
      _id: string;
      resolved: number;
      withinSla: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$created_at' } },
          resolved: {
            $sum: {
              $cond: [{ $in: ['$status', ['approved', 'rejected']] }, 1, 0],
            },
          },
          withinSla: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['approved', 'rejected']] },
                    { $ne: ['$resolvedAt', null] },
                    {
                      $lte: [
                        {
                          $divide: [
                            { $subtract: ['$resolvedAt', '$created_at'] },
                            3_600_000,
                          ],
                        },
                        24,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return rows.map((r) => ({
      bucket: r._id,
      slaPercentage:
        Number(r.resolved) > 0
          ? Math.round((Number(r.withinSla) / Number(r.resolved)) * 10000) / 100
          : 0,
    }));
  }

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      const v = await this.redis.get(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch (e) {
      this.logger.warn(`redis get fail ${key}: ${e}`);
      return null;
    }
  }

  private async writeCache<T>(key: string, value: T): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', this.TTL);
    } catch (e) {
      this.logger.warn(`redis set fail ${key}: ${e}`);
    }
  }
}
