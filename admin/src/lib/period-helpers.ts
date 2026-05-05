/**
 * FEATURE-003 BR-06 — UTC-safe date helpers for reconciliation period selection.
 *
 * NEVER use `new Date(...).toISOString().slice(0,10)` to derive a YYYY-MM-DD.
 * Use string templates + UTC math (e.g. `Date.UTC(year, month, 0)` for last-day).
 *
 * Months are 1-indexed throughout (1=Jan, 12=Dec).
 */

const VN_TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

export type YearMonth = { year: number; month: number };

export type PeriodRange = {
  period_start: string; // YYYY-MM-01
  period_end: string; // YYYY-MM-{lastDay}
  monthCount: number;
};

/** Last day of (year, month1Indexed) using UTC math. Handles leap year. */
export function lastDayOfMonth(year: number, month1Indexed: number): number {
  return new Date(Date.UTC(year, month1Indexed, 0)).getUTCDate();
}

/** Pad number to 2 digits. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Current year/month in Vietnam timezone (UTC+7), independent of browser TZ. */
export function currentVnYearMonth(now: Date = new Date()): YearMonth {
  const t = now.getTime() + VN_TZ_OFFSET_MS;
  const d = new Date(t);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
  };
}

/** Previous month relative to a year/month, handling year rollover. */
export function previousMonth(ym: YearMonth): YearMonth {
  if (ym.month === 1) return { year: ym.year - 1, month: 12 };
  return { year: ym.year, month: ym.month - 1 };
}

/** Subtract n months from a year/month. */
export function subtractMonths(ym: YearMonth, n: number): YearMonth {
  const idx = ym.year * 12 + (ym.month - 1) - n;
  const year = Math.floor(idx / 12);
  const month = (idx % 12 + 12) % 12 + 1;
  return { year, month };
}

/** Total inclusive months between two year/month points (>= 1 if from <= to). */
export function inclusiveMonthCount(from: YearMonth, to: YearMonth): number {
  return (to.year - from.year) * 12 + (to.month - from.month) + 1;
}

/**
 * Convert a (fromYM, toYM) pair into period_start/period_end + monthCount.
 * Returns null if `to < from`.
 */
export function monthRangeToPeriod(
  from: YearMonth,
  to: YearMonth,
): PeriodRange | null {
  const count = inclusiveMonthCount(from, to);
  if (count < 1) return null;
  return {
    period_start: `${from.year}-${pad2(from.month)}-01`,
    period_end: `${to.year}-${pad2(to.month)}-${pad2(lastDayOfMonth(to.year, to.month))}`,
    monthCount: count,
  };
}

/**
 * Preset: "Tháng này" — current month in VN.
 */
export function presetThisMonth(now: Date = new Date()): { from: YearMonth; to: YearMonth } {
  const cur = currentVnYearMonth(now);
  return { from: cur, to: cur };
}

/**
 * Preset: "Tháng trước" — previous month in VN.
 */
export function presetPreviousMonth(now: Date = new Date()): {
  from: YearMonth;
  to: YearMonth;
} {
  const prev = previousMonth(currentVnYearMonth(now));
  return { from: prev, to: prev };
}

/**
 * Preset: "3 tháng gần nhất" — current-3 → current-1.
 */
export function presetLast3Months(now: Date = new Date()): {
  from: YearMonth;
  to: YearMonth;
} {
  const cur = currentVnYearMonth(now);
  return {
    from: subtractMonths(cur, 3),
    to: subtractMonths(cur, 1),
  };
}

/**
 * Preset: "Quý trước" — previous quarter in VN calendar (Q1=Jan-Mar, …).
 */
export function presetPreviousQuarter(now: Date = new Date()): {
  from: YearMonth;
  to: YearMonth;
} {
  const cur = currentVnYearMonth(now);
  const currentQuarter = Math.ceil(cur.month / 3); // 1..4
  const prevQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
  const prevQuarterYear = currentQuarter === 1 ? cur.year - 1 : cur.year;
  const startMonth = (prevQuarter - 1) * 3 + 1;
  return {
    from: { year: prevQuarterYear, month: startMonth },
    to: { year: prevQuarterYear, month: startMonth + 2 },
  };
}

/**
 * Format period range for display.
 *  - N=1 → "Tháng MM/YYYY"
 *  - N>1 → "Tháng MMs/YYYYs → Tháng MMe/YYYYe"
 */
export function formatPeriodLabel(period_start: string, period_end: string): string {
  if (!period_start || !period_end) return '—';
  const sParts = period_start.split('-');
  const eParts = period_end.split('-');
  if (sParts.length !== 3 || eParts.length !== 3) {
    return `${period_start} – ${period_end}`;
  }
  const [sy, sm] = sParts;
  const [ey, em] = eParts;
  if (sy === ey && sm === em) {
    return `Tháng ${Number(sm)}/${sy}`;
  }
  return `Tháng ${Number(sm)}/${sy} → Tháng ${Number(em)}/${ey}`;
}

/** Year list for dropdowns: [currentYear-4 ... currentYear+1]. */
export function yearOptionsAround(centerYear: number, before = 4, after = 1): number[] {
  const arr: number[] = [];
  for (let y = centerYear - before; y <= centerYear + after; y++) arr.push(y);
  return arr;
}
