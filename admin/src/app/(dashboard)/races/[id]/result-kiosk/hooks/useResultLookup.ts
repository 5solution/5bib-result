'use client';

/**
 * F-013 BR-RK-09 + BR-RK-11 — TanStack Query wrapper around the existing
 * `raceResultControllerGetAthleteDetail` SDK function with runtime guard.
 *
 * - SDK response is typed `unknown` (generated SDK trust boundary).
 * - We funnel it through `isAthleteDetailResponse` → distinguishes:
 *     - Well-formed `{ data: object, success: true }` → render result
 *     - Well-formed `{ data: null, success: false }` → BR-RK-02 not-found
 *     - Malformed payload → BR-RK-11 throw "data error" (different beep + UI)
 *
 * Lookup is enabled only when `bib.length > 0` and `raceId` provided.
 */

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { raceResultControllerGetAthleteDetail } from '@/lib/api-generated';
import {
  isAthleteDetailResponse,
  type AthleteDetailEnvelope,
} from '../kiosk.types';

export type LookupOutcome =
  | { kind: 'found'; envelope: AthleteDetailEnvelope }
  | { kind: 'not-found' }
  | { kind: 'data-error'; raw: unknown }
  | { kind: 'network-error'; error: unknown };

interface UseResultLookupArgs {
  raceId: string;
}

export function useResultLookup({ raceId }: UseResultLookupArgs) {
  const { token } = useAuth();

  return useMutation<LookupOutcome, never, string>({
    mutationFn: async (bib: string): Promise<LookupOutcome> => {
      if (!raceId || !bib) {
        return { kind: 'data-error', raw: null };
      }
      try {
        const { data, error } = await raceResultControllerGetAthleteDetail({
          path: { raceId, bib },
          ...authHeaders(token ?? ''),
        });
        if (error) {
          return { kind: 'network-error', error };
        }
        // BR-RK-11: guard `unknown` SDK response before render trust.
        if (!isAthleteDetailResponse(data)) {
          return { kind: 'data-error', raw: data };
        }
        if (data.success === false || data.data === null) {
          return { kind: 'not-found' };
        }
        return { kind: 'found', envelope: data };
      } catch (err) {
        return { kind: 'network-error', error: err };
      }
    },
  });
}
