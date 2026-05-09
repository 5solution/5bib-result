'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ackAnomaly,
  listAnomalies,
  resolveAnomaly,
  type ListAnomalyFilter,
} from '../awards-api';
import { QUERY_STALE_TIME_MS, type Resolution, type Tier } from '../awards.constant';

export const anomalyQueryKey = (raceId: string, filter: ListAnomalyFilter) =>
  ['awards', 'anomalies', raceId, filter] as const;

export function useAnomalyWarnings(raceId: string, filter: ListAnomalyFilter = {}) {
  return useQuery({
    queryKey: anomalyQueryKey(raceId, filter),
    queryFn: () => listAnomalies(raceId, filter),
    enabled: Boolean(raceId),
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useAckAnomaly(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { warningId: string; note: string; evidenceUrl?: string }) =>
      ackAnomaly(raceId, vars.warningId, {
        note: vars.note,
        evidenceUrl: vars.evidenceUrl,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['awards', 'anomalies', raceId] });
      qc.invalidateQueries({ queryKey: ['awards', 'podium', raceId] });
    },
  });
}

export function useResolveAnomaly(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      warningId: string;
      resolution: 'ignored' | 'fixed' | 'btc_override';
      note: string;
      evidenceUrl?: string;
      overrideTier?: Tier;
    }) =>
      resolveAnomaly(raceId, vars.warningId, {
        resolution: vars.resolution,
        note: vars.note,
        evidenceUrl: vars.evidenceUrl,
        overrideTier: vars.overrideTier,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['awards', 'anomalies', raceId] });
      qc.invalidateQueries({ queryKey: ['awards', 'podium', raceId] });
    },
  });
}

export type { ListAnomalyFilter, Resolution };
