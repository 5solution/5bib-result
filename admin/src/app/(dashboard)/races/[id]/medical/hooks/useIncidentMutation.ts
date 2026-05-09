'use client';

/**
 * F-018 — incident create + state transition mutations.
 * Falls back to IndexedDB offline queue when navigator.onLine === false OR
 * server returns 5xx (BR-MI-33).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  medicalIncidentControllerCreate,
  medicalIncidentControllerTransitionStatus,
} from '@/lib/api-generated/sdk.gen';
import type {
  CreateIncidentDto,
  UpdateIncidentStatusDto,
} from '@/lib/api-generated/types.gen';
import { isIncidentResponse } from '../medical.types';
import { Category, IncidentState, Severity, TraumaSubtype } from '../medical.constant';
import type { GpsLocation, IncidentResponse } from '../medical.types';
import { enqueueOffline } from './useOfflineQueue';

export interface CreateIncidentPayload {
  severity: Severity;
  category: Category;
  traumaSubtype?: TraumaSubtype;
  bib?: string;
  athleteName?: string;
  description?: string;
  gpsLocation: GpsLocation;
  medicalTeamAssigned?: string[];
  witnessStatements?: { name: string; statement?: string; contact?: string }[];
  attachmentKeys?: string[];
  reportedAt?: string;
}

export interface UpdateStatusPayload {
  to: IncidentState;
  reasonNote?: string;
  closureReason?: 'RESOLVED' | 'FALSE_ALARM' | 'DUPLICATE' | 'ATHLETE_REFUSED_TREATMENT';
  gps?: GpsLocation;
  medicsToAssign?: string[];
  witnessStatements?: { name: string; statement?: string; contact?: string }[];
  medicalDirectorSignature?: { name: string; signedAt: string };
  newSeverity?: Severity;
}

export type CreateOutcome =
  | { kind: 'created'; incident: IncidentResponse }
  | { kind: 'queued-offline'; queueId: string };

async function postIncident(
  raceId: string,
  payload: CreateIncidentPayload,
): Promise<IncidentResponse> {
  const res = await medicalIncidentControllerCreate({
    path: { raceId },
    body: payload as unknown as CreateIncidentDto,
  });
  if (res.error) {
    const status = res.response?.status ?? 0;
    throw new Error(`HTTP ${status}`);
  }
  if (!isIncidentResponse(res.data)) {
    throw new Error('Malformed incident response');
  }
  return res.data;
}

async function patchStatus(
  raceId: string,
  incidentId: string,
  payload: UpdateStatusPayload,
): Promise<IncidentResponse> {
  const res = await medicalIncidentControllerTransitionStatus({
    path: { raceId, id: incidentId },
    body: payload as unknown as UpdateIncidentStatusDto,
  });
  if (res.error) {
    const status = res.response?.status ?? 0;
    throw new Error(`HTTP ${status}`);
  }
  if (!isIncidentResponse(res.data)) {
    throw new Error('Malformed status response');
  }
  return res.data;
}

export function useCreateIncident(raceId: string) {
  const qc = useQueryClient();
  return useMutation<CreateOutcome, Error, CreateIncidentPayload>({
    mutationFn: async (payload) => {
      // Offline-first: BR-MI-33 IndexedDB queue when offline OR server unreachable.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const queueId = await enqueueOffline({
          raceId,
          payload,
          queuedAt: new Date().toISOString(),
        });
        return { kind: 'queued-offline', queueId };
      }
      try {
        const incident = await postIncident(raceId, payload);
        return { kind: 'created', incident };
      } catch (err) {
        // 5xx fallback to queue.
        const msg = (err as Error).message ?? '';
        if (/HTTP 5\d\d/.test(msg)) {
          const queueId = await enqueueOffline({
            raceId,
            payload,
            queuedAt: new Date().toISOString(),
          });
          return { kind: 'queued-offline', queueId };
        }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medical-incidents', raceId] });
    },
  });
}

export function useUpdateIncidentStatus(raceId: string) {
  const qc = useQueryClient();
  return useMutation<
    IncidentResponse,
    Error,
    { incidentId: string; payload: UpdateStatusPayload }
  >({
    mutationFn: ({ incidentId, payload }) =>
      patchStatus(raceId, incidentId, payload),
    onSuccess: (_data, { incidentId }) => {
      qc.invalidateQueries({ queryKey: ['medical-incidents', raceId] });
      qc.invalidateQueries({
        queryKey: ['medical-incident', raceId, incidentId],
      });
    },
  });
}
