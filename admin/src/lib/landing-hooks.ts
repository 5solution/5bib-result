/**
 * FEATURE-083 — Race Landing TanStack Query hooks (wrap landing-api.ts).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createLanding,
  deleteLanding,
  getLanding,
  listLandings,
  publishLanding,
  reorderSections,
  unpublishLanding,
  updateLanding,
  type LandingAdmin,
  type LandingListResponse,
  type SectionInput,
  type UpdateLandingBody,
} from './landing-api';

const listKey = (params: Record<string, unknown>) =>
  ['landings', params] as const;
const oneKey = (id: string) => ['landing', id] as const;

export function useLandings(params: {
  status?: string;
  pageNo?: number;
  pageSize?: number;
  q?: string;
}) {
  return useQuery<LandingListResponse>({
    queryKey: listKey(params),
    queryFn: () => listLandings(params),
  });
}

export function useLanding(id: string | undefined) {
  return useQuery<LandingAdmin>({
    queryKey: oneKey(id ?? ''),
    queryFn: () => getLanding(id as string),
    enabled: !!id,
  });
}

export function useCreateLanding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (raceId: string) => createLanding(raceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landings'] }),
  });
}

export function useUpdateLanding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateLandingBody) => updateLanding(id, body),
    onSuccess: (data) => {
      qc.setQueryData(oneKey(id), data);
      qc.invalidateQueries({ queryKey: ['landings'] });
    },
  });
}

export function useReorderSections(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sections: SectionInput[]) => reorderSections(id, sections),
    onSuccess: (data) => qc.setQueryData(oneKey(id), data),
  });
}

export function usePublishLanding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => publishLanding(id),
    onSuccess: (data) => {
      qc.setQueryData(oneKey(id), data);
      qc.invalidateQueries({ queryKey: ['landings'] });
    },
  });
}

export function useUnpublishLanding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unpublishLanding(id),
    onSuccess: (data) => {
      qc.setQueryData(oneKey(id), data);
      qc.invalidateQueries({ queryKey: ['landings'] });
    },
  });
}

export function useDeleteLanding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLanding(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landings'] }),
  });
}
