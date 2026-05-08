/**
 * F-013 BR-RK-11 — TS interfaces + runtime guard for athlete detail response.
 *
 * The generated SDK function `raceResultControllerGetAthleteDetail` types its
 * response as `unknown`. We MUST validate shape at the boundary before render
 * (defence in depth: malformed payload → reject with error beep + "Lỗi dữ liệu"
 * fallback, distinct from BR-RK-02 not-found).
 *
 * `AthleteDetailResponse` is built from the OBSERVED shape returned by
 * `backend/src/modules/race-result/race-result.controller.ts::getAthleteDetail`
 * (tied to RaceResult mongoose schema). Field names PascalCase + lowercase
 * variants both appear in legacy / synced payloads — guard accepts the
 * defensive superset (matches frontend `[bib]/page.tsx` reads).
 */

/** Kiosk surface mode tracked by KioskModeProvider. */
export type KioskMode = 'admin' | 'bib-input' | 'result';

/** Status value rendered by KioskResultCard (BR-RK-03/04/05/08). */
export type KioskResultStatus = 'FIN' | 'DNS' | 'DNF' | 'DSQ' | 'LIVE';

/**
 * Backend response envelope.
 *
 * Controller line 144-154 returns:
 *   { data: publicData | null, success: boolean, message?: string }
 * where `publicData` is the RaceResult document with
 * `_id` / `editHistory` / `isManuallyEdited` stripped.
 */
export interface AthleteDetailEnvelope {
  data: AthleteDetailData | null;
  success: boolean;
  message?: string;
}

/**
 * Public-safe athlete detail. Built from race-result schema (`schemas/race-result.schema.ts`)
 * minus stripped fields. Optional everywhere — vendor data is messy and we
 * defend against missing keys.
 *
 * NOTE: response also carries legacy PascalCase fields from the upstream
 * RaceResult vendor (Chiptimes / Paces / OverallRanks / GenderRanks / etc.)
 * via `rawData` passthrough. We index those via `[k: string]: unknown`.
 */
export interface AthleteDetailData {
  bib?: string | number;
  name?: string;
  raceId?: string;
  courseId?: string;
  distance?: string;
  // Times
  chipTime?: string;
  gunTime?: string;
  pace?: string;
  // Ranks
  overallRank?: string;
  overallRankNumeric?: number;
  genderRank?: string;
  genderRankNumeric?: number;
  categoryRank?: string;
  categoryRankNumeric?: number;
  // Demographics
  gender?: string;
  category?: string;
  nationality?: string;
  nation?: string;
  club?: string;
  // Status / lifecycle
  timingPoint?: string;
  dnsChipFail?: boolean;
  dsqReason?: string;
  // Vendor PascalCase JSON-string passthroughs (BR-AF-23 verbatim port consumers)
  Chiptimes?: string;
  Paces?: string;
  OverallRanks?: string;
  GenderRanks?: string;
  Member?: string;
  TODs?: string;
  // Allow other keys (vendor extras tolerated)
  [k: string]: unknown;
}

/** Convenience alias used across hooks/components. */
export type AthleteDetailResponse = AthleteDetailEnvelope;

/**
 * BR-RK-11 runtime type guard. Must be true BEFORE rendering KioskResultCard.
 *
 * Accepts:
 *  - well-formed envelope { data: object|null, success: boolean }
 *  - extra fields tolerated (vendor passthrough)
 *
 * Rejects:
 *  - null / undefined / non-object
 *  - missing `success` (boolean)
 *  - `data` neither object nor null
 *  - `data.bib` present but neither string nor number (when present)
 *  - data fields with mismatched primitive types
 */
export function isAthleteDetailResponse(
  x: unknown,
): x is AthleteDetailEnvelope {
  if (x === null || x === undefined) return false;
  if (typeof x !== 'object') return false;
  const env = x as Record<string, unknown>;

  if (typeof env.success !== 'boolean') return false;

  // data must be either null or a plain object
  if (env.data === null) return true;
  if (typeof env.data !== 'object' || Array.isArray(env.data)) return false;

  const d = env.data as Record<string, unknown>;
  // bib if present must be string | number
  if (d.bib !== undefined && typeof d.bib !== 'string' && typeof d.bib !== 'number') {
    return false;
  }
  // name if present must be string
  if (d.name !== undefined && typeof d.name !== 'string') return false;
  // chipTime / gunTime if present must be string
  if (d.chipTime !== undefined && typeof d.chipTime !== 'string') return false;
  if (d.gunTime !== undefined && typeof d.gunTime !== 'string') return false;
  // Chiptimes / Paces / OverallRanks if present must be strings (vendor JSON)
  if (d.Chiptimes !== undefined && typeof d.Chiptimes !== 'string') return false;
  if (d.Paces !== undefined && typeof d.Paces !== 'string') return false;
  if (d.OverallRanks !== undefined && typeof d.OverallRanks !== 'string') return false;

  return true;
}

/**
 * Derive a discrete status bucket for KioskResultCard. Mirrors frontend
 * `deriveFinalStatus` but adapted to the admin kiosk's narrower needs.
 *
 * Order matters — DSQ / DNS / DNF lookup precede finisher / live derivation.
 */
export function deriveKioskStatus(d: AthleteDetailData | null | undefined): KioskResultStatus | null {
  if (!d) return null;
  const tp = (d.timingPoint || '').trim().toUpperCase();
  if (tp === 'DNS') return 'DNS';
  if (tp.startsWith('DSQ')) return 'DSQ';
  if (tp === 'DNF') return 'DNF';
  if (tp.startsWith('FINISH')) {
    // Verify rank/time defend vendor sentinels
    const r = (d.overallRank || '').trim().toUpperCase();
    if (r === 'DNS') return 'DNS';
    if (r.startsWith('DSQ')) return 'DSQ';
    if (r === 'DNF') return 'DNF';
    const rankNum = parseInt(r, 10);
    const hasTime = !!d.chipTime && d.chipTime !== '-' && d.chipTime !== '00:00:00';
    if (Number.isFinite(rankNum) && rankNum > 0 && hasTime) return 'FIN';
    return 'DNF';
  }
  // No Finish reached but data exists → live partial (BR-RK-08)
  return 'LIVE';
}

/** Internal-note privacy guard (BR-RK-05). Kiosk renderer must never print these keys. */
export const FORBIDDEN_INTERNAL_KEYS = [
  'editHistory',
  'isManuallyEdited',
  'dsqInternalNote',
  '_id',
] as const;
