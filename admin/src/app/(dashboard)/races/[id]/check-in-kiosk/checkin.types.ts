/**
 * F-015 BR-CK-18 — Check-In Kiosk types + runtime guards.
 *
 * `isAthleteCheckInResponse` mirrors F-013 BR-RK-11 pattern: the SDK function
 * returns `unknown`, so we MUST validate shape at boundary before render.
 *
 * `AthleteCheckInPayload` is the lookup-by-{bib|cmnd|qr} response shape —
 * derived from `RaceAthletePublicDto` (via `RaceAthleteLookupService` reuse).
 */

/** Surface mode tracked by CheckInModeProvider. */
export type CheckInSurface = 'admin' | 'lookup' | 'result';

/** Lookup mode used by Surface 2. Mirrors `LookupSource` from CHECKIN_CONFIG. */
export type LookupMode = 'qr' | 'bib' | 'cmnd';

/** Backend lookup envelope. */
export interface AthleteCheckInResponse {
  data: AthleteCheckInPayload | AthleteCheckInPayload[] | null;
  success: boolean;
  message?: string;
}

/** Athlete preview shown on Surface 3 — public fields only (NO PII). */
export interface AthleteCheckInPayload {
  athleteId: string | number;
  bib: string;
  name: string;
  course?: string | null;
  courseDistance?: string | null;
  gender?: string | null;
  size?: string | null;
  items?: string | null;
  racekitReceived: boolean;
  racekitReceivedAt?: string | null;
  /** Filled when `racekitReceived=true` — drives BR-CK-03 warning. */
  pickedUpAtStation?: string | null;
  /** Visible chip-verify status (read-only — F-015 doesn't write this). */
  chipVerified?: boolean;
  [k: string]: unknown;
}

/** Confirm pickup result envelope. */
export interface ConfirmPickupResponse {
  success: boolean;
  data?: ConfirmPickupResult;
  message?: string;
}

export interface ConfirmPickupResult {
  bib: string;
  athleteId: string | number;
  checkedInAt: string;
  stationId: string;
  source: LookupMode;
}

/** Stats response for Surface 1 admin tab. */
export interface CheckInStatsResponse {
  success: boolean;
  data?: CheckInStatsPayload;
}

export interface CheckInStatsPayload {
  totalAthletes: number;
  pickedUp: number;
  perStation: Array<{ stationId: string; count: number; lastActivityAt?: string | null }>;
  ratePerMinute: number;
  recentEvents: Array<{ bib: string; name?: string; stationId: string; checkedInAt: string }>;
}

/** SSE event payload broadcast by `/check-in/stream`. */
export interface CheckInSseEvent {
  type: 'pickup' | 'heartbeat';
  raceId?: string;
  bib?: string;
  athleteId?: string | number;
  stationId?: string;
  checkedInAt?: string;
}

/** Local UI state for surface 3 conflict / success modes. */
export type ResultKind =
  | { kind: 'found'; payload: AthleteCheckInPayload }
  | { kind: 'multi-candidate'; payloads: AthleteCheckInPayload[] }
  | { kind: 'not-found'; query: string }
  | { kind: 'data-error'; raw: unknown }
  | { kind: 'network-error'; error: unknown };

export type ConfirmKind =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; result: ConfirmPickupResult }
  | { kind: 'already-picked'; payload: AthleteCheckInPayload }
  | { kind: 'conflict' }
  | { kind: 'network-error' };

/**
 * BR-CK-18 runtime type guard. MUST be true BEFORE rendering AthleteCheckInCard.
 *
 * Accepts:
 *  - well-formed envelope `{ success: boolean, data: object | array | null }`
 *  - extra fields tolerated (forward compat)
 *
 * Rejects:
 *  - null / undefined / non-object
 *  - missing `success` (boolean)
 *  - data primitives where data.bib is wrong type
 */
export function isAthleteCheckInResponse(x: unknown): x is AthleteCheckInResponse {
  if (x === null || x === undefined) return false;
  if (typeof x !== 'object') return false;
  const env = x as Record<string, unknown>;
  if (typeof env.success !== 'boolean') return false;

  if (env.data === null) return true;
  if (Array.isArray(env.data)) {
    return env.data.every((row) => isAthleteCheckInPayload(row));
  }
  if (typeof env.data !== 'object') return false;
  return isAthleteCheckInPayload(env.data);
}

export function isAthleteCheckInPayload(x: unknown): x is AthleteCheckInPayload {
  if (x === null || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  if (p.bib !== undefined && typeof p.bib !== 'string' && typeof p.bib !== 'number') return false;
  if (p.name !== undefined && typeof p.name !== 'string') return false;
  if (p.racekitReceived !== undefined && typeof p.racekitReceived !== 'boolean') return false;
  if (p.athleteId !== undefined && typeof p.athleteId !== 'string' && typeof p.athleteId !== 'number') {
    return false;
  }
  return true;
}

export function isConfirmPickupResponse(x: unknown): x is ConfirmPickupResponse {
  if (x === null || typeof x !== 'object') return false;
  const env = x as Record<string, unknown>;
  if (typeof env.success !== 'boolean') return false;
  if (env.data !== undefined) {
    if (typeof env.data !== 'object' || env.data === null) return false;
    const d = env.data as Record<string, unknown>;
    if (typeof d.bib !== 'string') return false;
  }
  return true;
}

export function isCheckInStatsResponse(x: unknown): x is CheckInStatsResponse {
  if (x === null || typeof x !== 'object') return false;
  const env = x as Record<string, unknown>;
  if (typeof env.success !== 'boolean') return false;
  if (env.data === undefined) return true;
  if (typeof env.data !== 'object' || env.data === null) return false;
  const d = env.data as Record<string, unknown>;
  if (typeof d.totalAthletes !== 'number') return false;
  if (typeof d.pickedUp !== 'number') return false;
  return true;
}
