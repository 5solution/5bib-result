'use client';

/**
 * F-11 Watchlist / Athlete Stars — hybrid localStorage + backend sync.
 *
 * Signed-OUT:
 *   - Read/write localStorage only (no Clerk token, no API calls).
 *   - Limits enforced: 20 per race, 100 total.
 *
 * Signed-IN:
 *   - Backend MongoDB is source of truth (Clerk-gated).
 *   - On sign-in transition, localStorage entries are pushed up via
 *     POST /api/athlete-stars (idempotent). See `useWatchlistSync`.
 *   - React Query invalidation keeps "by-course" + "list" views fresh.
 *
 * Auto-refresh:
 *   - useWatchlistStatus refetches every 30s when race.status === 'live'.
 *
 * Keys:
 *   ['athlete-stars', 'by-course', raceId, courseId] → Set<string> of bibs
 *   ['athlete-stars', 'list']                        → full list (Account page)
 *   ['athlete-stars', 'status', raceId, bibs[]]      → compare-endpoint snapshot
 */

import { useEffect, useRef } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import {
  addToWatchlist,
  clearWatchlist,
  filterByCourse,
  readWatchlist,
  removeFromWatchlist,
  writeWatchlist,
  type WatchlistItem,
} from '@/lib/watchlist-storage';

interface StarAthleteInput {
  raceId: string;
  courseId: string;
  bib: string;
  /** Snapshot fields used when falling back to localStorage. */
  name?: string;
  raceName?: string;
  raceSlug?: string;
  courseName?: string;
  athleteGender?: string;
  athleteCategory?: string;
}

// ────────────────────────────────────────────────────────────────────────
// Backend-list shape (GET /api/athlete-stars)
// ────────────────────────────────────────────────────────────────────────

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

/**
 * Starred bibs for the current user inside a single course.
 * - Signed-in: calls /by-course (fast payload — just bib[]).
 * - Signed-out: reads localStorage.
 */
export function useStarredBibsByCourse(
  raceId: string | undefined,
  courseId: string | undefined,
) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  return useQuery({
    queryKey: ['athlete-stars', 'by-course', raceId, courseId, !!isSignedIn],
    enabled: isLoaded && !!raceId && !!courseId,
    queryFn: async () => {
      if (!isSignedIn) {
        return new Set<string>(
          filterByCourse(raceId!, courseId!).map((i) => i.bib),
        );
      }
      const token = await getToken();
      const res = await fetch(
        `/api/athlete-stars/by-course?raceId=${encodeURIComponent(
          raceId!,
        )}&courseId=${encodeURIComponent(courseId!)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('Fetch starred bibs failed');
      const json = await res.json();
      return new Set<string>(json.data || []);
    },
    staleTime: 30_000,
  });
}

/**
 * Full starred list — used by WatchlistPanel + Account page.
 * - Signed-in: server-side paginated list.
 * - Signed-out: whole localStorage, mapped into the same record shape.
 */
export function useStarredList(pageNo = 1, pageSize = 50) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  return useQuery({
    queryKey: ['athlete-stars', 'list', pageNo, pageSize, !!isSignedIn],
    enabled: isLoaded,
    queryFn: async () => {
      if (!isSignedIn) {
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
      const token = await getToken();
      const res = await fetch(
        `/api/athlete-stars?pageNo=${pageNo}&pageSize=${pageSize}`,
        { headers: { Authorization: `Bearer ${token}` } },
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

/**
 * "Status ticker" — look up current chipTime/rank/status for a set of starred
 * runners in a race. Refetches every 30s when race is live.
 *
 * Uses the existing compare endpoint: GET /api/race-results/compare/:raceId?bibs=
 *
 * @param raceStatus — 'live' | 'upcoming' | 'completed' | 'pre_race' | 'ended' | undefined
 */
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

export type ToggleStarError =
  | 'race-limit'
  | 'total-limit'
  | 'network';

/**
 * Toggle a star — optimistic update on the "by-course" Set cache.
 * Routes to localStorage or backend depending on sign-in state.
 *
 * Returns an error marker ('race-limit' | 'total-limit') when localStorage
 * limits are reached — UI surfaces that via toast.
 */
export function useToggleStar(raceId: string, courseId: string) {
  const { isSignedIn, getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      bib: string;
      isStarred: boolean;
      athlete?: Partial<StarAthleteInput>;
    }) => {
      const { bib, isStarred, athlete } = input;

      if (!isSignedIn) {
        // localStorage path
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

      // Backend path
      const token = await getToken();
      const method = isStarred ? 'DELETE' : 'POST';
      const res = await fetch('/api/athlete-stars', {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
      // Optimistic update on the by-course Set
      const key = [
        'athlete-stars',
        'by-course',
        raceId,
        courseId,
        !!isSignedIn,
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
// Sync: push localStorage entries to backend after user signs in
// ────────────────────────────────────────────────────────────────────────

/**
 * On every sign-in transition, push localStorage watchlist entries up to the
 * backend (idempotent POST). Runs once per session — tracked in localStorage
 * `5bib-watchlist-synced` flag.
 *
 * Call once at app root (e.g. inside AuthProvider-equivalent or layout).
 */
export function useWatchlistSync() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const qc = useQueryClient();
  const didSync = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || didSync.current) return;
    didSync.current = true;

    const items = readWatchlist();
    if (items.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        // Fire sequential; backend upserts are idempotent (unique compound
        // index on userId+raceId+courseId+bib).
        for (const it of items) {
          if (cancelled) break;
          await fetch('/api/athlete-stars', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              raceId: it.raceId,
              courseId: it.courseId,
              bib: it.bib,
            }),
          }).catch(() => {
            /* ignore per-item failure */
          });
        }
        // Clear local mirror — backend is now source of truth
        clearWatchlist();
        qc.invalidateQueries({ queryKey: ['athlete-stars'] });
      } catch {
        /* ignore — keep localStorage as-is, try again next session */
        didSync.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, qc]);
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

/**
 * Return the total watchlist count (sum across all races).
 * Signed-in: read from React Query cache if available, else trigger useStarredList.
 * Signed-out: read localStorage synchronously.
 *
 * Simpler API: use the hook `useWatchlistCount`.
 */
export function useWatchlistCount() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  return useQuery({
    queryKey: ['athlete-stars', 'count', !!isSignedIn],
    enabled: isLoaded,
    queryFn: async () => {
      if (!isSignedIn) return readWatchlist().length;
      const token = await getToken();
      const res = await fetch('/api/athlete-stars?pageNo=1&pageSize=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return 0;
      const json = await res.json();
      return (json.total as number) ?? 0;
    },
    staleTime: 15_000,
  });
}

export type { StarAthleteInput };
