/**
 * F-026 Admin Analytics Redesign — Period & Compare Resolver
 *
 * Pure helper utilities to compute analytics period ranges + compare ranges
 * (kỳ trước / cùng kỳ năm trước / custom).
 *
 * BR-ANALYTICS-06/07 (PRD F-026):
 * - period: 7d / 30d / quarter / year / custom / rolling12m
 * - compareWith: prev / yoy / custom / none
 *
 * Tất cả ngày tính theo UTC để khớp DB; FE hiển thị label "Theo giờ Việt Nam"
 * nhưng các SQL filter dùng cùng timestamp (UTC).
 */

export type PeriodKind = '7d' | '30d' | 'quarter' | 'year' | 'custom' | 'rolling12m';
export type CompareKind = 'prev' | 'yoy' | 'custom' | 'none';

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

  // yoy
  const from = addYearsUtc(curFrom, -1);
  const to = addYearsUtc(curTo, -1);
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    periodKey: `yoy:${current.periodKey}`,
  };
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
 * Build cache key chuẩn cho F-026 metric.
 *  analytics:metric:<name>:<scope>:<periodKey>
 */
export function buildMetricCacheKey(
  metric: string,
  scope: 'platform' | { raceId: string | number },
  periodKey: string,
): string {
  const scopeStr = scope === 'platform' ? 'platform' : `race:${scope.raceId}`;
  return `analytics:metric:${metric}:${scopeStr}:${periodKey}`;
}
