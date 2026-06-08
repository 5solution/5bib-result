/**
 * FEATURE-074 — YoY (year-over-year) registration curve helpers.
 * Aligns two races by "days before race day" so curves with different calendar
 * dates overlay. Pure / testable. No DB.
 */

export interface YoyPoint {
  daysBefore: number; // axis: 0 = race day, larger = earlier
  cum: number; // cumulative paid registrations by that point in time
}

export const YOY_MAX_DAYS = 180;

/**
 * Compute days-before-race for one order. Returns clamped int in [0, maxDays],
 * or null if either date is invalid. Orders placed AFTER race day → 0.
 */
export function daysBefore(
  eventStart: Date | null,
  paymentOn: Date | null,
  maxDays = YOY_MAX_DAYS,
): number | null {
  if (
    !eventStart ||
    !paymentOn ||
    Number.isNaN(eventStart.getTime()) ||
    Number.isNaN(paymentOn.getTime())
  ) {
    return null;
  }
  const ms = eventStart.getTime() - paymentOn.getTime();
  const d = Math.floor(ms / 86400000);
  if (d < 0) return 0; // placed after race day
  return Math.min(d, maxDays);
}

/**
 * Build cumulative-by-days-before curve. Input = list of daysBefore values
 * (one per paid order). Output points from maxDays → 0; cum[d] = #orders placed
 * at ≥ d days before (i.e. by that point in time).
 */
export function cumulativeCurve(
  daysBeforeList: number[],
  maxDays = YOY_MAX_DAYS,
): YoyPoint[] {
  const hist = new Array<number>(maxDays + 1).fill(0);
  for (const d of daysBeforeList) {
    if (d == null || d < 0) continue;
    hist[Math.min(d, maxDays)]++;
  }
  // cumulative from earliest (maxDays) toward race day (0)
  const points: YoyPoint[] = [];
  let running = 0;
  for (let d = maxDays; d >= 0; d--) {
    running += hist[d];
    points.push({ daysBefore: d, cum: running });
  }
  return points; // ordered maxDays..0
}
