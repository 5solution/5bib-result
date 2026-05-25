/**
 * F-062 Wave 2B-1 — Bucket-key helpers cho weekly/monthly revenue endpoints.
 *
 * Pattern: SQL aggregate returns numeric/text bucket keys
 *   weekly  → MySQL `YEARWEEK(payment_on, 3)` → 6-digit int "YYYYWW"
 *   monthly → MySQL `DATE_FORMAT(payment_on, '%Y-%m')` → "YYYY-MM"
 *
 * Service layer needs:
 *   - Normalize raw SQL keys → display keys (`YYYY-Www` / `YYYY-MM`)
 *   - Map orders (Date `payment_on`) → same keys for fee per-bucket attribution
 *   - Derive (from, to) window per bucket — feeds `FeeService.computeFeeForOrdersAggregate`
 *
 * All math UTC-anchored để khớp với `shiftMonthClamped` (Wave 2A) +
 * `buildDateFilter` (analytics.service.ts).
 *
 * NOTE: ISO 8601 week semantics:
 *   - Monday = first day of week
 *   - Week 1 = first week có ≥4 ngày trong year mới
 *   - Mode 3 trong MySQL `YEARWEEK(d, 3)` khớp với chuẩn ISO này.
 */

/** Pad single digit to 2 chars. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD UTC representation. */
export function ymdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * ISO 8601 week number (1–53) cho 1 ngày bất kỳ.
 * Algorithm: shift sang Thursday cùng tuần, count weeks từ Jan 4 năm Thursday.
 */
export function isoWeekOf(date: Date): { isoYear: number; isoWeek: number } {
  // Clone tránh mutate input
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // ISO weekday: Mon=1 .. Sun=7
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Shift sang Thursday cùng tuần
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  // First Thursday of ISO year = anchor of week 1
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek =
    Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { isoYear, isoWeek };
}

/** Date → "YYYY-Www" (e.g., `2026-W21`). */
export function dateToWeekKey(date: Date): string {
  const { isoYear, isoWeek } = isoWeekOf(date);
  return `${isoYear}-W${pad2(isoWeek)}`;
}

/** Date → "YYYY-MM". */
export function dateToMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

/**
 * MySQL `YEARWEEK(d, 3)` int → "YYYY-Www" display key.
 * YEARWEEK mode 3 returns 6-digit int "YYYYWW" (vd 202621 = 2026 week 21).
 */
export function mysqlYearweekToWeekKey(yw: number | string): string {
  const n = Number(yw);
  if (!Number.isFinite(n) || n < 100_001 || n > 999_999) {
    throw new Error(`mysqlYearweekToWeekKey: invalid YEARWEEK value ${yw}`);
  }
  const year = Math.floor(n / 100);
  const week = n % 100;
  return `${year}-W${pad2(week)}`;
}

/**
 * "YYYY-Www" → ISO Monday + Sunday (YYYY-MM-DD UTC).
 * Derive Monday of ISO week algorithm: start from Jan 4 (always trong week 1)
 * + offset (week - 1) tuần.
 */
export function weekKeyToRange(weekKey: string): {
  weekStart: string; // YYYY-MM-DD Monday
  weekEnd: string; // YYYY-MM-DD Sunday
} {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) throw new Error(`weekKeyToRange: invalid week key ${weekKey}`);
  const isoYear = Number(m[1]);
  const isoWeek = Number(m[2]);
  if (isoWeek < 1 || isoWeek > 53) {
    throw new Error(`weekKeyToRange: ISO week ${isoWeek} out of range`);
  }
  // Jan 4 luôn rơi trong ISO week 1
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const weekMonday = new Date(week1Monday);
  weekMonday.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7);
  const weekSunday = new Date(weekMonday);
  weekSunday.setUTCDate(weekMonday.getUTCDate() + 6);
  return {
    weekStart: ymdUtc(weekMonday),
    weekEnd: ymdUtc(weekSunday),
  };
}

/** "YYYY-MM" → first/last day YYYY-MM-DD (inclusive). */
export function monthKeyToRange(monthKey: string): {
  monthStart: string;
  monthEnd: string;
} {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) throw new Error(`monthKeyToRange: invalid month key ${monthKey}`);
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) {
    throw new Error(`monthKeyToRange: month ${mon} out of range`);
  }
  const monthStart = `${year}-${pad2(mon)}-01`;
  // Last day: day-0 of next month
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const monthEnd = `${year}-${pad2(mon)}-${pad2(lastDay)}`;
  return { monthStart, monthEnd };
}

/** "Tuần 21" Vietnamese label cho week key. */
export function labelForWeekKey(weekKey: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) return weekKey;
  return `Tuần ${Number(m[2])}`;
}

/** "Tháng 5 / 2026" Vietnamese label cho month key. */
export function labelForMonthKey(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return monthKey;
  return `Tháng ${Number(m[2])} / ${m[1]}`;
}

/**
 * Normalize 1 order timestamp (`payment_on` từ DB) sang Date UTC instance.
 * Mọi callsite của bucket helpers cần đầu vào Date — đảm bảo TypeORM/Mongo
 * raw string + Date object đều handle nhất quán.
 */
export function normalizePaymentOn(input: Date | string): Date {
  if (input instanceof Date) return input;
  // Trim không cần — MySQL trả 'YYYY-MM-DD HH:mm:ss' hoặc ISO 8601
  return new Date(input);
}
