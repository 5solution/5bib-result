/**
 * F-018 — Medical Incident Tracker constants.
 * Mirrors backend `medical-incident.schema.ts` enums verbatim.
 */

export const SEVERITIES = [1, 2, 3, 4, 5] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = [
  'cardiac',
  'trauma',
  'heat_stroke',
  'dehydration',
  'musculoskeletal',
  'neurological',
  'allergic',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const TRAUMA_SUBTYPES = ['fall', 'laceration', 'head', 'other'] as const;
export type TraumaSubtype = (typeof TRAUMA_SUBTYPES)[number];

export const STATES = [
  'REPORTED',
  'MEDIC_DISPATCHED',
  'MEDIC_ON_SITE',
  'AMB_REQUESTED',
  'HOSPITAL_TRANSFER',
  'RESOLVED_ONSITE',
  'RESOLVED_DNF',
  'CLOSED',
] as const;
export type IncidentState = (typeof STATES)[number];

export const CLOSURE_REASONS = [
  'RESOLVED',
  'FALSE_ALARM',
  'DUPLICATE',
  'ATHLETE_REFUSED_TREATMENT',
] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export const ACTOR_ROLES = ['operator', 'medic', 'race_director'] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export const GPS_SOURCES = [
  'manual',
  'course-pin',
  'aid-station',
  'device',
] as const;
export type GpsSource = (typeof GPS_SOURCES)[number];

/**
 * F-018 BR-MI-12 — Forward-only state matrix (advisory §3.B).
 * Mirrors backend `TRANSITION_MATRIX`. Client-side preview only —
 * server is authoritative.
 */
export const ALLOWED_TRANSITIONS: Record<IncidentState, IncidentState[]> = {
  REPORTED: [
    'MEDIC_DISPATCHED',
    'MEDIC_ON_SITE',
    'AMB_REQUESTED',
    'RESOLVED_ONSITE',
    'RESOLVED_DNF',
    'CLOSED',
  ],
  MEDIC_DISPATCHED: [
    'MEDIC_ON_SITE',
    'AMB_REQUESTED',
    'RESOLVED_ONSITE',
    'RESOLVED_DNF',
    'CLOSED',
  ],
  MEDIC_ON_SITE: [
    'AMB_REQUESTED',
    'RESOLVED_ONSITE',
    'RESOLVED_DNF',
    'CLOSED',
  ],
  AMB_REQUESTED: ['HOSPITAL_TRANSFER', 'RESOLVED_ONSITE', 'RESOLVED_DNF'],
  HOSPITAL_TRANSFER: ['RESOLVED_DNF', 'CLOSED'],
  RESOLVED_ONSITE: ['CLOSED'],
  RESOLVED_DNF: ['CLOSED'],
  CLOSED: [],
};

export function isActiveState(s: IncidentState): boolean {
  return (
    s !== 'CLOSED' && s !== 'RESOLVED_ONSITE' && s !== 'RESOLVED_DNF'
  );
}

/**
 * F-018 BR-MI-03 — color tier (paired with number badge for accessibility).
 * Color must NEVER be sole indicator (WCAG AA — pair with `[N]` badge).
 */
export const SEVERITY_COLORS: Record<Severity, { bg: string; text: string; ring: string }> = {
  1: { bg: 'bg-green-600', text: 'text-white', ring: 'ring-green-300' },
  2: { bg: 'bg-yellow-500', text: 'text-stone-900', ring: 'ring-yellow-300' },
  3: { bg: 'bg-[--5bib-energy]', text: 'text-white', ring: 'ring-orange-300' },
  4: { bg: 'bg-red-600', text: 'text-white', ring: 'ring-red-300' },
  5: { bg: 'bg-red-900', text: 'text-white', ring: 'ring-red-700' },
};

/**
 * F-018 BR-MI-09 — severity auto-suggest (advisory §2.E — visual hint, NEVER hard-bind).
 */
export const SEVERITY_AUTO_SUGGEST: Partial<
  Record<Category | `trauma.${TraumaSubtype}`, Severity>
> = {
  cardiac: 4,
  'trauma.head': 4,
  neurological: 4,
  allergic: 3,
  heat_stroke: 3,
  'trauma.fall': 2,
  dehydration: 2,
  'trauma.laceration': 1,
  musculoskeletal: 1,
  // 'other' deliberately omitted — force conscious choice.
};

/**
 * F-018 BR-MI-17 — SLA targets per severity (target NOT hard threshold —
 * VN trail venue caveat: ambulance can be 60-120 min from remote checkpoints).
 */
export const SLA_TARGETS_MIN: Record<Severity, { medic: number; ambUrban?: number; ambTrail?: number; hospital?: number }> = {
  1: { medic: 10 },
  2: { medic: 8 },
  3: { medic: 5 },
  4: { medic: 5, ambUrban: 15, ambTrail: 30, hospital: 60 },
  5: { medic: 3, ambUrban: 10, ambTrail: 20, hospital: 45 },
};

/** Sev levels that trigger SSE audible alert + Race Director banner pulse. */
export const AUDIBLE_ALERT_SEVERITIES: ReadonlySet<Severity> = new Set([4, 5]);

/** F-018 BR-MI-26 — photo required ≥1 for these severities. */
export const PHOTO_REQUIRED_SEVERITIES: ReadonlySet<Severity> = new Set([4, 5]);

/** F-018 A2 — witness statements ≥2 required for these severities at closure. */
export const WITNESS_REQUIRED_SEVERITIES: ReadonlySet<Severity> = new Set([4, 5]);
export const WITNESS_MIN_COUNT = 2;

/** F-018 BR-MI-27 — client-side resize target. */
export const PHOTO_RESIZE = {
  maxWidth: 1920,
  quality: 0.7,
  maxBytesPostResize: 2 * 1024 * 1024,
} as const;

/** IndexedDB queue config (BR-MI-33). */
export const OFFLINE_QUEUE = {
  dbName: '5bib-medical-offline-v1',
  storeName: 'pending-incidents',
  version: 1,
} as const;
