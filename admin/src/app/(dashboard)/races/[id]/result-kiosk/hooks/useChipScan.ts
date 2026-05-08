'use client';

/**
 * F-017 — TanStack Query mutation wrapping POST /api/race-results/:raceId/by-chip.
 *
 * MongoDB-only race-day flow on the backend (Danny clarification 2026-05-08):
 *   chip_race_configs (Mongo) → chip_mappings (Mongo) → race_results (Mongo).
 *
 * Same outcome union as F-013 useResultLookup so KioskModeProvider can reuse
 * the same beep + state transitions. Adds two new error kinds specific to
 * F-017:
 *   - 'race-not-mapped'  — chip_race_configs missing → operational warning
 *   - 'chip-disabled'    — chip status === 'DISABLED' → user-facing copy
 */

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { raceResultControllerLookupByChip } from '@/lib/api-generated';
import type { AthleteDetailEnvelope } from '../kiosk.types';

export type ChipScanOutcome =
  | { kind: 'found'; bib: string; envelope: AthleteDetailEnvelope }
  | { kind: 'race-not-mapped' }
  | { kind: 'chip-not-found' }
  | { kind: 'chip-disabled'; bib: string }
  | { kind: 'athlete-not-found'; bib: string }
  | { kind: 'data-error'; raw: unknown }
  | { kind: 'network-error'; error: unknown };

interface UseChipScanArgs {
  raceId: string;
}

interface ByChipResponse {
  bib: string | null;
  data: Record<string, unknown> | null;
  success: boolean;
  message?: string;
  errorCode?: string;
}

function isByChipResponse(x: unknown): x is ByChipResponse {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.success !== 'boolean') return false;
  if (o.bib !== null && typeof o.bib !== 'string') return false;
  if (o.data !== null && (typeof o.data !== 'object' || Array.isArray(o.data))) return false;
  return true;
}

export function useChipScan({ raceId }: UseChipScanArgs) {
  const { token } = useAuth();

  return useMutation<ChipScanOutcome, never, string>({
    mutationFn: async (chipId: string): Promise<ChipScanOutcome> => {
      if (!raceId || !chipId) {
        return { kind: 'data-error', raw: null };
      }
      try {
        const { data, error, response } = await raceResultControllerLookupByChip({
          path: { raceId },
          body: { chipId },
          ...authHeaders(token ?? ''),
        });
        if (error || (response && !response.ok && response.status >= 500)) {
          return { kind: 'network-error', error: error ?? { status: response?.status } };
        }
        const json = data as unknown;
        if (!isByChipResponse(json)) {
          return { kind: 'data-error', raw: json };
        }
        if (json.success && json.bib && json.data) {
          return {
            kind: 'found',
            bib: json.bib,
            envelope: { data: json.data, success: true },
          };
        }
        switch (json.errorCode) {
          case 'race-not-mapped':
            return { kind: 'race-not-mapped' };
          case 'chip-not-found':
            return { kind: 'chip-not-found' };
          case 'chip-disabled':
            return { kind: 'chip-disabled', bib: json.bib ?? '' };
          case 'athlete-not-found':
            return { kind: 'athlete-not-found', bib: json.bib ?? '' };
          default:
            return { kind: 'data-error', raw: json };
        }
      } catch (err) {
        return { kind: 'network-error', error: err };
      }
    },
  });
}
