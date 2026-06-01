/**
 * F-068 Course Data Ops — admin API wrapper.
 *
 * Mirrors `course-map-api.ts` pattern: hand-typed thin wrappers + named
 * `*ApiError` class. Uses runtime `/api/*` proxy (no SDK regen needed yet —
 * `pnpm --filter admin generate:api` to be run in QC phase against backend
 * running on localhost:8081).
 *
 * Endpoints (all under admin scope — class-level LogtoAdminGuard):
 *  - GET    /api/admin/races/:raceId/courses/:courseId/data-stats
 *  - POST   /api/admin/races/:raceId/courses/:courseId/reset-data (EXTEND response)
 *  - PATCH  /api/admin/races/:raceId/courses/:courseId/clear-api-url
 *  - POST   /api/admin/races/:raceId/courses/:courseId/disable-and-reset
 */

export interface CourseDataStatsDto {
  rowCount: number;
  lastSyncedAt: string | null;
  lastSyncStatus: 'success' | 'failed' | null;
  lastSyncDurationMs: number | null;
  hasApiUrl: boolean;
  apiUrlMasked: string | null;
  nextCronAt: string | null;
  cronStatus: 'scheduled' | 'in_progress' | 'disabled';
}

export interface ResetDataDto {
  confirmedLive?: boolean;
}

export interface ResetDataResultDto {
  message: string;
  deletedCount: number;
  success: boolean;
  nextCronAt: string | null;
  hasApiUrl: boolean;
  durationMs: number;
}

export interface ClearApiUrlDto {
  confirmedLive?: boolean;
}

export interface ClearApiUrlResultDto {
  message: string;
  success: boolean;
  prevApiUrlMasked: string | null;
}

export interface DisableAndResetDto {
  confirmedLive?: boolean;
}

export interface DisableAndResetResultDto {
  message: string;
  deletedCount: number;
  success: boolean;
  prevApiUrlMasked: string | null;
  durationMs: number;
  hasApiUrl: boolean;
  nextCronAt: string | null;
}

export class CourseDataOpsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'CourseDataOpsApiError';
  }
}

async function parseError(response: Response): Promise<CourseDataOpsApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    /* ignore — non-JSON error body */
  }
  let message = `HTTP ${response.status}`;
  let code: string | null = null;
  if (payload && typeof payload === 'object') {
    const obj = payload as { message?: unknown; code?: unknown };
    if (typeof obj.message === 'string') message = obj.message;
    if (typeof obj.code === 'string') code = obj.code;
  }
  return new CourseDataOpsApiError(response.status, code, message);
}

function buildBase(raceId: string, courseId: string): string {
  return `/api/admin/races/${encodeURIComponent(raceId)}/courses/${encodeURIComponent(courseId)}`;
}

export async function fetchCourseDataStats(
  raceId: string,
  courseId: string,
): Promise<CourseDataStatsDto> {
  const response = await fetch(`${buildBase(raceId, courseId)}/data-stats`, {
    credentials: 'include',
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as CourseDataStatsDto;
}

export async function resetCourseData(
  raceId: string,
  courseId: string,
  body: ResetDataDto = {},
): Promise<ResetDataResultDto> {
  const response = await fetch(`${buildBase(raceId, courseId)}/reset-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ResetDataResultDto;
}

export async function clearCourseApiUrl(
  raceId: string,
  courseId: string,
  body: ClearApiUrlDto = {},
): Promise<ClearApiUrlResultDto> {
  const response = await fetch(`${buildBase(raceId, courseId)}/clear-api-url`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ClearApiUrlResultDto;
}

export async function disableAndResetCourse(
  raceId: string,
  courseId: string,
  body: DisableAndResetDto = {},
): Promise<DisableAndResetResultDto> {
  const response = await fetch(
    `${buildBase(raceId, courseId)}/disable-and-reset`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as DisableAndResetResultDto;
}
