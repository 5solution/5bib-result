import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import {
  buildMetricCacheKey,
  resolveScopeFromTenant,
  periodKeyFromInputs,
} from './period-resolver';
import type { Ga4OverviewResponseDto } from '../dto/ga4-overview.dto';

/**
 * F-062 Wave 2C-3 NEW SERVICE — GA4 Data API proxy (BR-SA-11 v3).
 *
 * Wraps `@google-analytics/data` BetaAnalyticsDataClient với graceful fallback:
 *   - GA4_SERVICE_ACCOUNT_KEY_PATH + GA4_PROPERTY_ID NOT set → return
 *     `{ available: false, error: 'GA4 chưa được cấu hình' }` (DO NOT throw)
 *   - GA4 API call fails → log warn + return same shape
 *
 * Cache: `analytics:metric:ga4-overview:<scope>:<periodKey>` TTL 600s (PRD shorter
 * vì GA4 data updates trễ hơn business data; KHÔNG có historical variant per BR-SA-11).
 */
const TTL_GA4 = 600;
const DEFAULT_DAYS = 30;

@Injectable()
export class Ga4Service {
  private readonly logger = new Logger(Ga4Service.name);
  private client: unknown = null; // BetaAnalyticsDataClient when configured
  private clientInitTried = false;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private async _initClient(): Promise<unknown> {
    if (this.clientInitTried) return this.client;
    this.clientInitTried = true;
    const keyPath = process.env.GA4_SERVICE_ACCOUNT_KEY_PATH;
    if (!keyPath) {
      this.logger.warn('GA4_SERVICE_ACCOUNT_KEY_PATH not set — GA4 disabled');
      return null;
    }
    try {
      // Lazy import — avoid loading lib if not configured (cold-start cost)
      const { BetaAnalyticsDataClient } = await import(
        '@google-analytics/data'
      );
      this.client = new BetaAnalyticsDataClient({ keyFilename: keyPath });
      return this.client;
    } catch (e) {
      this.logger.warn(`GA4 client init failed: ${e}`);
      return null;
    }
  }

  private resolveDateRange(query: AnalyticsQueryDto): {
    startDate: string;
    endDate: string;
  } {
    if (query.from && query.to) {
      return { startDate: query.from, endDate: query.to };
    }
    if (query.month) {
      const [year, mon] = query.month.split('-').map(Number);
      const start = `${year}-${String(mon).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
      const end = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { startDate: start, endDate: end };
    }
    // Default 30 ngày gần nhất
    const today = new Date();
    const past = new Date(today);
    past.setUTCDate(past.getUTCDate() - DEFAULT_DAYS);
    const ymdUtc = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return { startDate: ymdUtc(past), endDate: ymdUtc(today) };
  }

  async getOverview(query: AnalyticsQueryDto): Promise<Ga4OverviewResponseDto> {
    const cacheKey = buildMetricCacheKey(
      'ga4-overview',
      resolveScopeFromTenant(query.tenantId),
      periodKeyFromInputs(query),
    );

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as Ga4OverviewResponseDto;
    } catch (e) {
      this.logger.warn(`Redis get failed: ${e}`);
    }

    const propertyId = process.env.GA4_PROPERTY_ID;
    const client = (await this._initClient()) as {
      runReport: (req: unknown) => Promise<unknown[]>;
    } | null;

    if (!client || !propertyId) {
      const fallback: Ga4OverviewResponseDto = {
        available: false,
        error: 'GA4 chưa được cấu hình',
      };
      // Cache fallback short TTL to avoid hammering config check
      try {
        await this.redis.set(cacheKey, JSON.stringify(fallback), 'EX', 60);
      } catch {
        /* ignore */
      }
      return fallback;
    }

    const { startDate, endDate } = this.resolveDateRange(query);
    const property = `properties/${propertyId}`;

    try {
      // 1. Core metrics
      const [coreResp] = (await client.runReport({
        property,
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'newUsers' },
        ],
      })) as unknown as Array<{
        rows?: Array<{ metricValues: Array<{ value: string }> }>;
      }>;
      const coreRow = coreResp?.rows?.[0]?.metricValues ?? [];

      // 2. Top pages (top 10)
      const [pagesResp] = (await client.runReport({
        property,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ desc: true, metric: { metricName: 'screenPageViews' } }],
        limit: 10,
      })) as unknown as Array<{
        rows?: Array<{
          dimensionValues: Array<{ value: string }>;
          metricValues: Array<{ value: string }>;
        }>;
      }>;
      const topPages = (pagesResp?.rows ?? []).map((r) => ({
        page: r.dimensionValues[0]?.value ?? '',
        pageviews: Number(r.metricValues[0]?.value ?? 0),
      }));

      // 3. Traffic sources (top 5)
      const [sourcesResp] = (await client.runReport({
        property,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ desc: true, metric: { metricName: 'sessions' } }],
        limit: 5,
      })) as unknown as Array<{
        rows?: Array<{
          dimensionValues: Array<{ value: string }>;
          metricValues: Array<{ value: string }>;
        }>;
      }>;
      const trafficSources = (sourcesResp?.rows ?? []).map((r) => ({
        source: r.dimensionValues[0]?.value ?? '',
        sessions: Number(r.metricValues[0]?.value ?? 0),
      }));

      // 4. Daily sessions sparkline
      const [dailyResp] = (await client.runReport({
        property,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      })) as unknown as Array<{
        rows?: Array<{
          dimensionValues: Array<{ value: string }>;
          metricValues: Array<{ value: string }>;
        }>;
      }>;
      const dailySessions = (dailyResp?.rows ?? []).map((r) => {
        const raw = r.dimensionValues[0]?.value ?? ''; // YYYYMMDD
        const date = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
        return { date, sessions: Number(r.metricValues[0]?.value ?? 0) };
      });

      const result: Ga4OverviewResponseDto = {
        available: true,
        sessions: Number(coreRow[0]?.value ?? 0),
        pageviews: Number(coreRow[1]?.value ?? 0),
        bounceRate: Math.round(Number(coreRow[2]?.value ?? 0) * 10000) / 10000,
        avgSessionDuration:
          Math.round(Number(coreRow[3]?.value ?? 0) * 100) / 100,
        newUsers: Number(coreRow[4]?.value ?? 0),
        topPages,
        trafficSources,
        dailySessions,
      };

      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', TTL_GA4);
      } catch {
        /* ignore */
      }
      return result;
    } catch (e) {
      this.logger.warn(`GA4 API call failed: ${e}`);
      return {
        available: false,
        error: `GA4 API error: ${(e as Error).message}`,
      };
    }
  }
}
