/**
 * Parse a race-course distance string into kilometers.
 *
 * Mirrors `backend/src/modules/race-result/utils/parse-distance-km.ts` —
 * keep in sync when changing parsing rules.
 *
 * Handles real-world PROD formats:
 *   "200m" / "400m" / "800m" / "1000m"  → meters → /1000
 *   "1.5Km" / "4.8km" / "5K" / "10KM"   → km variant
 *   "21" / "42" / "0.6" / "06"          → bare km
 *   "6,8"                                → 6.8 km (legacy vendor)
 *   "KID" / "AQUA TRAIL: 10K"            → null
 *
 * Returns null when no usable number is parseable.
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
