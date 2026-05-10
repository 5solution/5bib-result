import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import {
  resolvePeriod,
  resolveCompare,
  buildMetricCacheKey,
  calcDeltaPercent,
  PeriodKind,
  CompareKind,
} from './period-resolver';
import {
  RepeatAthleteRateResponseDto,
  RepeatAthleteTrendPointDto,
} from '../dto/repeat-athlete-rate.dto';

/**
 * F-026 BR-ANALYTICS-12 — Repeat Athlete Rate.
 *
 * Tỉ lệ VĐV unique tham gia ≥2 race trong 12 tháng rolling
 * = repeatAthletes / totalAthletes × 100.
 *
 * RED LINE compliance:
 * - BR-04: WHERE r.status != 'draft' AND r.is_delete = 0
 * - BR-05: GROUP BY a.athletes_id (KHÔNG dùng bib_number)
 *
 * Source: MySQL `athletes` + `races` join trên `race_id`.
 */
@Injectable()
export class RepeatAthleteService {
  private readonly logger = new Logger(RepeatAthleteService.name);
  private readonly TTL = 3600;

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getRate(params: {
    period: PeriodKind;
    from?: string;
    to?: string;
    compareWith?: CompareKind;
    raceId?: string;
  }): Promise<RepeatAthleteRateResponseDto> {
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
      'repeat-athlete-rate',
      scope,
      params.compareWith
        ? `${current.periodKey}|cmp:${params.compareWith}`
        : current.periodKey,
    );

    const cached = await this.readCache<RepeatAthleteRateResponseDto>(cacheKey);
    if (cached) return cached;

    const computeForRange = (fromIso: string, toIso: string) =>
      this.computeRate(fromIso, toIso, params.raceId);

    const cur = await computeForRange(current.fromIso, current.toIso);

    let compare: RepeatAthleteRateResponseDto['compare'] = null;
    if (params.compareWith && params.compareWith !== 'none') {
      const cmpRange = resolveCompare(current, { kind: params.compareWith });
      if (cmpRange) {
        const cmp = await computeForRange(cmpRange.fromIso, cmpRange.toIso);
        compare = {
          rate: cmp.rate,
          deltaPercent: calcDeltaPercent(cur.rate, cmp.rate),
        };
      }
    }

    const trend = await this.computeTrend(
      current.fromIso,
      current.toIso,
      params.raceId,
    );

    const response: RepeatAthleteRateResponseDto = {
      rate: cur.rate,
      totalAthletes: cur.totalAthletes,
      repeatAthletes: cur.repeatAthletes,
      trend,
      compare,
    };

    await this.writeCache(cacheKey, response);
    return response;
  }

  /** Pre-warm cho cron — chạy với rolling12m platform default. */
  async aggregate(): Promise<void> {
    await this.getRate({ period: 'rolling12m' });
  }

  private async computeRate(
    fromIso: string,
    toIso: string,
    raceId?: string,
  ): Promise<{ rate: number; totalAthletes: number; repeatAthletes: number }> {
    const raceFilter = raceId ? 'AND a.race_id = ?' : '';
    const params: Array<string | number> = [fromIso, toIso];
    if (raceId) params.push(Number(raceId));

    // Bước 1: lấy athletes_id distinct + đếm distinct race_id per athlete
    // BR-04: race not draft + not deleted
    // BR-05: dedupe theo a.athletes_id
    const sql = `
      SELECT a.athletes_id, COUNT(DISTINCT a.race_id) AS race_count
      FROM athletes a
      JOIN races r ON r.race_id = a.race_id
      WHERE r.status != 'draft'
        AND r.is_delete = 0
        AND r.event_start_date >= ?
        AND r.event_start_date < ?
        ${raceFilter}
      GROUP BY a.athletes_id
    `;
    const rows: Array<{ athletes_id: number; race_count: number }> =
      await this.db.query(sql, params);

    const totalAthletes = rows.length;
    const repeatAthletes = rows.filter((r) => Number(r.race_count) >= 2).length;
    const rate =
      totalAthletes > 0
        ? Math.round((repeatAthletes / totalAthletes) * 10000) / 100
        : 0;

    return { totalAthletes, repeatAthletes, rate };
  }

  private async computeTrend(
    fromIso: string,
    toIso: string,
    raceId?: string,
  ): Promise<RepeatAthleteTrendPointDto[]> {
    const raceFilter = raceId ? 'AND a.race_id = ?' : '';
    const params: Array<string | number> = [fromIso, toIso];
    if (raceId) params.push(Number(raceId));

    // Per bucket: count distinct athletes_id + count those with race_count >= 2
    // Subquery: per (bucket, athletes_id) đếm distinct race_id trong CÙNG bucket
    const sql = `
      SELECT bucket,
             COUNT(*) AS total,
             SUM(CASE WHEN race_count >= 2 THEN 1 ELSE 0 END) AS repeat_count
      FROM (
        SELECT DATE_FORMAT(r.event_start_date, '%Y-%m') AS bucket,
               a.athletes_id,
               COUNT(DISTINCT a.race_id) AS race_count
        FROM athletes a
        JOIN races r ON r.race_id = a.race_id
        WHERE r.status != 'draft'
          AND r.is_delete = 0
          AND r.event_start_date >= ?
          AND r.event_start_date < ?
          ${raceFilter}
        GROUP BY bucket, a.athletes_id
      ) per_bucket
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const rows: Array<{ bucket: string; total: number; repeat_count: number }> =
      await this.db.query(sql, params);

    return rows.map((r) => {
      const total = Number(r.total) || 0;
      const repeat = Number(r.repeat_count) || 0;
      const rate =
        total > 0 ? Math.round((repeat / total) * 10000) / 100 : 0;
      return { bucket: r.bucket, rate };
    });
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
