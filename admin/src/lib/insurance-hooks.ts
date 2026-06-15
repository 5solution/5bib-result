/**
 * FEATURE-085 — Igloo Insurance TanStack Query hooks (wrap insurance-api.ts).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createIglooRequests,
  getIglooConfig,
  listEligibleAthletes,
  listIglooRaces,
  listIglooRequests,
  retryIglooRequest,
  type CreateRequestsResult,
  type EligibleAthleteList,
  type IglooConfig,
  type IglooRace,
  type IglooRequest,
  type IglooRequestList,
} from "./insurance-api";

export function useIglooConfig() {
  return useQuery<IglooConfig>({
    queryKey: ["igloo", "config"],
    queryFn: getIglooConfig,
  });
}

export function useIglooRaces() {
  return useQuery<IglooRace[]>({
    queryKey: ["igloo", "races"],
    queryFn: listIglooRaces,
  });
}

export function useEligibleAthletes(params: {
  raceId?: number;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery<EligibleAthleteList>({
    queryKey: ["igloo", "eligible", params],
    queryFn: () =>
      listEligibleAthletes({
        raceId: params.raceId as number,
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
      }),
    enabled: !!params.raceId,
  });
}

export function useCreateIglooRequests() {
  const qc = useQueryClient();
  return useMutation<
    CreateRequestsResult,
    Error,
    { raceId: number; athleteIds: number[] }
  >({
    mutationFn: (body) => createIglooRequests(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["igloo", "requests"] });
      qc.invalidateQueries({ queryKey: ["igloo", "eligible"] });
    },
  });
}

export function useIglooRequests(params: {
  status?: string;
  raceId?: number;
  page?: number;
  pageSize?: number;
}) {
  return useQuery<IglooRequestList>({
    queryKey: ["igloo", "requests", params],
    queryFn: () => listIglooRequests(params),
  });
}

export function useRetryIglooRequest() {
  const qc = useQueryClient();
  return useMutation<IglooRequest, Error, string>({
    mutationFn: (id) => retryIglooRequest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["igloo", "requests"] }),
  });
}
