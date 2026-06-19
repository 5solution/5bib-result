/**
 * FEATURE-091 — Border Pass email TanStack Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteConfig,
  getConfig,
  getStats,
  listConfigs,
  listConfirmed,
  listFonts,
  listRaceOptions,
  resendOne,
  sendBatch,
  testSend,
  upsertConfig,
  type BibPassConfig,
  type UpsertBibPassConfig,
} from './bib-pass-api';

export function useBibPassConfigs() {
  return useQuery({ queryKey: ['bib-pass-configs'], queryFn: listConfigs });
}

export function useBibPassRaceOptions() {
  return useQuery({ queryKey: ['bib-pass-races'], queryFn: listRaceOptions });
}

export function useBibPassFonts() {
  return useQuery({ queryKey: ['bib-pass-fonts'], queryFn: listFonts, staleTime: Infinity });
}

export function useBibPassConfig(raceId: number | undefined) {
  return useQuery({
    queryKey: ['bib-pass-config', raceId],
    queryFn: () => getConfig(raceId as number),
    enabled: !!raceId,
    retry: false,
  });
}

export function useBibPassStats(raceId: number | undefined) {
  return useQuery({
    queryKey: ['bib-pass-stats', raceId],
    queryFn: () => getStats(raceId as number),
    enabled: !!raceId,
  });
}

export function useConfirmedAthletes(
  raceId: number | undefined,
  opts: { q?: string; page?: number; pageSize?: number },
) {
  return useQuery({
    queryKey: ['bib-pass-confirmed', raceId, opts.q ?? '', opts.page ?? 1, opts.pageSize ?? 20],
    queryFn: () => listConfirmed(raceId as number, opts),
    enabled: !!raceId,
  });
}

export function useUpsertBibPassConfig(raceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertBibPassConfig) => upsertConfig(raceId, body),
    onSuccess: (data: BibPassConfig) => {
      qc.setQueryData(['bib-pass-config', raceId], data);
      qc.invalidateQueries({ queryKey: ['bib-pass-configs'] });
      qc.invalidateQueries({ queryKey: ['bib-pass-races'] });
    },
  });
}

export function useDeleteBibPassConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (raceId: number) => deleteConfig(raceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bib-pass-configs'] });
      qc.invalidateQueries({ queryKey: ['bib-pass-races'] });
    },
  });
}

export function useTestSend(raceId: number) {
  return useMutation({
    mutationFn: (body: { toEmail: string; athletesId?: number }) => testSend(raceId, body),
  });
}

export function useSendBatch(raceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sendBatch(raceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bib-pass-stats', raceId] });
      qc.invalidateQueries({ queryKey: ['bib-pass-confirmed', raceId] });
      qc.invalidateQueries({ queryKey: ['bib-pass-configs'] });
    },
  });
}

export function useResendOne(raceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athletesId: number) => resendOne(raceId, athletesId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bib-pass-stats', raceId] });
      qc.invalidateQueries({ queryKey: ['bib-pass-confirmed', raceId] });
    },
  });
}
