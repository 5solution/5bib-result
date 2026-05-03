/**
 * Timing Miss Alert — admin API wrapper.
 *
 * Pattern theo `race-master-data-api.ts` — hand-typed thin wrapper qua
 * `client.get/post/etc` cho tới khi `pnpm generate:api` regen SDK auto.
 */
import { client } from './api-generated/client.gen';

// ─────────── Types ───────────

export interface CourseCheckpoint {
  key: string;
  distance_km: number;
}

export interface TimingAlertConfigPayload {
  rr_event_id: string;
  rr_api_keys: Record<string, string>;
  course_checkpoints: Record<string, CourseCheckpoint[]>;
  cutoff_times?: Record<string, string>;
  event_start_iso?: string;
  event_end_iso?: string;
  poll_interval_seconds?: number;
  overdue_threshold_minutes?: number;
  top_n_alert?: number;
  enabled?: boolean;
}

export interface TimingAlertConfigResponse {
  config_id: string;
  race_id: string;
  rr_event_id: string;
  rr_api_keys_masked: Record<string, string>;
  course_checkpoints: Record<string, CourseCheckpoint[]>;
  cutoff_times: Record<string, string>;
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

async function clientGet<T>(url: string): Promise<T> {
  const res = await client.get({ url });
  if (res.error) throw new Error(extractError(res.error, res.response?.status));
  if (!res.data) throw new Error('Empty response');
  return res.data as T;
}

async function clientPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.post({ url, body });
  if (res.error) throw new Error(extractError(res.error, res.response?.status));
  if (!res.data) throw new Error('Empty response');
  return res.data as T;
}

async function clientPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.patch({ url, body });
  if (res.error) throw new Error(extractError(res.error, res.response?.status));
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
