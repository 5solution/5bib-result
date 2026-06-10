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

// ─────────────────────────────────────────────────────────────────────────────
// F-082 — Period-keyed TZ cutover cho kỳ đối soát/phí (Danny chốt 2026-06-10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * F-082 — Kỳ ĐẦU TIÊN dùng ICT boundary. Kỳ < cutover giữ UTC boundary
 * nguyên trạng để số chứng từ đã ký với merchant KHÔNG đổi khi
 * preview/re-create/re-query kỳ cũ sau deploy.
 *
 * QUAN TRỌNG: cutover key theo PERIOD (YYYY-MM của kỳ), KHÔNG theo thời điểm
 * chạy/createdAt (anti-pattern F040_PRE_F016_CUTOFF createdAt-based).
 */
export const ICT_PERIOD_CUTOVER = '2026-06';

/** 'YYYY-MM' kỳ trước. Vd '2026-01' → '2025-12'. */
function prevPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, '0')}`;
}

/** Epoch ms của giây CUỐI kỳ `YYYY-MM` theo cutover rule. */
function endOfPeriodMs(period: string): number {
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  if (period >= ICT_PERIOD_CUTOVER) {
    // ICT end: 23:59:59 ICT = (23:59:59 UTC) - 7h
    return Date.parse(lastDate + 'T23:59:59Z') - ICT_OFFSET_MS;
  }
  // Legacy UTC end (kỳ cũ giữ nguyên)
  return Date.parse(lastDate + 'T23:59:59Z');
}

/**
 * F-082 — UTC datetime range [fromUtc, toUtc] (inclusive, SQL `>= ? AND <= ?`)
 * cho dải kỳ calendar VN `[periodStartDate, periodEndDate]` (YYYY-MM-DD,
 * luôn là ngày 1 và ngày cuối tháng per `IsPeriodBoundaryDate` validator).
 *
 * SEAM CONTINUITY INVARIANT (chống double-count 7h tại cutover):
 *   startOf(P) = endOf(prevPeriod(P)) + 1s
 * → Kỳ T5/2026 (UTC) end '2026-05-31 23:59:59'; kỳ T6/2026 start
 *   '2026-06-01 00:00:00' (KHÔNG phải ICT start 31/5 17:00 — tránh đếm lại
 *   đơn 17:00-23:59:59 UTC 31/5 đã thuộc T5); T6 end ICT '2026-06-30
 *   16:59:59'; từ T7/2026 full ICT cả 2 đầu. Đơn ICT 00:00-06:59 sáng 1/6
 *   thuộc kỳ T5 theo số đã ký — chấp nhận 1 lần duy nhất tại seam.
 *
 * Multi-month range (straddle cutover OK): from theo tháng của
 * periodStartDate, to theo tháng của periodEndDate — continuity đảm bảo
 * không gap/không overlap với các kỳ lân cận.
 */
export function periodRangeUtc(
  periodStartDate: string,
  periodEndDate: string,
): { fromUtc: string; toUtc: string } {
  const startPeriod = periodStartDate.slice(0, 7);
  const endPeriod = periodEndDate.slice(0, 7);
  const fromMs = endOfPeriodMs(prevPeriod(startPeriod)) + 1_000;
  const toMs = endOfPeriodMs(endPeriod);
  return {
    fromUtc: toUtcSqlDatetime(new Date(fromMs)),
    toUtc: toUtcSqlDatetime(new Date(toMs)),
  };
}
