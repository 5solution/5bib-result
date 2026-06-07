/**
 * F-068 Course Data Ops — TanStack Query hooks.
 *
 * Polling: `useCourseDataStats` is `refetchInterval: 5000` (BR-68-16) and the
 * default TanStack Query `refetchIntervalInBackground: false` pauses while the
 * tab is blurred (Danny chốt #5 OK).
 *
 * Mutation invalidation: every mutation hits the matching `course-data-stats`
 * key immediately so the row badge re-fetches on success.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  clearCourseApiUrl,
  disableAndResetCourse,
  fetchCourseDataStats,
  resetCourseData,
  type ClearApiUrlDto,
  type ClearApiUrlResultDto,
  type CourseDataStatsDto,
  type DisableAndResetDto,
  type DisableAndResetResultDto,
  type ResetDataDto,
  type ResetDataResultDto,
} from './course-data-ops-api';

const courseDataStatsKey = (
  raceId: string,
  courseId: string,
): readonly unknown[] => ['course-data-stats', raceId, courseId] as const;

export interface UseCourseDataStatsOptions {
  /** Override 5s polling interval (BR-68-16). Pass 0 to disable polling. */
  refetchIntervalMs?: number;
  /** Disable the hook entirely when raceId/courseId not yet available. */
  enabled?: boolean;
}

export function useCourseDataStats(
  raceId: string,
  courseId: string,
  options: UseCourseDataStatsOptions = {},
) {
  const { refetchIntervalMs = 5000, enabled = true } = options;
  return useQuery<CourseDataStatsDto>({
    queryKey: courseDataStatsKey(raceId, courseId),
    queryFn: () => fetchCourseDataStats(raceId, courseId),
    enabled: enabled && Boolean(raceId) && Boolean(courseId),
    staleTime: 0,
    refetchInterval: refetchIntervalMs > 0 ? refetchIntervalMs : false,
    refetchIntervalInBackground: false,
  });
}

export function useResetCourseData(raceId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<ResetDataResultDto, Error, ResetDataDto>({
    mutationFn: (body) => resetCourseData(raceId, courseId, body),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: courseDataStatsKey(raceId, courseId),
      });
    },
  });
}

export function useClearCourseApiUrl(raceId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<ClearApiUrlResultDto, Error, ClearApiUrlDto>({
    mutationFn: (body) => clearCourseApiUrl(raceId, courseId, body),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: courseDataStatsKey(raceId, courseId),
      });
    },
  });
}

export function useDisableAndResetCourse(raceId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<DisableAndResetResultDto, Error, DisableAndResetDto>({
    mutationFn: (body) => disableAndResetCourse(raceId, courseId, body),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: courseDataStatsKey(raceId, courseId),
      });
    },
  });
}
