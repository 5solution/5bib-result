/**
 * F-019 — Awards TypeScript types + runtime guards (BR-AG-40).
 *
 * Pattern verbatim: F-013 `kiosk.types.ts` + F-018 `medical.types.ts`.
 * Every API response funnels through `isPodiumResponse(x): x is PodiumResponse`
 * before useState/useQuery dereferences. Catches SDK regen drift early.
 */

import type {
  AnomalyPattern,
  CompoundingMode,
  Gender,
  PodiumState,
  Resolution,
  Tier,
} from './awards.constant';

export interface PodiumAthlete {
  bib: string;
  name: string;
  rank: number;
  chipTimeMs?: number;
  chipTime?: string;
  gunTimeMs?: number;
  gender?: string;
  /** PII boundary — server returns ageOnRaceDay int, NOT raw DOB. */
  ageOnRaceDay?: number;
  nationality?: string;
  athleteId?: string;
  tied?: boolean;
}

export interface PodiumStateTransition {
  fromState: string;
  toState: PodiumState;
  actorId: string;
  at: string;
  note?: string;
  evidenceUrl?: string;
}

export interface PodiumResponse {
  id: string;
  raceId: string;
  courseId: string;
  courseName: string;
  courseDistanceKm?: number;
  ageGroup: string;
  ageGroupKey: string;
  ageGroupLabel: string;
  gender: Gender;
  presetKey: string;
  compoundingMode: CompoundingMode;
  agTopN: number;
  athletes: PodiumAthlete[];
  state: PodiumState;
  stateHistory: PodiumStateTransition[];
  computedAt?: string;
  lockedAt?: string;
  publishedAt?: string;
  disputedAt?: string;
  finalAt?: string;
  latestPdfS3Key?: string;
  latestPdfGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PodiumListResponse {
  items: PodiumResponse[];
  total: number;
  countsByState: Record<string, number>;
}

export interface AnomalyWarning {
  id: string;
  raceId: string;
  courseId: string;
  bib: string;
  athleteId?: string;
  athleteName?: string;
  pattern: AnomalyPattern;
  tier: Tier;
  confidence: number;
  evidence: Record<string, unknown>;
  ackedBy?: string;
  ackedAt?: string;
  ackNote?: string;
  resolution: Resolution;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  overrideTier?: number;
  transitionHistory: Array<{
    action: string;
    actorId: string;
    at: string;
    note?: string;
    evidenceUrl?: string;
    priorTier?: number;
    newTier?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AnomalyWarningListResponse {
  items: AnomalyWarning[];
  total: number;
  countsByTier: Record<string, number>;
  blockingCount: number;
}

export interface PredictedRankItem {
  athleteId: string;
  bib: string;
  name?: string;
  courseId: string;
  ageGroup: string;
  gender: string;
  predictedRank: number;
  estimatedFinishSec: number;
  remainingKm: number;
  lastSplitDistanceKm: number;
  errorMarginMin: number;
  pattern: 'A';
  confidence: number;
}

// ───────────── Runtime guards (BR-AG-40 / F-013 pattern) ─────────────

export function isPodiumResponse(x: unknown): x is PodiumResponse {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) return false;
  if (typeof o.raceId !== 'string') return false;
  if (typeof o.courseId !== 'string') return false;
  if (typeof o.ageGroupKey !== 'string') return false;
  if (typeof o.gender !== 'string') return false;
  if (typeof o.state !== 'string') return false;
  if (!Array.isArray(o.athletes)) return false;
  if (!Array.isArray(o.stateHistory)) return false;
  return true;
}

export function isPodiumListResponse(x: unknown): x is PodiumListResponse {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.items)) return false;
  if (typeof o.total !== 'number') return false;
  if (!o.items.every((i: unknown) => isPodiumResponse(i))) return false;
  return true;
}

export function isAnomalyWarning(x: unknown): x is AnomalyWarning {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) return false;
  if (typeof o.raceId !== 'string') return false;
  if (typeof o.bib !== 'string') return false;
  if (typeof o.pattern !== 'string') return false;
  if (typeof o.tier !== 'number' || o.tier < 1 || o.tier > 3) return false;
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 1) {
    return false;
  }
  if (typeof o.resolution !== 'string') return false;
  if (!Array.isArray(o.transitionHistory)) return false;
  return true;
}

export function isAnomalyWarningListResponse(
  x: unknown,
): x is AnomalyWarningListResponse {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.items)) return false;
  if (typeof o.total !== 'number') return false;
  if (typeof o.blockingCount !== 'number') return false;
  if (!o.items.every((i: unknown) => isAnomalyWarning(i))) return false;
  return true;
}

/** State machine client-side helper — do NOT trust as authoritative. */
export function canTransitionTo(
  from: PodiumState,
  to: PodiumState,
  matrix: Record<PodiumState, PodiumState[]>,
): boolean {
  return (matrix[from] ?? []).includes(to);
}
