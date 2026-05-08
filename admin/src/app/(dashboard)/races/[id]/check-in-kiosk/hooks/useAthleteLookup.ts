'use client';

/**
 * F-015 BR-CK-01/02/10/18 — Athlete lookup TanStack Query mutation.
 *
 * Wraps 3 backend endpoints (POST lookup-by-bib | lookup-by-cmnd | lookup-by-qr)
 * with the shared runtime guard `isAthleteCheckInResponse`. SDK function names
 * resolve only after `pnpm --filter admin generate:api` runs against
 * F-015 backend DTO additions; until then we hand-call via fetch using the
 * existing `/api/[...proxy]` runtime proxy (BR-AF Pre-deploy pattern).
 *
 * Returns a discriminated `ResultKind` union so the consumer can switch
 * exhaustively (found / multi-candidate / not-found / data-error / network-error).
 *
 * BR-CK-20 module boundary: this hook MUST NOT import from
 * `@/lib/chip-verification-api` — convergence is at MongoDB only.
 */

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import {
  isAthleteCheckInResponse,
  type AthleteCheckInPayload,
  type LookupMode,
  type ResultKind,
} from '../checkin.types';
import { CHECKIN_CONFIG } from '../checkin.constant';

interface UseAthleteLookupArgs {
  raceId: string;
}

interface LookupVariables {
  mode: LookupMode;
  /** BIB string for `bib`; CMND last-4 for `cmnd`; QR scanned payload for `qr`. */
  query: string;
}

const MODE_TO_PATH: Record<LookupMode, string> = {
  bib: 'lookup-by-bib',
  cmnd: 'lookup-by-cmnd',
  qr: 'lookup-by-qr',
};

export function useAthleteLookup({ raceId }: UseAthleteLookupArgs) {
  const { token } = useAuth();
  return useMutation<ResultKind, never, LookupVariables>({
    mutationFn: async ({ mode, query }): Promise<ResultKind> => {
      if (!raceId || !query) {
        return { kind: 'data-error', raw: null };
      }
      // BR-CK-10 — CMND PII boundary: input is last-4 only, never full CMND.
      // We never log this value (no console.log/Logger here).
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CHECKIN_CONFIG.LOOKUP_TIMEOUT_MS);
        const path = MODE_TO_PATH[mode];
        const res = await fetch(`/api/race-results/${encodeURIComponent(raceId)}/${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ value: query }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok && res.status !== 404) {
          return { kind: 'network-error', error: { status: res.status } };
        }
        const data = (await res.json().catch(() => null)) as unknown;
        if (!isAthleteCheckInResponse(data)) {
          return { kind: 'data-error', raw: data };
        }
        if (data.success === false || data.data === null) {
          return { kind: 'not-found', query };
        }
        if (Array.isArray(data.data)) {
          if (data.data.length === 0) {
            return { kind: 'not-found', query };
          }
          if (data.data.length === 1) {
            return { kind: 'found', payload: data.data[0] as AthleteCheckInPayload };
          }
          return { kind: 'multi-candidate', payloads: data.data as AthleteCheckInPayload[] };
        }
        return { kind: 'found', payload: data.data as AthleteCheckInPayload };
      } catch (err) {
        return { kind: 'network-error', error: err };
      }
    },
  });
}

export type { LookupVariables };
