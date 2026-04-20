'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';

interface StarAthleteInput {
  raceId: string;
  courseId: string;
  bib: string;
}

/**
 * Danh sách bib đã star trong 1 course của user hiện tại.
 * Dùng trên ranking page để mark ⭐ lên các row đã star.
 */
export function useStarredBibsByCourse(
  raceId: string | undefined,
  courseId: string | undefined,
) {
  const { isSignedIn, getToken } = useAuth();
  return useQuery({
    queryKey: ['athlete-stars', 'by-course', raceId, courseId],
    enabled: !!isSignedIn && !!raceId && !!courseId,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(
        `/api/athlete-stars/by-course?raceId=${raceId}&courseId=${courseId}`,
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
 * Toggle star cho 1 athlete — optimistic update.
 */
export function useToggleStar(raceId: string, courseId: string) {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bib,
      isStarred,
    }: {
      bib: string;
      isStarred: boolean;
    }) => {
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
      if (!res.ok) throw new Error('Star toggle failed');
      return res.json();
    },
    onMutate: async ({ bib, isStarred }) => {
      const key = ['athlete-stars', 'by-course', raceId, courseId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Set<string>>(key);
      const next = new Set(prev || []);
      if (isStarred) next.delete(bib);
      else next.add(bib);
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(
          ['athlete-stars', 'by-course', raceId, courseId],
          ctx.prev,
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: ['athlete-stars', 'by-course', raceId, courseId],
      });
      qc.invalidateQueries({ queryKey: ['athlete-stars', 'list'] });
    },
  });
}

/**
 * Danh sách tất cả athletes đã star (dùng cho Account page).
 */
export function useStarredList(pageNo = 1, pageSize = 20) {
  const { isSignedIn, getToken } = useAuth();
  return useQuery({
    queryKey: ['athlete-stars', 'list', pageNo, pageSize],
    enabled: !!isSignedIn,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(
        `/api/athlete-stars?pageNo=${pageNo}&pageSize=${pageSize}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('Fetch starred list failed');
      return res.json() as Promise<{
        data: Array<{
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
        }>;
        total: number;
        pageNo: number;
        pageSize: number;
      }>;
    },
  });
}

export type { StarAthleteInput };
