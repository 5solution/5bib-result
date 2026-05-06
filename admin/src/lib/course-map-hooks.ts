/**
 * F-006 Course Map — TanStack Query hooks.
 *
 * (No central `api-hooks.ts` exists in admin/ — the local convention is one
 * `*-api.ts` typed wrapper + one `*-hooks.ts` per feature module. See
 * `chip-mappings/page.tsx` for inline `useQuery`/`useMutation` callers and
 * `timing-alert-api.ts` for the API wrapper pattern.)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteCourseGpx,
  getCourseMapData,
  updateCheckpointPosition,
  uploadCourseGpx,
} from './course-map-api';
import type {
  CourseMapDataDto,
  CourseMapUploadResultDto,
  UpdateCheckpointPositionDto,
} from './course-map-api';

const courseMapDataKey = (raceId: string, courseId: string): readonly unknown[] =>
  ['course-map-data', raceId, courseId] as const;

/**
 * Public/admin-shared map-data query. Used by both the admin Course dialog Map
 * tab (preview) and the public race detail page (after Phase 3 ships frontend).
 */
export function useCourseMapData(raceId: string, courseId: string | null | undefined) {
  return useQuery<CourseMapDataDto | null>({
    queryKey: courseMapDataKey(raceId, courseId ?? ''),
    queryFn: () => getCourseMapData(raceId, courseId as string),
    enabled: Boolean(raceId) && Boolean(courseId),
    staleTime: 60_000,
  });
}

export function useUploadCourseGpx(raceId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<CourseMapUploadResultDto, Error, File>({
    mutationFn: (file) => uploadCourseGpx(raceId, courseId, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['race', raceId] });
      void qc.invalidateQueries({ queryKey: courseMapDataKey(raceId, courseId) });
    },
  });
}

export function useDeleteCourseGpx(raceId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => deleteCourseGpx(raceId, courseId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['race', raceId] });
      void qc.invalidateQueries({ queryKey: courseMapDataKey(raceId, courseId) });
    },
  });
}

export function useUpdateCheckpointPosition(raceId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, UpdateCheckpointPositionDto>({
    mutationFn: (body) => updateCheckpointPosition(raceId, courseId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['race', raceId] });
      void qc.invalidateQueries({ queryKey: courseMapDataKey(raceId, courseId) });
    },
  });
}
