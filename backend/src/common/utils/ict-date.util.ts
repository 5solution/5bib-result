/**
 * F-081 — ICT (Asia/Ho_Chi_Minh, UTC+7) date utilities.
 *
 * VẤN ĐỀ SYSTEMIC: server/container chạy UTC, business 5BIB là giờ VN (ICT).
 * Mọi chỗ convert `Date` → date-string (`toISOString().slice(0,10)`) hoặc
 * month-boundary (`new Date(y, m, 1)` / `Date.UTC(y, m, 1)`) mà KHÔNG shift
 * +7h đều lệch: đơn paid ICT 00:00–06:59 sáng rơi vào NGÀY/KỲ TRƯỚC theo UTC.
 *
 * Convention: dùng các helper này cho MỌI logic "ngày/tháng theo nghiệp vụ VN".
 * KHÔNG dùng cho timestamp kỹ thuật (log, filename — UTC ok).
 *
 * F-076 precedent: `isoDateIct()` trong invoice-reconcile crons — helpers này
 * generalize pattern đó cho toàn codebase.
 */

const ICT_OFFSET_MS = 7 * 3_600_000;

/** Shift một Date (UTC instant) sang "ICT wall clock" để đọc Y/M/D qua getUTC*. */
function shiftToIct(d: Date): Date {
  return new Date(d.getTime() + ICT_OFFSET_MS);
}

/** `YYYY-MM-DD` của instant `d` THEO GIỜ ICT (KHÔNG phải UTC). */
export function toIctDateString(d: Date): string {
  const ict = shiftToIct(d);
  const y = ict.getUTCFullYear();
  const m = String(ict.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ict.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `YYYY-MM-DD` hôm nay theo ICT. */
export function nowIctDateString(): string {
  return toIctDateString(new Date());
}

/**
 * UTC instant của 00:00 ICT ngày đầu tháng chứa `d` (theo ICT).
 * Vd d = 2026-06-01T01:00Z (= ICT 08:00 1/6) → return 2026-05-31T17:00:00Z
 * (= ICT 1/6 00:00).
 */
export function startOfMonthIct(d: Date): Date {
  const ict = shiftToIct(d);
  const utcMidnightOfIctMonthStart = Date.UTC(
    ict.getUTCFullYear(),
    ict.getUTCMonth(),
    1,
  );
  return new Date(utcMidnightOfIctMonthStart - ICT_OFFSET_MS);
}

/** UTC instant của 00:00 ICT của ngày ICT chứa `d`. */
export function startOfDayIct(d: Date): Date {
  const ict = shiftToIct(d);
  const utcMidnight = Date.UTC(
    ict.getUTCFullYear(),
    ict.getUTCMonth(),
    ict.getUTCDate(),
  );
  return new Date(utcMidnight - ICT_OFFSET_MS);
}

/**
 * SQL datetime string `YYYY-MM-DD HH:mm:ss` (UTC) của instant `d`.
 * Dùng cho filter cột datetime UTC (vd `payment_on >= ?`) với boundary
 * đã compute đúng ICT qua startOfMonthIct/startOfDayIct.
 */
export function toUtcSqlDatetime(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * UTC datetime range [from, toExclusive) cover trọn 1 ngày ICT `YYYY-MM-DD`.
 * Vd '2026-06-09' → from='2026-06-08 17:00:00', to='2026-06-09 17:00:00'.
 */
export function ictDayRangeUtc(ictDate: string): {
  fromUtc: string;
  toUtcExclusive: string;
} {
  const startUtcMs = Date.parse(ictDate + 'T00:00:00Z') - ICT_OFFSET_MS;
  return {
    fromUtc: toUtcSqlDatetime(new Date(startUtcMs)),
    toUtcExclusive: toUtcSqlDatetime(new Date(startUtcMs + 24 * 3_600_000)),
  };
}
