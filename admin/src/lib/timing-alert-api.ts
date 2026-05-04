/**
 * Timing Miss Alert — admin API wrapper.
 *
 * Pattern theo `race-master-data-api.ts` — hand-typed thin wrapper qua
 * `client.get/post/etc` cho tới khi `pnpm generate:api` regen SDK auto.
 */
import { client } from './api-generated/client.gen';

// ─────────── Types ───────────

/**
 * Manager refactor 03/05/2026: config CHỈ behavior knobs.
 * Race-domain config (apiUrl, checkpoints, cutoff, window) sửa qua
 * `/admin/races/[id]/edit` — Timing Alert đọc race document.
 */
export interface TimingAlertConfigPayload {
  poll_interval_seconds?: number;
  overdue_threshold_minutes?: number;
  top_n_alert?: number;
  enabled?: boolean;
}

export interface TimingAlertConfigResponse {
  config_id: string;
  race_id: string;
  poll_interval_seconds: number;
  overdue_threshold_minutes: number;
  top_n_alert: number;
  enabled: boolean;
  enabled_by_user_id: string | null;
  enabled_at: string | null;
  last_polled_at: string | null;
}

export type TimingAlertSeverity = 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
export type TimingAlertStatus = 'OPEN' | 'RESOLVED' | 'FALSE_ALARM';

export type TimingAlertDetectionType = 'PHANTOM' | 'MIDDLE_GAP';

export interface TimingAlert {
  _id: string;
  race_id: string;
  bib_number: string;
  athlete_name: string | null;
  contest: string | null;
  age_group: string | null;
  gender: string | null;
  last_seen_point: string;
  last_seen_time: string;
  missing_point: string;
  detection_type: TimingAlertDetectionType;
  projected_finish_time: string | null;
  projected_overall_rank: number | null;
  projected_age_group_rank: number | null;
  projected_confidence: number | null;
  overdue_minutes: number;
  severity: TimingAlertSeverity;
  reason: string | null;
  status: TimingAlertStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  first_detected_at: string;
  last_checked_at: string;
  detection_count: number;
}

export interface TimingAlertListResponse {
  items: TimingAlert[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    by_severity: Record<TimingAlertSeverity, number>;
    open_count: number;
    total_count: number;
  };
}

export interface TimingAlertPollLog {
  _id: string;
  race_id: string;
  course_name: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  athletes_fetched: number;
  alerts_created: number;
  alerts_resolved: number;
  alerts_unchanged: number;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// ─────────── API helpers ───────────

/**
 * Custom error class retaining HTTP status — frontend `err instanceof HttpError`
 * + `err.status === 404` để discriminate UX cụ thể (vd reset endpoint
 * 404/409/400). Plain `new Error(string)` mất status info.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

async function clientGet<T>(url: string): Promise<T> {
  const res = await client.get({ url });
  if (res.error) throw new HttpError(res.response?.status ?? 0, extractError(res.error, res.response?.status));
  if (!res.data) throw new Error('Empty response');
  return res.data as T;
}

async function clientPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.post({ url, body });
  if (res.error) throw new HttpError(res.response?.status ?? 0, extractError(res.error, res.response?.status));
  if (!res.data) throw new Error('Empty response');
  return res.data as T;
}

async function clientPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.patch({ url, body });
  if (res.error) throw new HttpError(res.response?.status ?? 0, extractError(res.error, res.response?.status));
  if (!res.data) throw new Error('Empty response');
  return res.data as T;
}

// ─────────── Public API ───────────

export async function getTimingAlertConfig(
  raceId: string,
): Promise<TimingAlertConfigResponse | null> {
  try {
    return await clientGet<TimingAlertConfigResponse>(
      `/api/admin/races/${raceId}/timing-alert/config`,
    );
  } catch (err) {
    if ((err as Error).message.includes('404')) return null;
    throw err;
  }
}

export async function upsertTimingAlertConfig(
  raceId: string,
  payload: TimingAlertConfigPayload,
): Promise<TimingAlertConfigResponse> {
  return clientPost<TimingAlertConfigResponse>(
    `/api/admin/races/${raceId}/timing-alert/config`,
    payload,
  );
}

export async function listTimingAlerts(
  raceId: string,
  filters: {
    severity?: TimingAlertSeverity;
    status?: TimingAlertStatus;
    course?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<TimingAlertListResponse> {
  const params = new URLSearchParams();
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.status) params.set('status', filters.status);
  if (filters.course) params.set('course', filters.course);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return clientGet<TimingAlertListResponse>(
    `/api/admin/races/${raceId}/timing-alert/alerts${qs ? `?${qs}` : ''}`,
  );
}

export interface AlertAuditEntry {
  action: string;
  by: string;
  at: string;
  note?: string;
}

export interface AlertDetailResponse {
  alert: TimingAlert & {
    audit_log: AlertAuditEntry[];
    rr_api_snapshot: Record<string, unknown>;
  };
  courseCheckpoints: Array<{
    key: string;
    name: string;
    distanceKm: number | null;
    orderIndex: number;
  }>;
  trajectory: Array<{
    key: string;
    name: string;
    distanceKm: number | null;
    orderIndex: number;
    timeAtFirstDetect: string | null;
    timeNow: string | null;
    status: 'passed' | 'missing' | 'pending';
    isLastSeen: boolean;
    isMissingPoint: boolean;
  }>;
}

export async function getAlertDetail(
  raceId: string,
  alertId: string,
): Promise<AlertDetailResponse> {
  return clientGet<AlertDetailResponse>(
    `/api/admin/races/${raceId}/timing-alert/alerts/${alertId}`,
  );
}

export async function patchTimingAlert(
  raceId: string,
  alertId: string,
  body: { action: 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN'; note: string },
): Promise<TimingAlert> {
  return clientPatch<TimingAlert>(
    `/api/admin/races/${raceId}/timing-alert/alerts/${alertId}`,
    body,
  );
}

export async function forcePollTimingAlert(
  raceId: string,
): Promise<{
  courses: Array<{
    course: string;
    status: string;
    alerts_created: number;
    alerts_resolved: number;
    error?: string;
  }>;
}> {
  return clientPost<{
    courses: Array<{
      course: string;
      status: string;
      alerts_created: number;
      alerts_resolved: number;
      error?: string;
    }>;
  }>(`/api/admin/races/${raceId}/timing-alert/poll`);
}

export async function listTimingAlertPollLogs(
  raceId: string,
  limit = 50,
): Promise<TimingAlertPollLog[]> {
  return clientGet<TimingAlertPollLog[]>(
    `/api/admin/races/${raceId}/timing-alert/poll-logs?limit=${limit}`,
  );
}

// ─────────── Phase 2 — Operation Dashboard ───────────

export interface DetectedCheckpoint {
  key: string;
  suggestedName: string;
  suggestedDistanceKm: number | null;
  coverage: number;
  medianTimeSeconds: number;
  orderIndex: number;
  passedCount: number;
  isImplicitStart: boolean;
  isImplicitFinish: boolean;
}

export interface CheckpointDiscoveryResponse {
  courseId: string;
  courseName: string;
  courseDistanceKm: number | null;
  totalAthletes: number;
  athletesWithAnyTime: number;
  finishersCount: number;
  detectedCheckpoints: DetectedCheckpoint[];
  notes: string[];
}

export async function discoverCheckpoints(
  raceId: string,
  courseId: string,
): Promise<CheckpointDiscoveryResponse> {
  return clientPost<CheckpointDiscoveryResponse>(
    `/api/admin/races/${raceId}/timing-alert/discover-checkpoints/${courseId}`,
  );
}

export interface CheckpointApplyItem {
  key: string;
  name: string;
  distanceKm?: number | null;
}

export async function applyCheckpoints(
  raceId: string,
  courseId: string,
  checkpoints: CheckpointApplyItem[],
): Promise<{ raceId: string; courseId: string; saved: number }> {
  return clientPost<{ raceId: string; courseId: string; saved: number }>(
    `/api/admin/races/${raceId}/timing-alert/apply-checkpoints/${courseId}`,
    { checkpoints },
  );
}

export interface RaceMeta {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  /** ISO timestamp khi race officially start. Null nếu chưa start. */
  startedAt: string | null;
  /** Source của startedAt: status_history (admin transition, most accurate) | course_start_time (fallback Tier 2) | recent_history (fallback Tier 3 — race=live nhưng không có data tốt) | null */
  startedAtSource:
    | 'status_history'
    | 'course_start_time'
    | 'recent_history'
    | null;
}

export interface RaceStats {
  started: number;
  finished: number;
  onCourse: number;
  suspectOpen: number;
  criticalOpen: number;
  progress: number;
}

export interface CourseStats {
  courseId: string;
  name: string;
  distanceKm: number | null;
  cutOffTime: string | null;
  apiUrl: string | null;
  hasCheckpoints: boolean;
  started: number;
  finished: number;
  onCourse: number;
  suspectCount: number;
  leadingChipTime: string | null;
}

export interface CheckpointPoint {
  key: string;
  name: string;
  distanceKm: number | null;
  orderIndex: number;
  passedCount: number;
  expectedCount: number;
  passedRatio: number;
}

export interface CheckpointProgression {
  courseId: string;
  courseName: string;
  distanceKm: number | null;
  startedCount: number;
  points: CheckpointPoint[];
}

export interface RecentActivityItem {
  type: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface DashboardSnapshot {
  race: RaceMeta;
  raceStats: RaceStats;
  courses: CourseStats[];
  checkpointProgression: CheckpointProgression[];
  recentActivity: RecentActivityItem[];
  generatedAt: string;
}

export async function getDashboardSnapshot(
  raceId: string,
): Promise<DashboardSnapshot> {
  return clientGet<DashboardSnapshot>(
    `/api/admin/races/${raceId}/timing-alert/dashboard-snapshot`,
  );
}

export interface PodiumEntry {
  rank: number;
  bib: string;
  name: string | null;
  chipTime: string | null;
  gunTime: string | null;
  pace: string | null;
  ageGroup: string | null;
  ageGroupRank: number | null;
  gender: string | null;
  nationality: string | null;
  club: string | null;
}

export interface PodiumCourse {
  courseId: string;
  courseName: string;
  distanceKm: number | null;
  finishersCount: number;
  podium: PodiumEntry[];
}

export interface PodiumResponse {
  raceId: string;
  raceTitle: string;
  raceStatus: string;
  generatedAt: string;
  courses: PodiumCourse[];
}

export async function getPodium(raceId: string): Promise<PodiumResponse> {
  return clientGet<PodiumResponse>(
    `/api/admin/races/${raceId}/timing-alert/podium`,
  );
}

export interface ResetRaceDataResponse {
  alertsDeleted: number;
  pollsDeleted: number;
  raceResultsDeleted: number;
  redisKeysDeleted: number;
}

export async function resetRaceData(
  raceId: string,
  includeRaceResults: boolean,
  confirmToken: string,
): Promise<ResetRaceDataResponse> {
  const qs = includeRaceResults ? '?includeRaceResults=true' : '';
  return clientPost<ResetRaceDataResponse>(
    `/api/admin/races/${raceId}/timing-alert/reset${qs}`,
    { confirmToken },
  );
}

/**
 * SSE URL builder — admin UI tạo `EventSource(url, { withCredentials: true })`
 * sau khi nhận được URL từ helper này. Token gửi qua cookie session admin.
 */
export function timingAlertSseUrl(raceId: string): string {
  return `/api/admin/races/${raceId}/timing-alerts/sse`;
}

function extractError(err: unknown, status?: number): string {
  if (status === 401) return 'Token không hợp lệ';
  if (status === 404) return '404';
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return status ? `HTTP ${status}` : 'Request failed';
}
