import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import {
  buildMetricCacheKey,
  resolveScopeFromTenant,
  periodKeyFromInputs,
  calcDeltaPercent,
  shiftMonthClamped,
  ymd,
  addDaysUtc,
} from './period-resolver';
import type { RunnerBookingHeatmapResponseDto } from '../dto/runner-booking-heatmap.dto';
import type { RunnerLeadTimeBucketDto } from '../dto/runner-lead-time.dto';
import type { RunnerRepeatCohortResponseDto } from '../dto/runner-repeat-cohort.dto';
import type { RunnerDemographicsResponseDto } from '../dto/runner-demographics.dto';
import type { RunnerGeographicResponseDto } from '../dto/runner-geographic.dto';
import type { RunnerSummaryKpiResponseDto } from '../dto/runner-summary-kpi.dto';

/**
 * F-062 Wave 2C-2 NEW SERVICE — Runner Behavior Analytics (BR-SA-20 a-f v3).
 *
 * 6 public endpoints powering Tab 4 Runner Analytics:
 *   - getBookingHeatmap() — BR-SA-20a: 7×24 dow × hour matrix
 *   - getLeadTime() — BR-SA-20b: 5-bucket histogram + insight
 *   - getRepeatCohort() — BR-SA-20c: 4-tier distribution
 *   - getDemographics() — BR-SA-20d: 6 age brackets × gender + summary
 *   - getGeographic() — BR-SA-20e: top 8 provinces + coverage
 *   - getSummaryKpi() — BR-SA-20f: 4 KPI strip với delta MoM
 *
 * Each endpoint cached separately per BR-SA-20 spec lines 474/487/498/507/515/525.
 * Cache keys conform `analytics:metric:runner-<kind>:<scope>:<periodKey>` PRD pattern
 * via buildMetricCacheKey shared helper (Wave 2B-1 v2 lesson APPLIED).
 *
 * Default period 12 tháng nếu không from/to/month (matches Wave 2B+2C pattern).
 *
 * SQL data sources (MySQL platform DB):
 *   - order_metadata (payment_on, financial_status, user_id, race_id, athlete_id)
 *   - races (event_start_date for lead-time, tenant_id for scope filter)
 *   - athletes (dob, athletes_id for demographics)
 *   - athlete_subinfo (gender via order_line_item.athlete_subinfo_id linkage)
 *   - users (province via order_metadata.user_id) — best-effort schema (F-026 pattern)
 */
const TTL_CURRENT = 900;
const TTL_HISTORY = 86400;
const MAX_DATE_RANGE_DAYS = 366;

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// BR-SA-20b — 5 fixed buckets per PRD spec
const LEAD_TIME_BUCKETS: ReadonlyArray<{
  bucket: '0-7d' | '8-30d' | '31-60d' | '61-120d' | '120+d';
  label: string;
  min: number;
  max: number;
  color: string;
}> = [
  { bucket: '0-7d', label: 'Last-minute', min: 0, max: 7, color: 'red-400' },
  { bucket: '8-30d', label: 'Cận race', min: 8, max: 30, color: 'amber-400' },
  { bucket: '31-60d', label: 'Lập kế hoạch', min: 31, max: 60, color: 'blue-400' },
  { bucket: '61-120d', label: 'Early bird', min: 61, max: 120, color: 'green-400' },
  { bucket: '120+d', label: 'Super early', min: 121, max: Infinity, color: 'purple-400' },
];

// BR-SA-20d — 6 age brackets per PRD spec line 502
const AGE_BRACKETS: ReadonlyArray<{ key: string; min: number; max: number }> = [
  { key: '18-24', min: 18, max: 24 },
  { key: '25-34', min: 25, max: 34 },
  { key: '35-44', min: 35, max: 44 },
  { key: '45-54', min: 45, max: 54 },
  { key: '55-64', min: 55, max: 64 },
  { key: '65+', min: 65, max: 200 },
];

@Injectable()
export class RunnerAnalyticsService {
  private readonly logger = new Logger(RunnerAnalyticsService.name);

  constructor(
    @InjectDataSource('platform') private readonly db: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─── Shared helpers ─────────────────────────────────────────────────────────

  private async cachedQuery<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const ttl = key.includes(currentMonthStr()) ? TTL_CURRENT : TTL_HISTORY;
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch (e) {
      this.logger.warn(`Redis get failed for key ${key}: ${e}`);
    }
    const result = await fn();
    try {
      await this.redis.set(key, JSON.stringify(result), 'EX', ttl);
    } catch (e) {
      this.logger.warn(`Redis set failed for key ${key}: ${e}`);
    }
    return result;
  }

  private validateDateRange(from?: string, to?: string): void {
    if (from && to) {
      const diffDays =
        (new Date(to).getTime() - new Date(from).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diffDays > MAX_DATE_RANGE_DAYS) {
        throw new Error(
          `Date range must not exceed ${MAX_DATE_RANGE_DAYS} days`,
        );
      }
    }
  }

  private applyDefaultPeriod(query: AnalyticsQueryDto): AnalyticsQueryDto {
    if (query.from || query.to || query.month) return query;
    const today = new Date();
    const from = addDaysUtc(today, -365);
    return { ...query, from: ymd(from), to: ymd(today) };
  }

  private buildDateFilter(
    from?: string,
    to?: string,
    month?: string,
  ): { clause: string; params: any[] } {
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const start = `${year}-${String(mon).padStart(2, '0')}-01`;
      const nextMonth = mon === 12 ? 1 : mon + 1;
      const nextYear = mon === 12 ? year + 1 : year;
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      return {
        clause: 'payment_on >= ? AND payment_on < ?',
        params: [start, end],
      };
    }
    if (from || to) {
      const parts: string[] = [];
      const params: any[] = [];
      if (from) {
        parts.push('payment_on >= ?');
        params.push(from);
      }
      if (to) {
        parts.push('payment_on <= ?');
        params.push(`${to} 23:59:59`);
      }
      return { clause: parts.join(' AND '), params };
    }
    return { clause: '', params: [] };
  }

  private buildCacheKey(
    metric: string,
    query: AnalyticsQueryDto,
  ): string {
    return buildMetricCacheKey(
      metric,
      resolveScopeFromTenant(query.tenantId),
      periodKeyFromInputs(query),
    );
  }

  // ─── BR-SA-20a — Booking Heatmap (7×24) ─────────────────────────────────────

  async getBookingHeatmap(
    query: AnalyticsQueryDto,
  ): Promise<RunnerBookingHeatmapResponseDto> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = this.buildCacheKey('runner-heatmap', query);
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';
      const tenantJoin = query.tenantId
        ? 'JOIN races r ON r.race_id = om.race_id'
        : '';
      const tenantWhere = query.tenantId ? 'AND r.tenant_id = ?' : '';
      const sqlParams = query.tenantId ? [...params, query.tenantId] : params;

      const rows = await this.db.query(
        `SELECT
          DAYOFWEEK(om.payment_on) as dow,
          HOUR(om.payment_on) as hour,
          COUNT(*) as order_count
        FROM order_metadata om
        ${tenantJoin}
        WHERE om.financial_status = 'paid' AND om.order_category != 'MANUAL' ${whereClause} ${tenantWhere}
        GROUP BY DAYOFWEEK(om.payment_on), HOUR(om.payment_on)`,
        sqlParams,
      );

      const matrix: number[][] = Array.from({ length: 7 }, () =>
        new Array(24).fill(0),
      );
      for (const r of rows) {
        const dow = Number(r.dow) - 1;
        const hour = Number(r.hour);
        if (dow >= 0 && dow < 7 && hour >= 0 && hour < 24) {
          matrix[dow][hour] = Number(r.order_count);
        }
      }
      return { matrix };
    });
  }

  // ─── BR-SA-20b — Lead Time Histogram ────────────────────────────────────────

  async getLeadTime(
    query: AnalyticsQueryDto,
  ): Promise<RunnerLeadTimeBucketDto[]> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = this.buildCacheKey('runner-leadtime', query);
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';
      const tenantWhere = query.tenantId ? 'AND r.tenant_id = ?' : '';
      const sqlParams = query.tenantId ? [...params, query.tenantId] : params;

      const rows: Array<{ lead_days: number }> = await this.db.query(
        `SELECT DATEDIFF(r.event_start_date, om.payment_on) as lead_days
        FROM order_metadata om
        JOIN races r ON r.race_id = om.race_id
        WHERE om.financial_status = 'paid' AND om.order_category != 'MANUAL'
          AND r.event_start_date IS NOT NULL
          AND DATEDIFF(r.event_start_date, om.payment_on) >= 0
          ${whereClause} ${tenantWhere}`,
        sqlParams,
      );

      const total = rows.length;
      return LEAD_TIME_BUCKETS.map((b) => {
        const count = rows.filter(
          (r) => Number(r.lead_days) >= b.min && Number(r.lead_days) <= b.max,
        ).length;
        return {
          bucket: b.bucket,
          label: b.label,
          count,
          percentage:
            total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
          color: b.color,
        };
      });
    });
  }

  // ─── BR-SA-20c — Repeat Cohort ──────────────────────────────────────────────

  async getRepeatCohort(
    query: AnalyticsQueryDto,
  ): Promise<RunnerRepeatCohortResponseDto> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = this.buildCacheKey('runner-repeat', query);
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';
      const tenantWhere = query.tenantId ? 'AND r.tenant_id = ?' : '';
      const tenantJoin = query.tenantId
        ? 'JOIN races r ON r.race_id = om.race_id'
        : '';
      const sqlParams = query.tenantId ? [...params, query.tenantId] : params;

      const rows: Array<{ user_id: number; race_count: number }> = await this.db.query(
        `SELECT om.user_id, COUNT(DISTINCT om.race_id) as race_count
        FROM order_metadata om
        ${tenantJoin}
        WHERE om.financial_status = 'paid' AND om.order_category != 'MANUAL'
          AND om.user_id IS NOT NULL
          ${whereClause} ${tenantWhere}
        GROUP BY om.user_id`,
        sqlParams,
      );

      const totalUniqueRunners = rows.length;
      const buckets = { '1': 0, '2': 0, '3-4': 0, '5+': 0 };
      for (const r of rows) {
        const c = Number(r.race_count);
        if (c === 1) buckets['1'] += 1;
        else if (c === 2) buckets['2'] += 1;
        else if (c <= 4) buckets['3-4'] += 1;
        else buckets['5+'] += 1;
      }

      const tierLabels: Record<string, string> = {
        '1': '1 giải',
        '2': '2 giải',
        '3-4': '3-4 giải',
        '5+': '5+ giải',
      };

      const tiers = (['1', '2', '3-4', '5+'] as const).map((tier) => ({
        tier,
        label: tierLabels[tier],
        count: buckets[tier],
        percentage:
          totalUniqueRunners > 0
            ? Math.round((buckets[tier] / totalUniqueRunners) * 10000) / 100
            : 0,
      }));

      return { tiers, totalUniqueRunners };
    });
  }

  // ─── BR-SA-20d — Demographics (Age × Gender) ────────────────────────────────

  async getDemographics(
    query: AnalyticsQueryDto,
  ): Promise<RunnerDemographicsResponseDto> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = this.buildCacheKey('runner-demo', query);
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';
      const tenantWhere = query.tenantId ? 'AND r.tenant_id = ?' : '';
      const sqlParams = query.tenantId ? [...params, query.tenantId] : params;

      // Unique athletes paid orders + dob + gender (best-effort schema từ F-026)
      type Row = { gender: string | null; dob: Date | string | null };
      let rows: Row[] = [];
      try {
        rows = await this.db.query(
          `SELECT DISTINCT a.athletes_id, asi.gender as gender, a.dob as dob
          FROM order_metadata om
          JOIN races r ON r.race_id = om.race_id
          JOIN order_line_item oli ON oli.order_id = om.id
          JOIN athletes a ON a.athletes_id = oli.athletes_id
          LEFT JOIN athlete_subinfo asi ON asi.id = oli.athlete_subinfo_id
          WHERE om.financial_status = 'paid' AND om.order_category != 'MANUAL'
            ${whereClause} ${tenantWhere}`,
          sqlParams,
        );
      } catch (e) {
        this.logger.warn(`getDemographics SQL failed (schema mismatch?): ${e}`);
        // Fallback: return empty if schema unavailable
        const emptyBuckets = AGE_BRACKETS.map((b) => ({
          ageRange: b.key,
          male: 0,
          female: 0,
          other: 0,
          unknown: 0,
          total: 0,
        }));
        return {
          brackets: [
            ...emptyBuckets,
            {
              ageRange: 'unknown_age',
              male: 0,
              female: 0,
              other: 0,
              unknown: 0,
              total: 0,
            },
          ],
          genderSummary: {
            male: { count: 0, pct: 0 },
            female: { count: 0, pct: 0 },
            other: { count: 0, pct: 0 },
            unknown: { count: 0, pct: 0 },
          },
        };
      }

      const buckets = AGE_BRACKETS.map((b) => ({
        ageRange: b.key,
        male: 0,
        female: 0,
        other: 0,
        unknown: 0,
        total: 0,
      }));
      const unknownAge = {
        ageRange: 'unknown_age',
        male: 0,
        female: 0,
        other: 0,
        unknown: 0,
        total: 0,
      };

      const genderTotals = { male: 0, female: 0, other: 0, unknown: 0 };
      const today = new Date();

      for (const r of rows) {
        const gender =
          r.gender === 'MALE'
            ? 'male'
            : r.gender === 'FEMALE'
              ? 'female'
              : r.gender === 'OTHER'
                ? 'other'
                : 'unknown';
        genderTotals[gender] += 1;

        let bracket: typeof buckets[number] | typeof unknownAge = unknownAge;
        if (r.dob) {
          const dob = new Date(r.dob);
          const ageMs = today.getTime() - dob.getTime();
          const age = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));
          const found = buckets.find((b) => {
            const meta = AGE_BRACKETS.find((m) => m.key === b.ageRange);
            return meta && age >= meta.min && age <= meta.max;
          });
          if (found) bracket = found;
        }
        bracket[gender] += 1;
        bracket.total += 1;
      }

      const grandTotal = rows.length;
      const genderSummary = {
        male: {
          count: genderTotals.male,
          pct:
            grandTotal > 0
              ? Math.round((genderTotals.male / grandTotal) * 10000) / 100
              : 0,
        },
        female: {
          count: genderTotals.female,
          pct:
            grandTotal > 0
              ? Math.round((genderTotals.female / grandTotal) * 10000) / 100
              : 0,
        },
        other: {
          count: genderTotals.other,
          pct:
            grandTotal > 0
              ? Math.round((genderTotals.other / grandTotal) * 10000) / 100
              : 0,
        },
        unknown: {
          count: genderTotals.unknown,
          pct:
            grandTotal > 0
              ? Math.round((genderTotals.unknown / grandTotal) * 10000) / 100
              : 0,
        },
      };

      return {
        brackets: [...buckets, unknownAge],
        genderSummary,
      };
    });
  }

  // ─── BR-SA-20e — Geographic (Top Provinces) ─────────────────────────────────

  async getGeographic(
    query: AnalyticsQueryDto,
  ): Promise<RunnerGeographicResponseDto> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = this.buildCacheKey('runner-geo', query);
    return this.cachedQuery(cacheKey, async () => {
      const { clause, params } = this.buildDateFilter(
        query.from,
        query.to,
        query.month,
      );
      const whereClause = clause ? `AND ${clause}` : '';
      const tenantWhere = query.tenantId ? 'AND r.tenant_id = ?' : '';
      const sqlParams = query.tenantId ? [...params, query.tenantId] : params;

      // Best-effort: join users via order_metadata.user_id (F-026 pattern)
      type Row = { user_id: number; province: string | null };
      let rows: Row[] = [];
      try {
        rows = await this.db.query(
          `SELECT DISTINCT om.user_id, u.province
          FROM order_metadata om
          JOIN races r ON r.race_id = om.race_id
          LEFT JOIN users u ON u.id = om.user_id
          WHERE om.financial_status = 'paid' AND om.order_category != 'MANUAL'
            AND om.user_id IS NOT NULL
            ${whereClause} ${tenantWhere}`,
          sqlParams,
        );
      } catch (e) {
        this.logger.warn(`getGeographic SQL failed (users.province missing?): ${e}`);
        return {
          provinces: [],
          coverage: 0,
          totalWithProvince: 0,
          totalRunners: 0,
        };
      }

      const totalRunners = rows.length;
      let totalWithProvince = 0;
      const provinceCounts = new Map<string, number>();

      for (const r of rows) {
        if (r.province && r.province.trim()) {
          totalWithProvince += 1;
          const p = r.province.trim();
          provinceCounts.set(p, (provinceCounts.get(p) ?? 0) + 1);
        }
      }

      const sorted = Array.from(provinceCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      const provinces = sorted.map(([province, count]) => ({
        province,
        count,
        percentage:
          totalWithProvince > 0
            ? Math.round((count / totalWithProvince) * 10000) / 100
            : 0,
      }));

      const coverage =
        totalRunners > 0
          ? Math.round((totalWithProvince / totalRunners) * 10000) / 100
          : 0;

      return { provinces, coverage, totalWithProvince, totalRunners };
    });
  }

  // ─── BR-SA-20f — Summary 4 KPIs ─────────────────────────────────────────────

  async getSummaryKpi(
    query: AnalyticsQueryDto,
  ): Promise<RunnerSummaryKpiResponseDto> {
    query = this.applyDefaultPeriod(query);
    this.validateDateRange(query.from, query.to);
    const cacheKey = this.buildCacheKey('runner-summary', query);
    return this.cachedQuery(cacheKey, async () => {
      // Current period
      const current = await this._computeSummary(query);
      // Previous period for delta MoM — shift query window 1 calendar month back
      const prevQuery = this._shiftQueryMoM(query);
      const previous = await this._computeSummary(prevQuery);

      return {
        ...current,
        deltaMoM: {
          uniqueRunnersPct: calcDeltaPercent(
            current.uniqueRunners,
            previous.uniqueRunners,
          ),
          repeatRatePct: calcDeltaPercent(current.repeatRate, previous.repeatRate),
          avgLeadTimePct:
            current.avgLeadTime != null && previous.avgLeadTime != null
              ? calcDeltaPercent(current.avgLeadTime, previous.avgLeadTime)
              : null,
          avgOrdersPerRunnerPct: calcDeltaPercent(
            current.avgOrdersPerRunner,
            previous.avgOrdersPerRunner,
          ),
        },
      };
    });
  }

  private async _computeSummary(
    query: AnalyticsQueryDto,
  ): Promise<Omit<RunnerSummaryKpiResponseDto, 'deltaMoM'>> {
    const { clause, params } = this.buildDateFilter(
      query.from,
      query.to,
      query.month,
    );
    const whereClause = clause ? `AND ${clause}` : '';
    const tenantWhere = query.tenantId ? 'AND r.tenant_id = ?' : '';
    const tenantJoin = query.tenantId
      ? 'JOIN races r ON r.race_id = om.race_id'
      : '';
    const sqlParams = query.tenantId ? [...params, query.tenantId] : params;

    const [unique] = await this.db.query(
      `SELECT COUNT(DISTINCT om.user_id) as unique_runners,
              COUNT(*) as total_orders
      FROM order_metadata om
      ${tenantJoin}
      WHERE om.financial_status = 'paid' AND om.order_category != 'MANUAL'
        AND om.user_id IS NOT NULL
        ${whereClause} ${tenantWhere}`,
      sqlParams,
    );

    const uniqueRunners = Number(unique.unique_runners);
    const totalOrders = Number(unique.total_orders);

    // Repeat rate — runners with ≥2 races trong period
    const [repeat] = await this.db.query(
      `SELECT COUNT(*) as repeat_runners FROM (
        SELECT om.user_id
        FROM order_metadata om
        ${tenantJoin}
        WHERE om.financial_status = 'paid' AND om.order_category != 'MANUAL'
          AND om.user_id IS NOT NULL
          ${whereClause} ${tenantWhere}
        GROUP BY om.user_id
        HAVING COUNT(DISTINCT om.race_id) >= 2
      ) sub`,
      sqlParams,
    );

    const repeatRunners = Number(repeat.repeat_runners);
    const repeatRate =
      uniqueRunners > 0
        ? Math.round((repeatRunners / uniqueRunners) * 10000) / 100
        : 0;

    // Avg lead time (days)
    const tenantJoinForLead = 'JOIN races r ON r.race_id = om.race_id';
    const [lead] = await this.db.query(
      `SELECT AVG(DATEDIFF(r.event_start_date, om.payment_on)) as avg_lead
      FROM order_metadata om
      ${tenantJoinForLead}
      WHERE om.financial_status = 'paid' AND om.order_category != 'MANUAL'
        AND r.event_start_date IS NOT NULL
        AND DATEDIFF(r.event_start_date, om.payment_on) >= 0
        ${whereClause} ${tenantWhere}`,
      sqlParams,
    );

    const avgLeadTime =
      lead.avg_lead != null
        ? Math.round(Number(lead.avg_lead) * 10) / 10
        : null;

    const avgOrdersPerRunner =
      uniqueRunners > 0
        ? Math.round((totalOrders / uniqueRunners) * 100) / 100
        : 0;

    return {
      uniqueRunners,
      repeatRate,
      avgLeadTime,
      avgOrdersPerRunner,
    };
  }

  /**
   * Shift query window 1 calendar month back for MoM delta.
   * Uses Wave 2A shiftMonthClamped để handle day-clamp (May 31 → April 30).
   */
  private _shiftQueryMoM(query: AnalyticsQueryDto): AnalyticsQueryDto {
    if (query.month) {
      const [y, m] = query.month.split('-').map(Number);
      const prevDate = shiftMonthClamped(new Date(Date.UTC(y, m - 1, 1)), -1);
      const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
      return { ...query, month: prevMonth };
    }
    if (query.from && query.to) {
      const fromD = shiftMonthClamped(new Date(`${query.from}T00:00:00Z`), -1);
      const toD = shiftMonthClamped(new Date(`${query.to}T00:00:00Z`), -1);
      return { ...query, from: ymd(fromD), to: ymd(toD) };
    }
    return query;
  }
}
