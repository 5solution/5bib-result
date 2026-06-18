/**
 * FEATURE-090 — Crew Certificate TanStack Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBatch,
  deleteBatch,
  getBatch,
  listBatches,
  listRecipients,
  rosterConfirm,
  updateBatch,
  type CrewBatch,
  type CrewRecipientRow,
  type CrewTemplate,
} from './crew-cert-api';

export function useCrewBatches() {
  return useQuery({ queryKey: ['crew-batches'], queryFn: listBatches });
}

export function useCrewBatch(id: string | undefined) {
  return useQuery({
    queryKey: ['crew-batch', id],
    queryFn: () => getBatch(id as string),
    enabled: !!id,
  });
}

export function useRecipients(id: string | undefined) {
  return useQuery({
    queryKey: ['crew-recipients', id],
    queryFn: () => listRecipients(id as string),
    enabled: !!id,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { eventName: string; slug: string }) => createBatch(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crew-batches'] }),
  });
}

export function useUpdateBatch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      body: Partial<{ eventName: string; slug: string; active: boolean; extraFields: string[]; template: CrewTemplate }>,
    ) => updateBatch(id, body),
    onSuccess: (data: CrewBatch) => {
      qc.setQueryData(['crew-batch', id], data);
      qc.invalidateQueries({ queryKey: ['crew-batches'] });
    },
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBatch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crew-batches'] }),
  });
}

export function useConfirmRoster(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: CrewRecipientRow[]) => rosterConfirm(id, rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crew-recipients', id] });
      qc.invalidateQueries({ queryKey: ['crew-batch', id] });
    },
  });
}
