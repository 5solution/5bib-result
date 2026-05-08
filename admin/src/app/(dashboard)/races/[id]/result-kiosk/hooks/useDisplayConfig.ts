'use client';

/**
 * F-017 — TanStack Query GET/PUT for the display config doc.
 *
 * Lazy-create on first GET (backend handles). PUT mutates partial fields and
 * invalidates the cache so the next read returns the merged shape.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import {
  resultKioskDisplayControllerGetConfig,
  resultKioskDisplayControllerUpdateConfig,
  resultKioskDisplayControllerApplyPreset,
} from '@/lib/api-generated';
import {
  type DisplayConfig,
  type DisplayPreset,
  resolveDisplayConfig,
} from '@/lib/kiosk/result-display-config';

const QK = (raceId: string) => ['result-kiosk-display', raceId] as const;

export function useDisplayConfig(raceId: string) {
  const { token } = useAuth();

  return useQuery<DisplayConfig>({
    queryKey: QK(raceId),
    enabled: !!raceId && !!token,
    queryFn: async () => {
      const { data, error, response } = await resultKioskDisplayControllerGetConfig({
        path: { mongoRaceId: raceId },
        ...authHeaders(token ?? ''),
      });
      if (error) throw new Error(`GET display config ${response?.status ?? 'error'}`);
      const json = (data ?? {}) as { data?: unknown };
      return resolveDisplayConfig(raceId, json?.data);
    },
    staleTime: 30_000,
  });
}

export function useUpdateDisplayConfig(raceId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<DisplayConfig, Error, Partial<DisplayConfig>>({
    mutationFn: async (patch) => {
      const { data, error, response } = await resultKioskDisplayControllerUpdateConfig({
        path: { mongoRaceId: raceId },
        body: patch as Parameters<typeof resultKioskDisplayControllerUpdateConfig>[0]['body'],
        ...authHeaders(token ?? ''),
      });
      if (error) throw new Error(`PUT display config ${response?.status ?? 'error'}`);
      const json = (data ?? {}) as { data?: unknown };
      return resolveDisplayConfig(raceId, json?.data);
    },
    onSuccess: (next) => {
      qc.setQueryData(QK(raceId), next);
    },
  });
}

export function useApplyPreset(raceId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<DisplayConfig, Error, DisplayPreset>({
    mutationFn: async (preset) => {
      if (preset === 'CUSTOM') {
        throw new Error('Cannot apply CUSTOM preset — use update instead');
      }
      const { data, error, response } = await resultKioskDisplayControllerApplyPreset({
        path: { mongoRaceId: raceId, preset },
        ...authHeaders(token ?? ''),
      });
      if (error) throw new Error(`PATCH preset ${response?.status ?? 'error'}`);
      const json = (data ?? {}) as { data?: unknown };
      return resolveDisplayConfig(raceId, json?.data);
    },
    onSuccess: (next) => {
      qc.setQueryData(QK(raceId), next);
    },
  });
}
