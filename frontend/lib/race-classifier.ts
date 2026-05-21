/**
 * FEATURE-056 — Frontend port of backend F-050 `classifyRaceType` helper.
 *
 * Used by recap page hero badge ("Đường nhựa" / "Trail" / "Ultra Trail").
 * Mirror of `backend/src/modules/race-result/services/athlete-profile.service.ts::classifyRaceType`
 * — keep both in sync if classification heuristic changes.
 *
 * Vendor `raceType` is source of truth; distance only escalates trail → ultra_trail.
 */

export type RaceClassification = 'road' | 'trail' | 'ultra_trail';

export interface ClassifierInput {
  raceType?: string | null;
  distanceKm?: number | null;
  /** Best-effort distance string ("42K", "21 km", "10.5K") — fallback when no distanceKm. */
  distance?: string | null;
}

const VN_LABEL: Record<RaceClassification, string> = {
  road: 'Đường nhựa',
  trail: 'Trail',
  ultra_trail: 'Ultra Trail',
};

export function classifyRaceType(input: ClassifierInput): RaceClassification | undefined {
  const distanceKm = resolveDistanceKm(input);
  const rawType = (input.raceType ?? '').toLowerCase().trim();

  const isTrail =
    rawType.includes('trail') ||
    rawType.includes('mountain') ||
    rawType === 'ultra';

  if (isTrail) {
    if (distanceKm !== null && distanceKm >= 50) return 'ultra_trail';
    return 'trail';
  }

  if (rawType || distanceKm !== null) return 'road';
  return undefined;
}

/** Look up Vietnamese display label for a classification (or "—" if unknown). */
export function classificationLabel(c: RaceClassification | undefined): string {
  return c ? VN_LABEL[c] : '—';
}

function resolveDistanceKm(input: ClassifierInput): number | null {
  if (typeof input.distanceKm === 'number' && input.distanceKm > 0) {
    return input.distanceKm;
  }
  if (typeof input.distance === 'string') {
    const m = input.distance.match(/(\d+(?:\.\d+)?)\s*k/i);
    if (m) {
      const n = parseFloat(m[1]);
      if (n > 0) return n;
    }
  }
  return null;
}
