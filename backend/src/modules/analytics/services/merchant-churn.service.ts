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
  MerchantChurnResponseDto,
  MerchantStatusEntryDto,
} from '../dto/merchant-churn.dto';

/**
 * F-026 BR-ANALYTICS-13 — Merchant Churn.
 *
 * Mỗi tenant: ngày race cuối cùng `MAX(r.event_start_date)`.
 *  - <4 tháng → ACTIVE
 *  - 4–6 tháng → AT_RISK
 *  - ≥6 tháng → CHURNED
 *
 * BR-04 enforced: race draft + deleted bị loại.
 */
@Injectable()
export class MerchantChurnService {
  private readonly logger = new Logger(MerchantChurnService.name);
  private readonly TTL = 3600;

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getChurn(params: {
    period: PeriodKind;
    from?: string;
    to?: string;
  }): Promise<MerchantChurnResponseDto> {
    const current = resolvePeriod({
      kind: params.period,
      from: params.from,
      to: params.to,
    });

    const cacheKey = buildMetricCacheKey(
      'merchant-churn',
      'platform',
      current.periodKey,
    );

    const cached = await this.readCache<MerchantChurnResponseDto>(cacheKey);
    if (cached) return cached;

    const sql = `
      SELECT t.id AS tenant_id,
             t.name AS merchant_name,
             COUNT(DISTINCT r.race_id) AS total_races,
             MAX(r.event_start_date) AS last_race_date
      FROM tenant t
      JOIN races r ON r.tenant_id = t.id
      WHERE r.status != 'draft'
        AND r.is_delete = 0
      GROUP BY t.id, t.name
      HAVING last_race_date IS NOT NULL
    `;

    const rows: Array<{
      tenant_id: number;
      merchant_name: string;
      total_races: number;
      last_race_date: string | Date | null;
    }> = await this.db.query(sql);

    const now = Date.now();
    const monthMs = 30 * 24 * 3600 * 1000;

    const all: Array<MerchantStatusEntryDto & { months: number }> = rows.map(
      (r) => {
        const last = r.last_race_date ? new Date(r.last_race_date) : null;
        const months = last ? (now - last.getTime()) / monthMs : Infinity;
        return {
          tenantId: Number(r.tenant_id),
          merchantName: r.merchant_name,
          monthsSinceLastRace: Math.round(months * 10) / 10,
          lastRaceDate: last ? last.toISOString() : null,
          totalRaces: Number(r.total_races),
          months,
        };
      },
    );

    const atRisk = all
      .filter((m) => m.months >= 4 && m.months < 6)
      .sort((a, b) => b.months - a.months);
    const churned = all
      .filter((m) => m.months >= 6)
      .sort((a, b) => b.months - a.months);

    const totalMerchants = all.length;
    const churnedCount = churned.length;
    const atRiskCount = atRisk.length;

    const churnRate =
      totalMerchants > 0
        ? Math.round((churnedCount / totalMerchants) * 10000) / 100
        : 0;

    const stripMonths = ({
      tenantId,
      merchantName,
      monthsSinceLastRace,
      lastRaceDate,
      totalRaces,
    }: MerchantStatusEntryDto & { months: number }): MerchantStatusEntryDto => ({
      tenantId,
      merchantName,
      monthsSinceLastRace,
      lastRaceDate,
      totalRaces,
    });

    const response: MerchantChurnResponseDto = {
      churnRate,
      totalMerchants,
      churnedCount,
      atRiskCount,
      atRiskList: atRisk.map(stripMonths),
      churnedList: churned.map(stripMonths),
    };

    await this.writeCache(cacheKey, response);
    return response;
  }

  async aggregate(): Promise<void> {
    await this.getChurn({ period: 'quarter' });
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
