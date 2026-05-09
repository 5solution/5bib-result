/**
 * F-018 — Medical Incident TypeScript types + runtime guards.
 *
 * Pattern: F-013 `kiosk.types.ts` — every API response funnels through
 * `isIncidentResponse(x): x is IncidentResponse` before useState/useQuery
 * dereferences. Catches SDK regen drift early (post-F-015 4h debug lesson).
 */

import {
  Category,
  ClosureReason,
  GpsSource,
  IncidentState,
  Severity,
  TraumaSubtype,
} from './medical.constant';

export interface GpsLocation {
  lat: number;
  lng: number;
  source: GpsSource;
  aidStationId?: string;
  accuracyMeters?: number;
}

export interface IncidentTransition {
  from: string;
  to: IncidentState;
  actorId: string;
  actorRole: 'operator' | 'medic' | 'race_director';
  at: string;
  reason?: string;
  gps?: GpsLocation;
}

export interface IncidentAttachment {
  s3Key: string;
  mime: string;
  sizeBytes: number;
  uploadedAt: string;
  signedUrl?: string;
}

export interface WitnessStatement {
  name: string;
  statement?: string;
  contact?: string;
  signedAt: string;
}

export interface MedicalDirectorSignature {
  name: string;
  signedAt: string;
}

export interface IncidentResponse {
  id: string;
  raceId: string;
  bib?: string;
  athleteName?: string;
  severity: Severity;
  category: Category;
  traumaSubtype?: TraumaSubtype;
  description?: string;
  gpsLocation: GpsLocation;
  reportedByUserId: string;
  reportedAt: string;
  state: IncidentState;
  closureReason?: ClosureReason;
  incidentTransitions: IncidentTransition[];
  medicalTeamAssigned: string[];
  witnessStatements: WitnessStatement[];
  medicalDirectorSignature?: MedicalDirectorSignature;
  attachments: IncidentAttachment[];
  ambulanceETA?: string;
  medicArrivedAt?: string;
  outcome?: string;
  anonymized: boolean;
  latestPdfS3Key?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentListResponse {
  items: IncidentResponse[];
  total: number;
  limit: number;
  offset: number;
  activeCount: number;
}

// ----------------------- Runtime guards -----------------------

/**
 * Runtime guard for SDK `unknown` responses (BR-MI-36).
 * Tolerates extra fields (forward-compat) but rejects malformed shapes.
 */
export function isIncidentResponse(x: unknown): x is IncidentResponse {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) return false;
  if (typeof o.raceId !== 'string') return false;
  if (typeof o.severity !== 'number' || o.severity < 1 || o.severity > 5) {
    return false;
  }
  if (typeof o.category !== 'string') return false;
  if (typeof o.state !== 'string') return false;
  // gpsLocation must be present + valid lat/lng numbers.
  const gps = o.gpsLocation as Record<string, unknown> | undefined;
  if (!gps || typeof gps !== 'object') return false;
  if (typeof gps.lat !== 'number' || typeof gps.lng !== 'number') return false;
  // Arrays must be present (may be empty).
  if (!Array.isArray(o.incidentTransitions)) return false;
  if (!Array.isArray(o.medicalTeamAssigned)) return false;
  if (!Array.isArray(o.witnessStatements)) return false;
  if (!Array.isArray(o.attachments)) return false;
  return true;
}

export function isIncidentListResponse(x: unknown): x is IncidentListResponse {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.items)) return false;
  if (typeof o.total !== 'number') return false;
  if (typeof o.activeCount !== 'number') return false;
  if (!o.items.every((i: unknown) => isIncidentResponse(i))) return false;
  return true;
}

/** Severity guard for unknown numeric input (e.g. URL params). */
export function isSeverity(x: unknown): x is Severity {
  return typeof x === 'number' && x >= 1 && x <= 5 && Number.isInteger(x);
}

/** State machine client-side helper — do NOT trust as authoritative. */
export function canTransitionTo(
  from: IncidentState,
  to: IncidentState,
  matrix: Record<IncidentState, IncidentState[]>,
): boolean {
  return (matrix[from] ?? []).includes(to);
}
