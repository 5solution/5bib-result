/**
 * F-014 Athletes tab — TS interfaces + runtime guards (F-013 pattern).
 *
 * The generated SDK types `raceResultControllerGetRaceResults` response shape
 * with strict generated DTOs but the actual vendor payload is a defensive
 * superset (PascalCase fields like `Bib`, `Name`, `OverallRank`, `Chiptimes`
 * JSON-string blobs) plus normalized lowercase fields (`chipTime`, `gunTime`).
 *
 * `AthleteRow` here is the union we render in the table — accepts both
 * shapes via permissive `string|number` + `[k: string]: unknown` index.
 *
 * `editHistory[]` is reused as the audit-log surface (Manager Option C —
 * NO new audit-log module; we read from existing race-result subdoc).
 */

import type { AthleteStatus } from './athletes.constant';

/**
 * Edit-history entry (from race-result schema `editHistory[]` subdoc).
 *
 * Shape: `{ editedBy, editedAt, field, oldValue, newValue, reason }`
 * (referenced from CLAUDE.md memory + manager plan PAUSE #4 finding).
 */
export interface AthleteEditHistoryEntry {
  editedBy?: string;
  editedAt?: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

/**
 * Race-result row as returned by `raceResultControllerGetRaceResults`.
 *
 * All fields optional — vendor payload is messy. We accept superset and
 * defensively narrow at render time. Status is DERIVED, not stored.
 */
export interface AthleteRow {
  // Identifiers (one of these is always present in real data)
  _id?: string;
  Bib?: string | number;
  bib?: string | number;
  raceId?: string;
  courseId?: string;
  course_id?: string;

  // Name + demographics
  Name?: string;
  name?: string;
  Gender?: string;
  gender?: string;
  Category?: string;
  category?: string;
  Nationality?: string;
  nationality?: string;
  Club?: string;
  club?: string;

  // Times (may be string or null/empty)
  ChipTime?: string;
  chipTime?: string;
  GunTime?: string;
  gunTime?: string;
  Pace?: string;
  pace?: string;

  // Ranks
  OverallRank?: string | number;
  overallRank?: string | number;
  GenderRank?: string | number;
  genderRank?: string | number;
  CategoryRank?: string | number;
  categoryRank?: string | number;

  // Status signals (Option C derivation inputs)
  TimingPoint?: string;
  timingPoint?: string;
  dnf?: number | boolean;
  dnsChipFail?: boolean;
  dsqReason?: string;

  // Audit subdoc (BR-AS-03 audit-log surface)
  editHistory?: AthleteEditHistoryEntry[];

  // Lifecycle hints (for REG/PICKED derivation)
  racekitReceived?: boolean;
  racekit_received?: boolean;
  startTime?: string;
  finishTime?: string;
  paid?: boolean;

  /** Tolerate vendor passthrough fields. */
  [k: string]: unknown;
}

/** Derived athlete (row + computed status). Used in table render path. */
export interface AthleteWithStatus extends AthleteRow {
  derivedStatus: AthleteStatus;
}

/** Filter state — URL-synced via `useSearchParams`. */
export interface AthleteFilters {
  q: string;
  statuses: AthleteStatus[];
  courseIds: string[];
  gender: 'all' | 'M' | 'F';
  ageGroup: string | 'all';
  paid: 'all' | 'yes' | 'no';
}

export const DEFAULT_FILTERS: AthleteFilters = {
  q: '',
  statuses: [],
  courseIds: [],
  gender: 'all',
  ageGroup: 'all',
  paid: 'all',
};

/** Paginated server response envelope. */
export interface AthletesListEnvelope {
  data: AthleteRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Runtime guard — accepts envelope shape with `data: array`. Tolerates
 * extras. Used at the boundary before render to defend against vendor
 * shape drift (F-013 BR-RK-11 pattern).
 */
export function isAthletesListEnvelope(x: unknown): x is AthletesListEnvelope {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  if (!Array.isArray(e.data)) return false;
  // total / page / pageSize tolerated as missing (default to client-side calc)
  return true;
}

/** Single-row guard — defends `bib` presence. */
export function isAthleteRow(x: unknown): x is AthleteRow {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  const hasBib = r.bib !== undefined || r.Bib !== undefined;
  const hasName = r.name !== undefined || r.Name !== undefined;
  return hasBib || hasName;
}

/** BR-AS-13 — drawer mode discriminator. */
export type DrawerMode = 'edit' | 'profile' | 'closed';

/** Convenience accessor — returns the first non-empty bib variant. */
export function getBib(row: AthleteRow): string {
  const v = row.bib ?? row.Bib;
  return v === undefined || v === null ? '' : String(v);
}

/** Convenience accessor — first non-empty name variant. */
export function getName(row: AthleteRow): string {
  return String(row.name ?? row.Name ?? '');
}

/** Convenience accessor — first non-empty courseId variant. */
export function getCourseId(row: AthleteRow): string {
  return String(row.courseId ?? row.course_id ?? '');
}

/** Convenience accessor — first non-empty chipTime variant. */
export function getChipTime(row: AthleteRow): string {
  return String(row.chipTime ?? row.ChipTime ?? '');
}

/** Convenience accessor — first non-empty gender variant. */
export function getGender(row: AthleteRow): string {
  return String(row.gender ?? row.Gender ?? '');
}
