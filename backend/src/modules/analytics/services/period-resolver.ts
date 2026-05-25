/**
 * F-026 Admin Analytics Redesign — Period & Compare Resolver
 * F-062 v3 (Manager Adjustment #1, 2026-05-22) — 3 enum riêng biệt cho time-series query.
 *
 * Pure helper utilities to compute analytics period ranges + compare ranges
 * + granularity bucket size (cho chart aggregation).
 *
 * **3 concept tách bạch (KHÔNG mixed vào 1 union):**
 * - `PeriodKind` — TIME RANGE FILTER (SQL WHERE clause). 6 values bao gồm `'custom'`.
 *   GIỮ NGUYÊN F-026 6 endpoint hiện tại, không break backward compat.
 * - `GranularityKind` — BUCKET SIZE cho chart aggregation (SQL GROUP BY). 3 values.
 *   F-062 NEW — `'daily'` | `'weekly'` | `'monthly'`.
 * - `CompareKind` — PERIOD-OVER-PERIOD type cho delta calc. Extend từ F-026:
 *   `'prev'` (F-026 backward compat) + `'wow'` / `'mom'` / `'yoy'` (F-062 NEW).
 *
 * Frontend pass 3 query params riêng: `?period=30d&granularity=weekly&compare=mom`.
 *
 * Tất cả ngày tính theo UTC để khớp DB; FE hiển thị label "Theo giờ Việt Nam"
 * nhưng các SQL filter dùng cùng timestamp (UTC).
 */

export type PeriodKind = '7d' | '30d' | 'quarter' | 'year' | 'custom' | 'rolling12m';

/**
 * F-062 NEW (Manager Adjustment #1 v3) — bucket size cho chart aggregation.
 * KHÔNG mixed vào PeriodKind. PeriodKind = time range filter, GranularityKind = bucket size.
 */
export type GranularityKind = 'daily' | 'weekly' | 'monthly';

/**
 * F-062 EXTEND (Manager Adjustment #1 v3) — thêm 'wow' | 'mom' | 'yoy'.
 * 'prev' GIỮ cho backward compat F-026 6 endpoint.
 */
export type CompareKind = 'prev' | 'yoy' | 'custom' | 'none' | 'wow' | 'mom';

export interface ResolvedRange {
  /** ISO datetime (start inclusive) */
  fromIso: string;
  /** ISO datetime (end exclusive) */
  toIso: string;
  /** Khóa cache xác định, ổn định cho period cùng giá trị */
  periodKey: string;
}

export interface PeriodInput {
  kind: PeriodKind;
  /** Bắt buộc khi kind=custom hoặc kind=rolling12m anchor */
  from?: string;
  to?: string;
  /** Mốc tính period — default = now (UTC). Hữu ích cho test. */
  now?: Date;
}

export interface CompareInput {
  kind: CompareKind;
  /** Custom range cho compare khi kind=custom */
  from?: string;
  to?: string;
}

/** Format YYYY-MM-DD UTC */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Trả về Date 00:00:00 UTC ngày hôm nay (theo `now`). */
export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addYearsUtc(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

/**
 * F-062 Wave 2A NEW (TD-F062-MOM-BOUNDARY-ROLLOVER fix 2026-05-22).
 *
 * Shift date by N months WITHOUT JavaScript's setUTCMonth rollover bug.
 *
 * Naive `Date.setUTCMonth(target)` keeps source day even when target month
 * has fewer days → rolls over to next month:
 *   `new Date('2026-05-31').setUTCMonth(3)` → `'2026-05-01'` (BUG!)
 *
 * shiftMonthClamped clamps day to last-day-of-target-month:
 *   `shiftMonthClamped(2026-05-31, -1)` → `2026-04-30` (correct)
 *   `shiftMonthClamped(2026-01-31, -1)` → `2025-12-31` (Dec has 31, no clamp)
 *   `shiftMonthClamped(2024-03-29, -1)` → `2024-02-29` (leap year OK)
 *
 * Used by `resolveCompare('mom')` for Month-over-Month comparison.
 */
export function shiftMonthClamped(date: Date, months: number): Date {
  const sourceYear = date.getUTCFullYear();
  const sourceMonth = date.getUTCMonth();
  const sourceDay = date.getUTCDate();
  // Compute target year/month theo offset (handle negative cross-year correctly)
  const targetTotalMonths = sourceYear * 12 + sourceMonth + months;
  const targetYear = Math.floor(targetTotalMonths / 12);
  const targetMonth = targetTotalMonths - targetYear * 12; // 0-11
  // Day 0 of (target month + 1) = last day of target month (handle 28/29/30/31)
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(sourceDay, lastDayOfTargetMonth);
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      clampedDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/**
 * Resolve current period range theo PeriodInput.
 */
export function resolvePeriod(input: PeriodInput): ResolvedRange {
  const now = input.now ?? new Date();
  const today = startOfDayUtc(now);

  switch (input.kind) {
    case '7d': {
      const from = addDaysUtc(today, -6); // 7 ngày bao gồm hôm nay
      const to = addDaysUtc(today, 1);
      return {
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
        periodKey: `7d:${ymd(from)}`,
      };
    }
    case '30d': {
      const from = addDaysUtc(today, -29);
      const to = addDaysUtc(today, 1);
      return {
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
        periodKey: `30d:${ymd(from)}`,
      };
    }
    case 'quarter': {
      const q = Math.floor(today.getUTCMonth() / 3); // 0..3
      const from = new Date(Date.UTC(today.getUTCFullYear(), q * 3, 1));
      const to = new Date(Date.UTC(today.getUTCFullYear(), q * 3 + 3, 1));
      return {
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
        periodKey: `q${q + 1}:${today.getUTCFullYear()}`,
      };
    }
    case 'year': {
      const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      const to = new Date(Date.UTC(today.getUTCFullYear() + 1, 0, 1));
      return {
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
        periodKey: `y:${today.getUTCFullYear()}`,
      };
    }
    case 'rolling12m': {
      const from = addDaysUtc(today, -365);
      const to = addDaysUtc(today, 1);
      return {
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
        periodKey: `r12m:${ymd(from)}`,
      };
    }
    case 'custom': {
      if (!input.from || !input.to) {
        throw new Error('PeriodResolver: custom kind cần `from` + `to`');
      }
      const from = new Date(`${input.from}T00:00:00Z`);
      const to = new Date(`${input.to}T00:00:00Z`);
      // Đẩy `to` thêm 1 ngày để bao gồm cả ngày `to` (end-exclusive)
      const toExcl = addDaysUtc(to, 1);
      return {
        fromIso: from.toISOString(),
        toIso: toExcl.toISOString(),
        periodKey: `c:${ymd(from)}~${ymd(to)}`,
      };
    }
    default: {
      throw new Error(`PeriodResolver: kind không hợp lệ: ${String(input.kind)}`);
    }
  }
}

/**
 * Resolve compare range tương ứng với current period.
 * `prev` = kỳ trước có cùng độ dài.
 * `yoy`  = cùng kỳ năm trước (lùi 1 năm).
 */
export function resolveCompare(
  current: ResolvedRange,
  compare: CompareInput,
): ResolvedRange | null {
  if (compare.kind === 'none') return null;

  if (compare.kind === 'custom') {
    if (!compare.from || !compare.to) {
      throw new Error('CompareResolver: custom cần `from` + `to`');
    }
    const from = new Date(`${compare.from}T00:00:00Z`);
    const to = new Date(`${compare.to}T00:00:00Z`);
    const toExcl = addDaysUtc(to, 1);
    return {
      fromIso: from.toISOString(),
      toIso: toExcl.toISOString(),
      periodKey: `cc:${ymd(from)}~${ymd(to)}`,
    };
  }

  const curFrom = new Date(current.fromIso);
  const curTo = new Date(current.toIso);
  const lengthMs = curTo.getTime() - curFrom.getTime();

  if (compare.kind === 'prev') {
    const to = curFrom;
    const from = new Date(curFrom.getTime() - lengthMs);
    return {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      periodKey: `prev:${current.periodKey}`,
    };
  }

  // F-062 NEW (Manager Adjustment #1 v3) — explicit Week/Month/Year over-over comparisons.
  // Khác `'prev'` là `prev` chỉ shift bằng current period length, còn wow/mom/yoy
  // shift theo unit cố định (7d / calendar month / 365d) để semantic rõ ràng cho user.
  if (compare.kind === 'wow') {
    // Week-over-Week: lùi 7 ngày
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const to = new Date(curTo.getTime() - SEVEN_DAYS_MS);
    const from = new Date(curFrom.getTime() - SEVEN_DAYS_MS);
    return {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      periodKey: `wow:${current.periodKey}`,
    };
  }

  if (compare.kind === 'mom') {
    // Month-over-Month: lùi 1 calendar month với day-clamp (handle 28/29/30/31).
    // F-062 Wave 2A fix (TD-F062-MOM-BOUNDARY-ROLLOVER 2026-05-22 Manager finding):
    // Naive `setUTCMonth(-1)` rolls over khi source day > target month days.
    // VD: 2026-05-31 setUTCMonth(3) → April 31 KHÔNG tồn tại → JS rolls to May 1
    //     (current month, NOT previous!) → MoM growth metric SAI.
    // Fix: shiftMonthClamped clamps day to last-day-of-target-month.
    const from = shiftMonthClamped(curFrom, -1);
    const to = shiftMonthClamped(curTo, -1);
    return {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      periodKey: `mom:${current.periodKey}`,
    };
  }

  // yoy (F-026 backward compat + F-062 reaffirmed)
  const from = addYearsUtc(curFrom, -1);
  const to = addYearsUtc(curTo, -1);
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    periodKey: `yoy:${current.periodKey}`,
  };
}

/**
 * F-062 NEW (Manager Adjustment #1 v3) — Bucket size resolver cho chart aggregation.
 *
 * Trả về SQL GROUP BY expression + label format cho frontend X-axis.
 * Dùng trong `revenue/weekly` + `revenue/monthly` + `revenue/daily` endpoints.
 *
 * - `'daily'`  → group by `DATE(payment_on)` → "DD/MM" label
 * - `'weekly'` → group by `YEARWEEK(payment_on, 3)` (ISO 8601, Monday start) → "Tuần WW" label
 * - `'monthly'`→ group by `DATE_FORMAT(payment_on, '%Y-%m')` → "Tháng MM/YYYY" label
 */
export function resolveBucketSize(granularity: GranularityKind): {
  sqlGroupExpr: string;
  labelFormat: string;
  bucketKeyFormat: string; // Format chuẩn cho cache key + response field
} {
  switch (granularity) {
    case 'daily':
      return {
        sqlGroupExpr: 'DATE(payment_on)',
        labelFormat: 'DD/MM',
        bucketKeyFormat: 'YYYY-MM-DD',
      };
    case 'weekly':
      // ISO 8601 week (mode 3): Monday = first day, week 1 = first week with ≥4 days in new year.
      return {
        sqlGroupExpr: 'YEARWEEK(payment_on, 3)',
        labelFormat: 'Tuần WW',
        bucketKeyFormat: 'YYYY-Www', // e.g., 2026-W21
      };
    case 'monthly':
      return {
        sqlGroupExpr: "DATE_FORMAT(payment_on, '%Y-%m')",
        labelFormat: 'Tháng MM/YYYY',
        bucketKeyFormat: 'YYYY-MM',
      };
    default: {
      const _exhaustive: never = granularity;
      throw new Error(`resolveBucketSize: kind không hợp lệ: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Tính delta % an toàn — guard 0 và non-finite.
 * @returns null nếu base=0 hoặc kết quả không finite
 */
export function calcDeltaPercent(current: number, base: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(base)) return null;
  if (base === 0) return null;
  const pct = ((current - base) / base) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.round(pct * 100) / 100;
}

/**
 * Build cache key chuẩn cho F-026 + F-062 metric.
 *
 * Format:
 *   - 2-axis:  `analytics:metric:<name>:<scope>:<periodKey>`
 *   - 3-axis:  `analytics:metric:<name>:<scope>:<extra>:<periodKey>` (extra inserted
 *              GIỮA scope và periodKey per BR-SA-04 comparison spec)
 *
 * Scope variants:
 *   - `'platform'` → `platform`
 *   - `{ raceId }` → `race:<id>` (F-026 race-scoped metrics)
 *   - `{ tenantId }` → `tenant:<id>` (F-062 Wave 2B-1 tenant-scoped revenue charts)
 *
 * F-062 Wave 2B-1 fix (TD-F062-WAVE2B1-CACHE-KEY-DRIFT 2026-05-25):
 *   Tenant scope variant added; extra-axis support added cho comparison endpoint
 *   (`compareWith` axis between scope và periodKey per BR-SA-04 PRD spec).
 *
 * Usage:
 *   buildMetricCacheKey('weekly-revenue', { tenantId: 42 }, 'range:2026-01-01~2026-05-25')
 *     → 'analytics:metric:weekly-revenue:tenant:42:range:2026-01-01~2026-05-25'
 *   buildMetricCacheKey('comparison', 'platform', 'range:...', 'mom')
 *     → 'analytics:metric:comparison:platform:mom:range:...'
 */
export function buildMetricCacheKey(
  metric: string,
  scope:
    | 'platform'
    | { raceId: string | number }
    | { tenantId: string | number },
  periodKey: string,
  extra?: string,
): string {
  let scopeStr: string;
  if (scope === 'platform') {
    scopeStr = 'platform';
  } else if ('raceId' in scope) {
    scopeStr = `race:${scope.raceId}`;
  } else {
    scopeStr = `tenant:${scope.tenantId}`;
  }
  const base = `analytics:metric:${metric}:${scopeStr}`;
  return extra ? `${base}:${extra}:${periodKey}` : `${base}:${periodKey}`;
}
