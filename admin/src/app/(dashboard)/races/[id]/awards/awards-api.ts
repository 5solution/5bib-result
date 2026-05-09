/**
 * F-019 — Awards API typed wrapper.
 *
 * Pattern reference: `course-map-api.ts` + `timing-alert-api.ts`.
 * Phase 1 wraps fetch via existing `/api/[...proxy]/route.ts` runtime proxy
 * (Logto auth injected server-side). After backend builds + `pnpm generate:api`,
 * SDK functions can replace these wrappers — no caller changes required.
 *
 * KHÔNG raw fetch() ở caller code — chỉ ở wrapper layer này.
 */

import {
  isAnomalyWarning,
  isAnomalyWarningListResponse,
  isPodiumListResponse,
  isPodiumResponse,
  type AnomalyWarning,
  type AnomalyWarningListResponse,
  type PodiumListResponse,
  type PodiumResponse,
  type PredictedRankItem,
} from './awards.types';
import type { CompoundingMode, PodiumState, PresetKey, Resolution, Tier } from './awards.constant';

const BASE = '/api/admin/races';

async function request<T>(
  path: string,
  init?: RequestInit,
  guard?: (x: unknown) => x is T,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  const body = await res.json().catch(() => null);
  if (guard && !guard(body)) {
    throw new Error('Phản hồi API không khớp schema (runtime guard)');
  }
  return body as T;
}

export interface ListPodiumFilter {
  courseId?: string;
  gender?: 'M' | 'F';
  ageGroup?: string;
  state?: PodiumState;
  limit?: number;
  offset?: number;
}

export function listPodium(
  raceId: string,
  filter: ListPodiumFilter = {},
): Promise<PodiumListResponse> {
  const qs = new URLSearchParams();
  if (filter.courseId) qs.set('courseId', filter.courseId);
  if (filter.gender) qs.set('gender', filter.gender);
  if (filter.ageGroup) qs.set('ageGroup', filter.ageGroup);
  if (filter.state) qs.set('state', filter.state);
  if (filter.limit != null) qs.set('limit', String(filter.limit));
  if (filter.offset != null) qs.set('offset', String(filter.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request(
    `${BASE}/${raceId}/awards/ag-podium${query}`,
    undefined,
    isPodiumListResponse,
  );
}

export function getPodium(raceId: string, podiumId: string): Promise<PodiumResponse> {
  return request(
    `${BASE}/${raceId}/awards/ag-podium/${podiumId}`,
    undefined,
    isPodiumResponse,
  );
}

export interface RecomputeRequest {
  courseId?: string;
}

export interface RecomputeResponse {
  raceId: string;
  podiumsCreatedOrUpdated: number;
  warningsCreated: number;
  durationMs: number;
}

export function recompute(
  raceId: string,
  body: RecomputeRequest = {},
): Promise<RecomputeResponse> {
  return request(`${BASE}/${raceId}/awards/recompute`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface ListAnomalyFilter {
  courseId?: string;
  tier?: Tier;
  resolution?: Resolution;
  limit?: number;
  offset?: number;
}

export function listAnomalies(
  raceId: string,
  filter: ListAnomalyFilter = {},
): Promise<AnomalyWarningListResponse> {
  const qs = new URLSearchParams();
  if (filter.courseId) qs.set('courseId', filter.courseId);
  if (filter.tier != null) qs.set('tier', String(filter.tier));
  if (filter.resolution) qs.set('resolution', filter.resolution);
  if (filter.limit != null) qs.set('limit', String(filter.limit));
  if (filter.offset != null) qs.set('offset', String(filter.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request(
    `${BASE}/${raceId}/awards/anomaly-warnings${query}`,
    undefined,
    isAnomalyWarningListResponse,
  );
}

export function ackAnomaly(
  raceId: string,
  warningId: string,
  body: { note: string; evidenceUrl?: string },
): Promise<AnomalyWarning> {
  return request(
    `${BASE}/${raceId}/awards/anomaly-warnings/${warningId}/ack`,
    { method: 'PATCH', body: JSON.stringify(body) },
    isAnomalyWarning,
  );
}

export function resolveAnomaly(
  raceId: string,
  warningId: string,
  body: {
    resolution: 'ignored' | 'fixed' | 'btc_override';
    note: string;
    evidenceUrl?: string;
    overrideTier?: Tier;
  },
): Promise<AnomalyWarning> {
  return request(
    `${BASE}/${raceId}/awards/anomaly-warnings/${warningId}/resolve`,
    { method: 'PATCH', body: JSON.stringify(body) },
    isAnomalyWarning,
  );
}

export function transitionPodiumState(
  raceId: string,
  podiumId: string,
  body: { toState: PodiumState; note?: string; evidenceUrl?: string },
): Promise<PodiumResponse> {
  return request(
    `${BASE}/${raceId}/awards/podium/${podiumId}/state`,
    { method: 'PATCH', body: JSON.stringify(body) },
    isPodiumResponse,
  );
}

export function listPredictedRanks(
  raceId: string,
): Promise<{ items: PredictedRankItem[]; total: number }> {
  return request(`${BASE}/${raceId}/awards/predicted-ranks`);
}

export interface PdfExportResponse {
  s3Key: string;
  signedUrl: string;
  expiresAtIso: string;
  bytes: number;
  generatedAt: string;
  warning?: string;
}

export function exportPodiumPdf(
  raceId: string,
  podiumId: string,
  options: { includeWatermark?: boolean; includeSignatureLine?: boolean } = {},
): Promise<PdfExportResponse> {
  return request(`${BASE}/${raceId}/awards/podium/${podiumId}/pdf`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export interface PresetConfigUpdate {
  courseId: string;
  presetKey: PresetKey;
  compoundingMode?: CompoundingMode;
  agTopN?: number;
  paceThresholdOverride?: number;
}

// ── F-019 v2 — AG Eligibility Report ──
export interface BracketDistributionItem {
  ageGroup: string;
  gender: 'M' | 'F';
  count: number;
}

export interface VendorCategoryHealth {
  populated: number;
  empty: number;
  malformed: number;
}

export interface AGEligibilityReport {
  raceId: string;
  totalAthletes: number;
  withDob: number;
  withoutDob: number;
  coverage: number;
  readinessLevel: 'READY' | 'WARNING' | 'NOT_READY';
  missingDobBibs: string[];
  bracketDistribution: BracketDistributionItem[];
  vendorCategoryHealth: VendorCategoryHealth;
  bracketSource: '5bib' | 'vendor' | 'hybrid';
  lastSyncedAt?: string;
}

export function getAgEligibility(raceId: string): Promise<AGEligibilityReport> {
  return request(`${BASE}/${raceId}/awards/ag-eligibility`);
}

// ── re-exports for hooks ──
export type { PodiumResponse, PodiumListResponse, AnomalyWarning, AnomalyWarningListResponse, PredictedRankItem };
