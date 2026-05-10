/**
 * F-023 Dashboard SDK shim — typed wrapper cho 7 endpoint
 * `/api/admin/dashboard/*`. Tạo bằng tay vì lúc Coder ship F-023 không thể
 * spawn backend local (Mongo tunnel offline) → KHÔNG chạy được
 * `pnpm generate:api`. PAUSE-CODER-V23-SDK-REGEN flagged trong
 * 03-coder-implementation.md.
 *
 * Khi CD pipeline regen SDK kế tiếp (`pnpm generate:api` từ swagger live),
 * `api-generated/sdk.gen.ts` sẽ có hàm `dashboardControllerGet*` thật. Lúc đó
 * có thể migrate import sang SDK chính thức (1 dòng thay đổi mỗi file). Shim
 * này tự đứng độc lập, KHÔNG đụng vào api-generated.
 */
import { client as defaultClient } from './api-generated/client.gen';

type Client = typeof defaultClient;

interface CallOptions {
  client?: Client;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
}

interface SdkResult<T> {
  data?: T;
  error?: unknown;
  response?: Response;
}

async function getJson<T>(
  url: string,
  options?: CallOptions,
): Promise<SdkResult<T>> {
  const c: Client = options?.client ?? defaultClient;
  return c.get<T, unknown, false>({
    url,
    headers: options?.headers,
    query: options?.query,
  }) as unknown as Promise<SdkResult<T>>;
}

// ── Typed shapes (đồng bộ với DTO backend) ────────────────────────────

export interface KpiCardSdk {
  key: string;
  label: string;
  value: number;
  prevValue: number;
  deltaPercent: number | null;
  unit: 'vnd' | 'count';
}

export interface KpiResponseSdk {
  kpis: KpiCardSdk[];
  period: string;
  periodStart: string;
  prevPeriodStart: string;
}

export interface SparklinePointSdk {
  date: string;
  value: number;
}

export interface SparklineSeriesSdk {
  key: string;
  points: SparklinePointSdk[];
}

export interface SparklinesResponseSdk {
  series: SparklineSeriesSdk[];
  days: number;
  generatedAt: string;
}

export interface LiveRaceCardSdk {
  raceId: string;
  title: string;
  slug?: string;
  province?: string;
  activeCourseName?: string;
  progressPercent: number;
  runnersOnCourse: number;
  alertsCount: number;
  hasCriticalAlert: boolean;
}

export interface LiveRacesResponseSdk {
  races: LiveRaceCardSdk[];
}

export interface UpcomingRaceCardSdk {
  raceId: string;
  title: string;
  slug?: string;
  province?: string;
  startDate?: string;
  daysRemaining?: number;
  athleteCount: number;
  readinessPercent: number | null;
}

export interface UpcomingRacesResponseSdk {
  races: UpcomingRaceCardSdk[];
}

export interface PendingTaskGroupSdk {
  key: string;
  label: string;
  count: number;
  href: string;
}

export interface PendingTasksResponseSdk {
  groups: PendingTaskGroupSdk[];
  total: number;
}

export interface RecentActivityItemSdk {
  id: string;
  actor: { userId: string; displayName?: string; role?: string };
  action: string;
  entity: { type: string; id: string; displayName?: string };
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RecentActivityResponseSdk {
  items: RecentActivityItemSdk[];
}

export interface SystemServiceStatusSdk {
  key: string;
  label: string;
  status: 'ok' | 'degraded' | 'down';
  message?: string;
  lastOkAt?: string;
}

export interface SystemStatusResponseSdk {
  services: SystemServiceStatusSdk[];
  systemDown: boolean;
  checkedAt: string;
}

// ── 7 endpoint wrappers ───────────────────────────────────────────────

export function dashboardControllerGetKpi(options?: CallOptions) {
  return getJson<KpiResponseSdk>('/api/admin/dashboard/kpi', options);
}

export function dashboardControllerGetSparklines(options?: CallOptions) {
  return getJson<SparklinesResponseSdk>(
    '/api/admin/dashboard/sparklines',
    options,
  );
}

export function dashboardControllerGetLiveRaces(options?: CallOptions) {
  return getJson<LiveRacesResponseSdk>(
    '/api/admin/dashboard/live-races',
    options,
  );
}

export function dashboardControllerGetUpcomingRaces(options?: CallOptions) {
  return getJson<UpcomingRacesResponseSdk>(
    '/api/admin/dashboard/upcoming-races',
    options,
  );
}

export function dashboardControllerGetPendingTasks(options?: CallOptions) {
  return getJson<PendingTasksResponseSdk>(
    '/api/admin/dashboard/pending-tasks',
    options,
  );
}

export function dashboardControllerGetRecentActivity(options?: CallOptions) {
  return getJson<RecentActivityResponseSdk>(
    '/api/admin/dashboard/recent-activity',
    options,
  );
}

export function dashboardControllerGetSystemStatus(options?: CallOptions) {
  return getJson<SystemStatusResponseSdk>(
    '/api/admin/dashboard/system-status',
    options,
  );
}
