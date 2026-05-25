/**
 * F-064 — Event date derive + athlete count derive helpers.
 *
 * Centralised helpers used by `ContractsService.buildRenderContext()` to
 * populate the new template variables introduced in Phase 4:
 *   - `{eventStartDate}` / `{eventEndDate}`
 *   - `{setupDate}` (raceDate - 3 days fallback)
 *   - `{expoDate}` (raceDate - 1 day fallback)
 *   - `{athleteCount}` (derive from lineItems quantity match)
 *
 * Design notes:
 *   - All functions return `null`/empty when input is missing or invalid —
 *     callers wrap result with `sanitizeContext()` (Date → dd/mm/yyyy VN
 *     locale, null → empty string).
 *   - `raceDate` is FREE-FORMAT STRING (Danny chốt B 2026-05-11). We only
 *     derive setup/expo when the string parses to a valid ISO calendar
 *     date — multi-day free-form text returns null (no hardcoded fallback,
 *     consistent F-044/F-045 anti-leak pattern).
 *   - Athlete count regex matches Vietnamese + English keywords; admin can
 *     override via `expectedAthleteCount` field (F-065 will improve regex
 *     if false-positive surfaces in PROD per PAUSE-64-12).
 */

/**
 * Parse free-format raceDate string to Date when it matches ISO yyyy-mm-dd
 * prefix. Returns null for multi-day free-form strings (e.g.
 * "06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026").
 *
 * Anti-leak rationale: returning null forces the template to render empty
 * (via docxtemplater `nullGetter`) instead of hardcoded fallback dates —
 * we have learned the cost of hidden hardcoded leaks in F-044.
 */
export function parseRaceDateIso(
  raceDate: Date | string | null | undefined,
): Date | null {
  if (raceDate == null) return null;
  if (raceDate instanceof Date) {
    return Number.isNaN(raceDate.getTime()) ? null : raceDate;
  }
  if (typeof raceDate !== 'string') return null;
  // Match strict ISO yyyy-mm-dd prefix; reject "01/05/2026" or free-form text.
  if (!/^\d{4}-\d{2}-\d{2}/.test(raceDate)) return null;
  const d = new Date(raceDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Derive setup date = raceDate - 3 days when admin doesn't override.
 * Returns null when raceDate is unparseable or missing.
 */
export function deriveSetupDate(
  raceDate: Date | string | null | undefined,
): Date | null {
  const r = parseRaceDateIso(raceDate);
  if (!r) return null;
  return new Date(r.getTime() - 3 * 24 * 60 * 60 * 1000);
}

/**
 * Derive expo date = raceDate - 1 day when admin doesn't override.
 * Returns null when raceDate is unparseable or missing.
 */
export function deriveExpoDate(
  raceDate: Date | string | null | undefined,
): Date | null {
  const r = parseRaceDateIso(raceDate);
  if (!r) return null;
  return new Date(r.getTime() - 1 * 24 * 60 * 60 * 1000);
}

/**
 * Athlete-related keyword regex used by `deriveAthleteCount`.
 *
 * Whitelist: explicit Vietnamese terms (vận động viên, vđv) + English
 * (athlete, runner) + product identifiers (bib, racekit).
 *
 * Known false-positive risk (PAUSE-64-12 — defer F-065):
 *   "Banner BIB sponsor" → matches but quantity is banner count, not
 *   athletes. Mitigation: admin override via `expectedAthleteCount`.
 */
const ATHLETE_KEYWORD_REGEX =
  /\b(athlete|runner|bib|racekit|race ?kit|vđv)\b|vận\s+động\s+viên/i;

interface LineItemForAthleteCount {
  description?: string;
  quantity?: number;
}

/**
 * Derive athlete count from line items quantity sum.
 *
 * Priority:
 *   1. `expectedAthleteCount > 0` admin override wins
 *   2. Sum `quantity` of line items whose `description` matches
 *      ATHLETE_KEYWORD_REGEX
 *   3. Fallback 0 (no hardcoded "3000" leak — template renders 0 if no
 *      athlete-related line items, admin spot-checks during review)
 */
export function deriveAthleteCount(
  lineItems: LineItemForAthleteCount[] | null | undefined,
  explicitOverride?: number | null,
): number {
  if (
    explicitOverride != null &&
    typeof explicitOverride === 'number' &&
    explicitOverride > 0
  ) {
    return explicitOverride;
  }
  if (!Array.isArray(lineItems) || lineItems.length === 0) return 0;
  const sum = lineItems
    .filter((li) => ATHLETE_KEYWORD_REGEX.test(li.description ?? ''))
    .reduce((acc, li) => acc + Number(li.quantity ?? 0), 0);
  return Number.isFinite(sum) ? sum : 0;
}

/**
 * VN-style dd/mm/yyyy formatter used for template variables that need
 * direct string injection (rather than rely on `sanitizeContext`).
 *
 * Returns empty string for null/undefined/invalid input — consistent
 * F-044/F-045 anti-leak pattern.
 */
export function formatVnDate(
  d: Date | string | null | undefined,
): string {
  if (d == null) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
