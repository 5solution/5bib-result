import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import {
  resolvePeriod,
  buildMetricCacheKey,
  PeriodKind,
} from './period-resolver';
import {
  GeoDemoResponseDto,
  RegionEntryDto,
  GenderAgeEntryDto,
} from '../dto/geographic-demographic.dto';

/**
 * F-026 BR-ANALYTICS-18/19 — Geographic + Demographic Split.
 *
 * Geographic: vùng = HCM / HN / DN / KHAC dựa trên `users.province` (best-effort).
 * Demographic: gender × age bucket dựa trên athlete_subinfo.gender + athletes.dob.
 *
 * BR-04: race draft loại.
 * BR-05: dedupe theo athletes_id.
 *
 * Schema fallback: nếu users.province không tồn tại → coverage=0, KHAC=100%.
 */
@Injectable()
export class GeographicDemographicService {
  private readonly logger = new Logger(GeographicDemographicService.name);
  private readonly TTL = 3600;

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getGeoDemo(params: {
    period: PeriodKind;
    from?: string;
    to?: string;
    raceId?: string;
  }): Promise<GeoDemoResponseDto> {
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
      'geographic-demographic',
      scope,
      current.periodKey,
    );

    const cached = await this.readCache<GeoDemoResponseDto>(cacheKey);
    if (cached) return cached;

    const [demographic, geographic, totalAthletes] = await Promise.all([
      this.computeDemographic(current.fromIso, current.toIso, params.raceId),
      this.computeGeographic(current.fromIso, current.toIso, params.raceId),
      this.computeTotal(current.fromIso, current.toIso, params.raceId),
    ]);

    const response: GeoDemoResponseDto = {
      totalAthletes,
      geographic,
      demographic,
    };
    await this.writeCache(cacheKey, response);
    return response;
  }

  async aggregate(): Promise<void> {
    await this.getGeoDemo({ period: 'quarter' });
  }

  private async computeTotal(
    fromIso: string,
    toIso: string,
    raceId?: string,
  ): Promise<number> {
    const raceFilter = raceId ? 'AND a.race_id = ?' : '';
    const params: Array<string | number> = [fromIso, toIso];
    if (raceId) params.push(Number(raceId));

    const rows: Array<{ total: number }> = await this.db.query(
      `
      SELECT COUNT(DISTINCT a.athletes_id) AS total
      FROM athletes a
      JOIN races r ON r.race_id = a.race_id
      WHERE r.status != 'draft'
        AND r.is_delete = 0
        AND r.event_start_date >= ?
        AND r.event_start_date < ?
        ${raceFilter}
      `,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async computeDemographic(
    fromIso: string,
    toIso: string,
    raceId?: string,
  ) {
    const raceFilter = raceId ? 'AND a.race_id = ?' : '';
    const params: Array<string | number> = [fromIso, toIso];
    if (raceId) params.push(Number(raceId));

    const sql = `
      SELECT
        COALESCE(asi.gender, 'UNKNOWN') AS gender,
        a.dob AS dob,
        a.athletes_id
      FROM athletes a
      JOIN races r ON r.race_id = a.race_id
      LEFT JOIN athlete_subinfo asi ON asi.id = a.subinfo_id
      WHERE r.status != 'draft'
        AND r.is_delete = 0
        AND r.event_start_date >= ?
        AND r.event_start_date < ?
        ${raceFilter}
      GROUP BY a.athletes_id, asi.gender, a.dob
    `;

    let rows: Array<{ gender: string; dob: Date | string | null }> = [];
    try {
      rows = await this.db.query(sql, params);
    } catch (e) {
      this.logger.warn(`demographic fail: ${(e as Error).message}`);
      return { genderAge: [] as GenderAgeEntryDto[], dobCoverage: 0 };
    }

    const counter = new Map<string, number>();
    let withDob = 0;
    const today = new Date();
    for (const r of rows) {
      const gender = (r.gender ?? 'UNKNOWN').toUpperCase();
      let ageGroup = 'UNKNOWN';
      if (r.dob) {
        const dob = new Date(r.dob);
        if (!Number.isNaN(dob.getTime())) {
          const ageMs = today.getTime() - dob.getTime();
          const age = Math.floor(ageMs / (365.25 * 24 * 3600 * 1000));
          if (age < 25) ageGroup = '<25';
          else if (age < 35) ageGroup = '25-34';
          else if (age < 45) ageGroup = '35-44';
          else if (age < 55) ageGroup = '45-54';
          else ageGroup = '55+';
          withDob += 1;
        }
      }
      const key = `${gender}|${ageGroup}`;
      counter.set(key, (counter.get(key) ?? 0) + 1);
    }

    const genderAge: GenderAgeEntryDto[] = [];
    for (const [key, count] of counter.entries()) {
      const [gender, ageGroup] = key.split('|');
      genderAge.push({ gender, ageGroup, count });
    }
    genderAge.sort((a, b) => b.count - a.count);

    const dobCoverage =
      rows.length > 0
        ? Math.round((withDob / rows.length) * 10000) / 100
        : 0;

    return { genderAge, dobCoverage };
  }

  private async computeGeographic(
    fromIso: string,
    toIso: string,
    raceId?: string,
  ) {
    const raceFilter = raceId ? 'AND a.race_id = ?' : '';
    const params: Array<string | number> = [fromIso, toIso];
    if (raceId) params.push(Number(raceId));

    // Best-effort: try query users.province qua order_metadata.user_id.
    // Nếu schema users không có province → fallback empty.
    const sql = `
      SELECT a.athletes_id,
             u.province AS province
      FROM athletes a
      JOIN races r ON r.race_id = a.race_id
      LEFT JOIN order_metadata om ON om.race_id = r.race_id
            AND om.financial_status = 'paid'
      LEFT JOIN users u ON u.id = om.user_id
      WHERE r.status != 'draft'
        AND r.is_delete = 0
        AND r.event_start_date >= ?
        AND r.event_start_date < ?
        ${raceFilter}
      GROUP BY a.athletes_id, u.province
    `;

    let rows: Array<{ province: string | null }> = [];
    try {
      rows = await this.db.query(sql, params);
    } catch (e) {
      this.logger.warn(`geographic fail (schema): ${(e as Error).message}`);
      return { regions: [] as RegionEntryDto[], coverage: 0 };
    }

    const counter = new Map<string, number>();
    counter.set('HCM', 0);
    counter.set('HN', 0);
    counter.set('DN', 0);
    counter.set('KHAC', 0);

    let withProvince = 0;
    for (const r of rows) {
      const region = this.mapRegion(r.province);
      if (r.province) withProvince += 1;
      counter.set(region, (counter.get(region) ?? 0) + 1);
    }

    const total = rows.length;
    const regions: RegionEntryDto[] = Array.from(counter.entries()).map(
      ([region, count]) => ({
        region,
        count,
        percent: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
      }),
    );
    const coverage =
      total > 0 ? Math.round((withProvince / total) * 10000) / 100 : 0;
    return { regions, coverage };
  }

  private mapRegion(province: string | null): string {
    if (!province) return 'KHAC';
    const p = province.toLowerCase();
    if (p.includes('hồ chí minh') || p.includes('ho chi minh') || p.includes('hcm') || p.includes('sài gòn'))
      return 'HCM';
    if (p.includes('hà nội') || p.includes('ha noi') || p.includes('hn'))
      return 'HN';
    if (p.includes('đà nẵng') || p.includes('da nang') || p.includes('dn'))
      return 'DN';
    return 'KHAC';
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
