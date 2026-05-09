'use client';
import { useQuery } from '@tanstack/react-query';
import { listPredictedRanks } from '../awards-api';
import { QUERY_STALE_TIME_MS } from '../awards.constant';

export function usePredictedRanks(raceId: string) {
  return useQuery({
    queryKey: ['awards', 'predicted-ranks', raceId],
    queryFn: () => listPredictedRanks(raceId),
    enabled: Boolean(raceId),
    staleTime: QUERY_STALE_TIME_MS,
  });
}
