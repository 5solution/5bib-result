import { useQuery, useMutation } from '@tanstack/react-query';

// Initialize client config (side-effect import)
import './api';

import {
  racesControllerSearchRaces,
  racesControllerGetRaceBySlug,
  raceResultControllerGetRaceResults,
  raceResultControllerGetAthleteDetail,
  raceResultControllerCompareAthletes,
  raceResultControllerGetFilterOptions,
  raceResultControllerGetCourseStats,
  raceResultControllerGetLeaderboard,
  raceResultControllerGlobalSearch,
  raceResultControllerSubmitClaim,
  raceResultControllerUploadClaimAttachment,
  sponsorsControllerFindAllActive,
  sponsorsControllerFindByRaceId,
} from './api-generated';

import type {
  CourseCheckpointDto,
  SubmitClaimDto,
} from './api-generated';

// ─── Re-export types for consumers ─────────────────────────────
export type { CourseCheckpointDto as CourseCheckpoint } from './api-generated';

// ─── Races ──────────────────────────────────────────────────────

export function useRaces(params?: {
  title?: string;
  status?: string;
  province?: string;
  season?: string;
  race_type?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['races', params],
    queryFn: async () => {
      const result = await racesControllerSearchRaces({
        query: params,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 60 * 1000, // 1 min — race list rarely changes mid-session
  });
}

export function useRaceBySlug(slug: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['race', 'slug', slug],
    queryFn: async () => {
      const result = await racesControllerGetRaceBySlug({
        path: { slug },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: options?.enabled ?? !!slug,
    staleTime: 5 * 60 * 1000, // 5 min — race metadata is stable
  });
}

// ─── Race Results ───────────────────────────────────────────────

export function useRaceResults(params: {
  raceId?: string;
  course_id?: string;
  name?: string;
  gender?: string;
  category?: string;
  pageNo?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'ASC' | 'DESC';
  type?: 'finisher' | 'dnf' | 'dns' | 'dsq';
  nationality?: string;
}, options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['race-results', params],
    queryFn: async () => {
      const result = await raceResultControllerGetRaceResults({
        query: { ...params, raceId: params.raceId ?? '' } as Parameters<typeof raceResultControllerGetRaceResults>[0]['query'],
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: options?.enabled ?? (!!params.course_id && !!params.raceId),
    refetchInterval: options?.refetchInterval,
    // Only cache when not polling (live race) — otherwise let refetchInterval drive freshness
    staleTime: options?.refetchInterval ? 0 : 60 * 1000,
  });
}

export function useAthleteDetail(raceId: string, bib: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['athlete', raceId, bib],
    queryFn: async () => {
      const result = await raceResultControllerGetAthleteDetail({
        path: { raceId, bib },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: options?.enabled ?? (!!raceId && !!bib),
    staleTime: 5 * 60 * 1000, // 5 min — athlete detail is stable
  });
}

export function useCompareAthletes(raceId: string, bibs: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['compare', raceId, bibs],
    queryFn: async () => {
      const result = await raceResultControllerCompareAthletes({
        path: { raceId },
        query: { bibs },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: options?.enabled ?? (!!raceId && !!bibs),
  });
}

export function useFilterOptions(courseId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['filters', courseId],
    queryFn: async () => {
      const result = await raceResultControllerGetFilterOptions({
        path: { courseId },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: options?.enabled ?? !!courseId,
    staleTime: 10 * 60 * 1000, // 10 min — filter options are very stable
  });
}

export function useCourseStats(courseId: string, options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['course-stats', courseId],
    queryFn: async () => {
      const result = await raceResultControllerGetCourseStats({
        path: { courseId },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: options?.enabled ?? !!courseId,
    refetchInterval: options?.refetchInterval,
    staleTime: options?.refetchInterval ? 0 : 60 * 1000,
  });
}

export function useLeaderboard(courseId: string, limit?: number) {
  return useQuery({
    queryKey: ['leaderboard', courseId, limit],
    queryFn: async () => {
      const result = await raceResultControllerGetLeaderboard({
        path: { courseId },
        query: { limit },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!courseId,
    staleTime: 30 * 1000, // 30s — leaderboard can change for live races
  });
}

export function useGlobalSearch(q: string, limit?: number) {
  return useQuery({
    queryKey: ['search', q, limit],
    queryFn: async () => {
      const result = await raceResultControllerGlobalSearch({
        query: { q, limit },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: q.length >= 2,
  });
}

// ─── Sponsors ───────────────────────────────────────────────────

export function useSponsors() {
  return useQuery({
    queryKey: ['sponsors'],
    queryFn: async () => {
      const result = await sponsorsControllerFindAllActive();
      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRaceSponsors(raceId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['sponsors', 'race', raceId],
    queryFn: async () => {
      const result = await sponsorsControllerFindByRaceId({
        path: { raceId },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: options?.enabled ?? !!raceId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────

export function useSubmitClaim() {
  return useMutation({
    mutationFn: async (body: SubmitClaimDto) => {
      const result = await raceResultControllerSubmitClaim({ body });
      if (result.error) throw result.error;
      return result.data;
    },
  });
}

export function useUploadClaimAttachment() {
  return useMutation({
    mutationFn: async (file: File) => {
      const result = await raceResultControllerUploadClaimAttachment({
        body: { file },
      });
      if (result.error) throw result.error;
      return result.data as unknown as { url: string };
    },
  });
}
