'use client';

/**
 * F-11 Watchlist / Athlete Stars — hybrid localStorage + backend sync.
 *
 * Signed-OUT:
 *   Read/write localStorage only (no access token needed).
 *   Limits enforced: 20 per race, 100 total.
 *
 * Signed-IN (Logto session present):
 *   Backend MongoDB is source of truth. API calls go through `/api/...`
 *   proxy which injects the Logto access token server-side — clients
 *   don't touch tokens directly.
 *   On sign-in transition, localStorage entries are pushed up via
 *   useWatchlistSync() (idempotent POST).
 *
 * Auto-refresh:
 *   useWatchlistStatus refetches every 30s when race.status === 'live'.
 */

import { useEffect, useRef } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  addToWatchlist,
  clearWatchlist,
  filterByCourse,
  readWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from '@/lib/watchlist-storage';
import { useUser } from './use-user';

interface StarAthleteInput {
  raceId: string;
  courseId: string;
  bib: string;
  name?: string;
  raceName?: string;
  raceSlug?: string;
  courseName?: string;
  athleteGender?: string;
  athleteCategory?: string;
}

export interface AthleteStarRecord {
  _id: string;
  raceId: string;
  courseId: string;
  bib: string;
  athleteName: string;
  athleteGender: string;
  athleteCategory: string;
  raceName: string;
  raceSlug: string;
  courseName: string;
  starred_at: string;
}

// ────────────────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────────────────

export function useStarredBibsByCourse(
  raceId: string | undefined,
  courseId: string | undefined,
) {
  const { isAuthenticated, isLoading } = useUser();
  return useQuery({
    queryKey: ['athlete-stars', 'by-course', raceId, courseId, isAuthenticated],
    enabled: !isLoading && !!raceId && !!courseId,
    queryFn: async () => {
      if (!isAuthenticated) {
        return new Set<string>(
          filterByCourse(raceId!, courseId!).map((i) => i.bib),
        );
      }
      const res = await fetch(
        `/api/athlete-stars/by-course?raceId=${encodeURIComponent(
          raceId!,
        )}&courseId=${encodeURIComponent(courseId!)}`,
      );
      if (!res.ok) throw new Error('Fetch starred bibs failed');
      const json = await res.json();
      return new Set<string>(json.data || []);
    },
    staleTime: 30_000,
  });
}

export function useStarredList(pageNo = 1, pageSize = 50) {
  const { isAuthenticated, isLoading } = useUser();
  return useQuery({
    queryKey: ['athlete-stars', 'list', pageNo, pageSize, isAuthenticated],
    enabled: !isLoading,
    queryFn: async () => {
      if (!isAuthenticated) {
        const items = readWatchlist();
        const start = (pageNo - 1) * pageSize;
        const page = items.slice(start, start + pageSize);
        return {
          data: page.map(localToRecord),
          total: items.length,
          pageNo,
          pageSize,
        };
      }
      const res = await fetch(
        `/api/athlete-stars?pageNo=${pageNo}&pageSize=${pageSize}`,
      );
      if (!res.ok) throw new Error('Fetch starred list failed');
      return res.json() as Promise<{
        data: AthleteStarRecord[];
        total: number;
        pageNo: number;
        pageSize: number;
      }>;
    },
  });
}

export function useWatchlistStatus(
  raceId: string | undefined,
  bibs: string[],
  raceStatus?: string,
) {
  const live = raceStatus === 'live';
  return useQuery({
    queryKey: ['athlete-stars', 'status', raceId, [...bibs].sort().join(',')],
    enabled: !!raceId && bibs.length > 0,
    refetchInterval: live ? 30_000 : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const res = await fetch(
        `/api/race-results/compare/${encodeURIComponent(
          raceId!,
        )}?bibs=${bibs.map(encodeURIComponent).join(',')}`,
      );
      if (!res.ok) throw new Error('Fetch watchlist status failed');
      return res.json();
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────────────────────────────────

export type ToggleStarError = 'race-limit' | 'total-limit' | 'network';

export function useToggleStar(raceId: string, courseId: string) {
  const { isAuthenticated } = useUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      bib: string;
      isStarred: boolean;
      athlete?: Partial<StarAthleteInput>;
    }) => {
      const { bib, isStarred, athlete } = input;

      if (!isAuthenticated) {
        if (isStarred) {
          removeFromWatchlist(raceId, bib);
          return { source: 'local' as const };
        }
        const res = addToWatchlist({
          raceId,
          courseId,
          bib,
          name: athlete?.name,
          raceName: athlete?.raceName,
          raceSlug: athlete?.raceSlug,
          courseName: athlete?.courseName,
          athleteGender: athlete?.athleteGender,
          athleteCategory: athlete?.athleteCategory,
          addedAt: Date.now(),
        });
        if (!res.ok) {
          const err = new Error(res.reason) as Error & {
            code: ToggleStarError;
          };
          err.code = res.reason;
          throw err;
        }
        return { source: 'local' as const };
      }

      const method = isStarred ? 'DELETE' : 'POST';
      const res = await fetch('/api/athlete-stars', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId, courseId, bib }),
      });
      if (!res.ok) {
        const err = new Error('network') as Error & { code: ToggleStarError };
        err.code = 'network';
        throw err;
      }
      return res.json();
    },
    onMutate: async ({ bib, isStarred }) => {
      const key = [
        'athlete-stars',
        'by-course',
        raceId,
        courseId,
        isAuthenticated,
      ];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Set<string>>(key);
      const next = new Set(prev || []);
      if (isStarred) next.delete(bib);
      else next.add(bib);
      qc.setQueryData(key, next);
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && ctx?.key) {
        qc.setQueryData(ctx.key, ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['athlete-stars'] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Sync localStorage → backend after sign-in
// ────────────────────────────────────────────────────────────────────────

export function useWatchlistSync() {
  const { isAuthenticated, isLoading } = useUser();
  const qc = useQueryClient();
  const didSync = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || didSync.current) return;
    didSync.current = true;

    const items = readWatchlist();
    if (items.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        for (const it of items) {
          if (cancelled) break;
          await fetch('/api/athlete-stars', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              raceId: it.raceId,
              courseId: it.courseId,
              bib: it.bib,
            }),
          }).catch(() => {
            /* ignore per-item failure */
          });
        }
        clearWatchlist();
        qc.invalidateQueries({ queryKey: ['athlete-stars'] });
      } catch {
        didSync.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, qc]);
}

// ────────────────────────────────────────────────────────────────────────
// Count
// ────────────────────────────────────────────────────────────────────────

export function useWatchlistCount() {
  const { isAuthenticated, isLoading } = useUser();
  return useQuery({
    queryKey: ['athlete-stars', 'count', isAuthenticated],
    enabled: !isLoading,
    queryFn: async () => {
      if (!isAuthenticated) return readWatchlist().length;
      const res = await fetch('/api/athlete-stars?pageNo=1&pageSize=1');
      if (!res.ok) return 0;
      const json = await res.json();
      return (json.total as number) ?? 0;
    },
    staleTime: 15_000,
  });
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function localToRecord(item: WatchlistItem): AthleteStarRecord {
  return {
    _id: `local:${item.raceId}:${item.bib}`,
    raceId: item.raceId,
    courseId: item.courseId,
    bib: item.bib,
    athleteName: item.name || '',
    athleteGender: item.athleteGender || '',
    athleteCategory: item.athleteCategory || '',
    raceName: item.raceName || '',
    raceSlug: item.raceSlug || '',
    courseName: item.courseName || '',
    starred_at: new Date(item.addedAt).toISOString(),
  };
}

export type { StarAthleteInput };
