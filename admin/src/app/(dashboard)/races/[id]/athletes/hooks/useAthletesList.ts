'use client';

/**
 * F-014 BR-AS-06/07/08 — Athletes paginated list hook.
 *
 * Wraps `raceResultControllerGetRaceResults` (existing endpoint) with
 * TanStack Query. Server-side pagination 50/page. Filter compose +
 * URL-sync handled by `useAthleteFilters`. Status derivation runs
 * post-fetch (Option C client-derive).
 *
 * Query key hierarchy (BR-AS-10):
 *   ['athletes', raceId, { q, statuses, courseIds, gender, ag, paid, page, view }]
 *
 * Invalidation: `useAthletesBulkActions` mutations call
 * `queryClient.invalidateQueries({ queryKey: ['athletes', raceId] })`.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import { raceResultControllerGetRaceResults } from '@/lib/api-generated';
import { ATHLETES_PAGE_SIZE, type AthleteView, VIEW_STATUS_FILTER } from '../athletes.constant';
import {
  isAthletesListEnvelope,
  type AthleteFilters,
  type AthleteRow,
  type AthleteWithStatus,
} from '../athletes.types';
import { deriveAthleteStatus } from '../lib/deriveAthleteStatus';

export interface UseAthletesListArgs {
  raceId: string;
  filters: AthleteFilters;
  view: AthleteView;
  page: number;
  /** Race lifecycle hint for DNS derivation (passed from parent). */
  raceStatus?: string;
  /** Optional debounced search query — overrides filters.q. */
  debouncedQuery?: string;
}

export interface UseAthletesListResult {
  rows: AthleteWithStatus[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  /** Refetch wrapper for explicit reload after mutation. */
  refetch: () => void;
}

export function useAthletesList(args: UseAthletesListArgs): UseAthletesListResult {
  const { raceId, filters, view, page, raceStatus, debouncedQuery } = args;
  const { token } = useAuth();

  // Effective query string: prefer the debounced override, fallback to filter q.
  const q = debouncedQuery ?? filters.q;

  // Choose first courseId for endpoint param (the existing endpoint accepts a
  // single course_id). Multi-course filtering applied client-side post-fetch.
  const primaryCourseId = filters.courseIds[0];

  const queryKey = useMemo(
    () => [
      'athletes',
      raceId,
      {
        q,
        statuses: filters.statuses,
        courseIds: filters.courseIds,
        gender: filters.gender,
        ag: filters.ageGroup,
        paid: filters.paid,
        view,
        page,
      },
    ],
    [raceId, q, filters, view, page],
  );

  const enabled = Boolean(token && raceId);

  const result = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      const { data, error } = await raceResultControllerGetRaceResults({
        query: {
          raceId,
          ...(primaryCourseId ? { course_id: primaryCourseId } : {}),
          ...(q ? { search: q } : {}),
          pageNo: page,
          pageSize: ATHLETES_PAGE_SIZE,
          sortField: 'OverallRank',
          sortDirection: 'ASC',
        },
        ...authHeaders(token!),
      });
      if (error) throw new Error('Athletes fetch failed');
      // Tolerate envelope OR raw array (vendor + admin envelope variance).
      const body = data as unknown;
      if (isAthletesListEnvelope(body)) {
        return { data: body.data, total: body.total ?? body.data.length };
      }
      // Some endpoints return `{ data: [...] }` without total
      const maybe = body as { data?: AthleteRow[]; total?: number } | undefined;
      const arr = (maybe?.data ?? []) as AthleteRow[];
      return { data: arr, total: maybe?.total ?? arr.length };
    },
  });

  // Post-process: derive status + apply client-side filters (statuses, gender,
  // ageGroup, paid, view, additional courseIds beyond primary).
  const processed = useMemo<AthleteWithStatus[]>(() => {
    const raw = (result.data?.data ?? []) as AthleteRow[];
    const viewStatuses = VIEW_STATUS_FILTER[view];
    return raw
      .map<AthleteWithStatus>((row) => ({
        ...row,
        derivedStatus: deriveAthleteStatus(row, raceStatus),
      }))
      .filter((row) => {
        // Status chips filter
        if (filters.statuses.length > 0 && !filters.statuses.includes(row.derivedStatus)) {
          return false;
        }
        // View toggle filter
        if (viewStatuses && !viewStatuses.includes(row.derivedStatus)) return false;
        // Gender filter
        if (filters.gender !== 'all') {
          const g = String(row.gender ?? row.Gender ?? '').toUpperCase();
          if (!g.startsWith(filters.gender)) return false;
        }
        // Age-group filter
        if (filters.ageGroup !== 'all') {
          const ag = String(row.category ?? row.Category ?? '');
          if (ag !== filters.ageGroup) return false;
        }
        // Paid filter (best-effort — vendor field optional)
        if (filters.paid !== 'all') {
          const paidVal = row.paid;
          if (filters.paid === 'yes' && paidVal !== true) return false;
          if (filters.paid === 'no' && paidVal === true) return false;
        }
        // Additional courseIds filter (when more than 1 selected)
        if (filters.courseIds.length > 1) {
          const cid = String(row.courseId ?? row.course_id ?? '');
          if (!filters.courseIds.includes(cid)) return false;
        }
        return true;
      });
  }, [result.data, view, filters, raceStatus]);

  return {
    rows: processed,
    total: result.data?.total ?? processed.length,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: () => {
      void result.refetch();
    },
  };
}
