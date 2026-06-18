/**
 * FEATURE-089 — Short link TanStack Query hooks (wrap short-links-api.ts).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createShortLink,
  deleteShortLink,
  listShortLinks,
  updateShortLink,
  type CreateShortLinkBody,
  type ShortLinkListResponse,
  type UpdateShortLinkBody,
} from './short-links-api';

const listKey = (params: Record<string, unknown>) =>
  ['short-links', params] as const;

export function useShortLinks(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery<ShortLinkListResponse>({
    queryKey: listKey(params),
    queryFn: () => listShortLinks(params),
  });
}

export function useCreateShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateShortLinkBody) => createShortLink(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['short-links'] }),
  });
}

export function useUpdateShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; body: UpdateShortLinkBody }) =>
      updateShortLink(args.id, args.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['short-links'] }),
  });
}

export function useDeleteShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShortLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['short-links'] }),
  });
}
