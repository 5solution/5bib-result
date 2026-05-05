/**
 * FEATURE-003 BR-12 — render kỳ đối soát label theo single-month vs multi-month range.
 *
 * Inputs are stored period_start (YYYY-MM-DD) and period_end (YYYY-MM-DD).
 * Outputs are Vietnamese labels for DOCX/XLSX header.
 */

function parseYearMonth(ymd: string): { year: number; month: number } | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Returns "Tháng N năm Y" (single) or "Tháng Ms năm Ys đến Tháng Me năm Ye" (range).
 * Falls back to the legacy "(Từ start đến hết end)" with date strings for malformed input.
 */
export function renderPeriodLabel(period_start: string, period_end: string): string {
  const start = parseYearMonth(period_start);
  const end = parseYearMonth(period_end);
  if (!start || !end) {
    return `(Từ ${period_start} đến hết ${period_end})`;
  }
  if (start.year === end.year && start.month === end.month) {
    return `Tháng ${start.month} năm ${start.year}`;
  }
  return `Tháng ${start.month} năm ${start.year} đến Tháng ${end.month} năm ${end.year}`;
}

/**
 * Filename period segment for ZIP export.
 *  - N=1 → "YYYY_MM" (legacy)
 *  - N>1 → "YYYY_MMs_den_YYYY_MMe"
 */
export function filenamePeriodSegment(period_start: string, period_end: string): string {
  const start = parseYearMonth(period_start);
  const end = parseYearMonth(period_end);
  if (!start || !end) return 'unknown';
  const startStr = `${start.year}_${String(start.month).padStart(2, '0')}`;
  const endStr = `${end.year}_${String(end.month).padStart(2, '0')}`;
  if (startStr === endStr) return startStr;
  return `${startStr}_den_${endStr}`;
}
