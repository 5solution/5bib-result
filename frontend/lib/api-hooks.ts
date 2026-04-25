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
  homepageControllerGetSummary,
  homepageControllerGetEndedRaces,
  searchControllerSearch,
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

// ─── Homepage (PRD v1.1) ────────────────────────────────────────

/**
 * Homepage summary — stats + live/upcoming/ended(page 1).
 * Cached server-side (Redis 300s) + client-side (staleTime 5m) per PRD.
 */
export function useHomepageSummary() {
  return useQuery({
    queryKey: ['homepage', 'summary'],
    queryFn: async () => {
      const result = await homepageControllerGetSummary();
      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Paginated ended races — used by "Xem thêm" button.
 * `enabled` so page 1 doesn't double-fetch (summary covers it).
 */
export function useEndedRacesPage(page: number, limit = 9) {
  return useQuery({
    queryKey: ['homepage', 'ended', page, limit],
    queryFn: async () => {
      const result = await homepageControllerGetEndedRaces({
        query: { page, limit },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: page >= 2,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Global search — race name fuzzy OR exact BIB. Activates at ≥2 chars.
 * The caller is responsible for debouncing (300ms per PRD).
 */
export function useHomepageSearch(
  query: string,
  type: 'race' | 'bib' | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['homepage-search', query, type],
    queryFn: async () => {
      const result = await searchControllerSearch({
        query: { q: query, type },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: (options?.enabled ?? true) && query.trim().length >= 2,
    staleTime: 60 * 1000,
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

// ─── Stats Visualisations (F-03 / F-04 / F-06) ──────────────────
// NOTE: Pending `pnpm generate:api` — once backend swagger is regenerated,
// swap these typed-fetch hooks for generated SDK calls.

export interface TimeDistributionBucket {
  range: string;
  minSeconds: number;
  maxSeconds: number;
  count: number;
  percentage: number;
}

export interface TimeDistributionData {
  buckets: TimeDistributionBucket[];
  totalFinishers: number;
  minSeconds: number;
  maxSeconds: number;
  avgSeconds: number;
  sampled: boolean;
}

export interface CountryStatsItem {
  nationality: string;
  iso2: string;
  count: number;
  bestTime: string;
  bestSeconds: number;
}

export interface CountryStatsData {
  countries: CountryStatsItem[];
  totalCountries: number;
}

export interface CountryRankData {
  rank: number | null;
  total: number;
  nationality: string;
  iso2: string;
}

export interface PercentileData {
  percentile: number | null;
  slowerCount: number;
  totalFinishers: number;
  athleteSeconds: number;
  avgSeconds: number;
  minSeconds: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
  const payload = (await res.json()) as { data: T; success: boolean };
  return payload.data;
}

export function useTimeDistribution(
  courseId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['time-distribution', courseId],
    queryFn: () =>
      fetchJson<TimeDistributionData>(
        `/api/race-results/stats/${encodeURIComponent(courseId)}/distribution`,
      ),
    enabled: options?.enabled ?? !!courseId,
    staleTime: 2 * 60 * 1000, // 2 min (matches backend cache)
  });
}

export function useCountryStats(
  courseId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['country-stats', courseId],
    queryFn: () =>
      fetchJson<CountryStatsData>(
        `/api/race-results/stats/${encodeURIComponent(courseId)}/countries`,
      ),
    enabled: options?.enabled ?? !!courseId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCountryRank(
  raceId: string,
  bib: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['country-rank', raceId, bib],
    queryFn: () =>
      fetchJson<CountryRankData>(
        `/api/race-results/athlete/${encodeURIComponent(raceId)}/${encodeURIComponent(bib)}/country-rank`,
      ),
    enabled: options?.enabled ?? !!(raceId && bib),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePercentile(
  raceId: string,
  bib: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['percentile', raceId, bib],
    queryFn: () =>
      fetchJson<PercentileData>(
        `/api/race-results/athlete/${encodeURIComponent(raceId)}/${encodeURIComponent(bib)}/percentile`,
      ),
    enabled: options?.enabled ?? !!(raceId && bib),
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
