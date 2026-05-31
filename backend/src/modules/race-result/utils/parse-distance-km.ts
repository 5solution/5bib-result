/**
 * Parse a race-course distance string into kilometers.
 *
 * PROD data zoo (from `race_results.distance` distinct values):
 *   "200m" / "400m" / "800m" / "1000m"       → meters → /1000
 *   "1.5Km" / "4.8km" / "7.2km"              → km decimal
 *   "5K" / "5KM" / "5Km" / "5km" / "10KM"    → km
 *   "21" / "42" / "100" / "70" / "0.6"       → bare km
 *   "6,8"                                     → 6.8 km (legacy vendor comma decimal)
 *   "21K" / "29K" / "58K" / "100KM"           → km
 *   "KID" / "AQUA TRAIL: 10K"                 → null (unknown)
 *
 * Returns null when no usable number is parseable — caller decides fallback.
 * Returns 0 only when the string explicitly parses to 0.
 *
 * Note: a companion `parseDistanceKm` exists in badge.service.ts with miles
 * support ("100M" → 160.93 km) for badge classification. This util is for
 * generic display / speed math and intentionally does NOT treat bare uppercase
 * "M" as miles (would mis-classify "100m" → meters → 0.1 km).
 */
export function parseDistanceKm(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const original = raw.trim();
  if (!original) return null;

  const normalized = original.replace(',', '.');

  // Meters: case-sensitive lowercase `m` and no `km`/`k`/`mi` tokens.
  const meterMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*m$/);
  if (meterMatch && !/km|k\b|mi\b/i.test(normalized)) {
    const n = parseFloat(meterMatch[1]);
    return Number.isFinite(n) && n > 0 ? n / 1000 : null;
  }

  // km / KM / Km / k suffix
  const kmMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:km|k)$/i);
  if (kmMatch) {
    const n = parseFloat(kmMatch[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Bare number — treat as km if in plausible race range (0 < n ≤ 300).
  const bareMatch = normalized.match(/^(\d+(?:\.\d+)?)$/);
  if (bareMatch) {
    const n = parseFloat(bareMatch[1]);
    if (Number.isFinite(n) && n > 0 && n <= 300) return n;
  }

  return null;
}
