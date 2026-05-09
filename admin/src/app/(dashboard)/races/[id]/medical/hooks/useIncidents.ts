'use client';

/**
 * F-018 BR-MI list view query hook.
 * Wraps generated SDK call (post `pnpm generate:api`) with TanStack Query
 * + runtime guard funnel.
 */
import { useQuery } from '@tanstack/react-query';
import { authHeaders } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { medicalIncidentControllerList } from '@/lib/api-generated/sdk.gen';
import {
  IncidentListResponse,
  isIncidentListResponse,
} from '../medical.types';
import { Category, IncidentState, Severity } from '../medical.constant';

export interface IncidentsFilter {
  severity?: Severity[];
  state?: IncidentState[];
  category?: Category;
  bib?: string;
  since?: string;
  limit?: number;
  offset?: number;
}

interface UseIncidentsArgs {
  raceId: string;
  filter?: IncidentsFilter;
  /** Polling fallback in case SSE is disconnected. 30s default. */
  pollIntervalMs?: number;
}

async function fetchIncidents(
  raceId: string,
  filter: IncidentsFilter,
): Promise<IncidentListResponse> {
  const res = await medicalIncidentControllerList({
    path: { raceId },
    query: {
      severity: filter.severity?.length ? filter.severity : undefined,
      state: filter.state?.length ? filter.state : undefined,
      category: filter.category,
      bib: filter.bib,
      since: filter.since,
      limit: filter.limit,
      offset: filter.offset,
    },
  });
  if (res.error) {
    const status = res.response?.status ?? 0;
    throw new Error(`HTTP ${status}`);
  }
  if (!isIncidentListResponse(res.data)) {
    throw new Error('Malformed incident list response');
  }
  return res.data;
}

export function useIncidents({
  raceId,
  filter = {},
  pollIntervalMs = 30_000,
}: UseIncidentsArgs) {
  const { token } = useAuth();
  // authHeaders is intentionally an empty-headers helper (proxy adds auth);
  // referenced here to keep parity with other hooks for future tests.
  void authHeaders(token ?? '');

  return useQuery({
    queryKey: ['medical-incidents', raceId, filter],
    queryFn: () => fetchIncidents(raceId, filter),
    enabled: !!raceId,
    refetchInterval: pollIntervalMs,
    staleTime: 5_000,
  });
}
