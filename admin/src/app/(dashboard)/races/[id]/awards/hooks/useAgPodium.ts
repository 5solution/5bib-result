'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listPodium, type ListPodiumFilter } from '../awards-api';
import { QUERY_STALE_TIME_MS } from '../awards.constant';

export const podiumQueryKey = (raceId: string, filter: ListPodiumFilter) =>
  ['awards', 'podium', raceId, filter] as const;

export function useAgPodium(raceId: string, filter: ListPodiumFilter = {}) {
  return useQuery({
    queryKey: podiumQueryKey(raceId, filter),
    queryFn: () => listPodium(raceId, filter),
    enabled: Boolean(raceId),
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useInvalidatePodium(raceId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['awards', 'podium', raceId] });
}
