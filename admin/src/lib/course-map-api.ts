/**
 * F-006 Course Map — admin API wrapper.
 *
 * Mirrors the `timing-alert-api.ts` pattern: hand-typed thin wrappers over the
 * generated SDK so call sites stay TypeScript-strict without ad-hoc casts.
 *
 * File upload (POST /gpx) goes through the `/api/*` runtime proxy via native
 * `fetch` because hey-api `client.post({ body: FormData })` JSON-stringifies
 * the body (matches the chip-mapping import workaround).
 */
import {
  racesControllerDeleteCourseGpx,
  racesControllerGetCourseMapData,
  racesControllerUpdateCheckpointPosition,
} from './api-generated/sdk.gen';
import type {
  CourseMapDataDto,
  CourseMapUploadResultDto,
  UpdateCheckpointPositionDto,
} from './api-generated/types.gen';

export type {
  CheckpointWithPositionDto,
  CourseMapDataDto,
  CourseMapUploadResultDto,
  GpxBoundsDto,
  GpxParsedDto,
  UpdateCheckpointPositionDto,
  WaypointMatchDto,
} from './api-generated/types.gen';

export class CourseMapApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CourseMapApiError';
  }
}

function extractMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const obj = payload as { message?: unknown };
    if (typeof obj.message === 'string') return obj.message;
    if (Array.isArray(obj.message) && obj.message.length > 0 && typeof obj.message[0] === 'string') {
      return obj.message[0];
    }
  }
  return `HTTP ${status}`;
}

/**
 * Upload .gpx or .kml for a course (multipart/form-data).
 *
 * Bypasses the hey-api SDK because it serialises FormData to JSON. The
 * `/api/[...proxy]` route forwards the multipart body and Bearer auth header
 * unchanged to the backend.
 */
export async function uploadCourseGpx(
  raceId: string,
  courseId: string,
  file: File,
): Promise<CourseMapUploadResultDto> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(
    `/api/races/${encodeURIComponent(raceId)}/courses/${encodeURIComponent(courseId)}/gpx`,
    { method: 'POST', body: fd },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new CourseMapApiError(res.status, extractMessage(body, res.status));
  }
  return (await res.json()) as CourseMapUploadResultDto;
}

export async function deleteCourseGpx(raceId: string, courseId: string): Promise<void> {
  const res = await racesControllerDeleteCourseGpx({ path: { raceId, courseId } });
  if (res.error) {
    throw new CourseMapApiError(
      res.response?.status ?? 0,
      extractMessage(res.error, res.response?.status ?? 0),
    );
  }
}

export async function updateCheckpointPosition(
  raceId: string,
  courseId: string,
  body: UpdateCheckpointPositionDto,
): Promise<void> {
  const res = await racesControllerUpdateCheckpointPosition({
    path: { raceId, courseId },
    body,
  });
  if (res.error) {
    throw new CourseMapApiError(
      res.response?.status ?? 0,
      extractMessage(res.error, res.response?.status ?? 0),
    );
  }
}

export async function getCourseMapData(
  raceId: string,
  courseId: string,
): Promise<CourseMapDataDto | null> {
  const res = await racesControllerGetCourseMapData({ path: { raceId, courseId } });
  if (res.error) {
    if (res.response?.status === 404) return null;
    throw new CourseMapApiError(
      res.response?.status ?? 0,
      extractMessage(res.error, res.response?.status ?? 0),
    );
  }
  return (res.data ?? null) as CourseMapDataDto | null;
}
