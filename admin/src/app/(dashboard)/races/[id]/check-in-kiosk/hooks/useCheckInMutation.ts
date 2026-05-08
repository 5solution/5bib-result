'use client';

/**
 * F-015 BR-CK-04/05 — Atomic check-in mutation.
 *
 * Calls `POST /api/race-results/:raceId/:bib/check-in` which executes:
 *  1. Redis SETNX `checkin:lock:{raceId}:{bib}` 5s TTL (409 if held)
 *  2. MongoDB findOneAndUpdate({raceId, bib, racekit_received: false}, ...)
 *     → matchedCount=0 returns 409 with reason
 *  3. INSERT check_in_logs
 *  4. Broadcast SSE pickup event
 *  5. DEL stats cache
 *  6. Release Redis lock
 *
 * Frontend handles 3 distinct outcomes:
 *  - 200 OK → success (auto-redirect to lookup after 1.5s)
 *  - 409 Conflict → "BIB this đã được pickup tại station khác" 3s cooldown
 *  - other → network error retry button
 *
 * BR-CK-20 boundary: NO import from chip-verification SDK.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import {
  isConfirmPickupResponse,
  type ConfirmKind,
  type ConfirmPickupResponse,
  type LookupMode,
} from '../checkin.types';

interface UseCheckInMutationArgs {
  raceId: string;
  stationId: string;
}

interface CheckInVariables {
  bib: string;
  athleteId: string | number;
  source: LookupMode;
}

export function useCheckInMutation({ raceId, stationId }: UseCheckInMutationArgs) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<ConfirmKind, never, CheckInVariables>({
    mutationFn: async ({ bib, athleteId, source }): Promise<ConfirmKind> => {
      if (!raceId || !bib) {
        return { kind: 'network-error' };
      }
      try {
        const res = await fetch(
          `/api/race-results/${encodeURIComponent(raceId)}/${encodeURIComponent(bib)}/check-in`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ stationId, source, athleteId }),
          },
        );
        if (res.status === 409) {
          // BR-CK-05: another station beat us. Return conflict — UI shows cooldown banner.
          return { kind: 'conflict' };
        }
        if (!res.ok) {
          return { kind: 'network-error' };
        }
        const data = (await res.json().catch(() => null)) as unknown;
        if (!isConfirmPickupResponse(data)) {
          return { kind: 'network-error' };
        }
        const env = data as ConfirmPickupResponse;
        if (env.success && env.data) {
          // Stats cache invalidates on backend (DEL); also invalidate client query cache.
          queryClient.invalidateQueries({ queryKey: ['checkin-stats', raceId] });
          return { kind: 'success', result: env.data };
        }
        return { kind: 'network-error' };
      } catch {
        return { kind: 'network-error' };
      }
    },
  });
}

export type { CheckInVariables };
