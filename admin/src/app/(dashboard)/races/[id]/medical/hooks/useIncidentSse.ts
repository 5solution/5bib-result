'use client';

/**
 * F-018 BR-MI-35 — Race Director SSE realtime alerts.
 *
 * Pattern reuses F-008/F-005 `use-timing-alert-sse.ts` verbatim:
 *  - EventSource with credentials cookie
 *  - 1500ms debounce coalesce on invalidateQueries
 *  - reconnect-on-error semantics
 *
 * On `incident.created` Sev 4-5 → invokes `onCriticalAlert` callback so caller
 * can play `useKioskSound.beepError` (Web Audio reuse from F-013).
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AUDIBLE_ALERT_SEVERITIES, Severity } from '../medical.constant';

export interface UseIncidentSseOptions {
  raceId: string;
  /** Fired with payload when Sev 4-5 incident.created arrives. */
  onCriticalAlert?: (data: {
    incidentId?: string;
    severity?: Severity;
    bib?: string;
  }) => void;
  enabled?: boolean;
}

export type SseConnectionState = 'connecting' | 'connected' | 'disconnected';

export function useIncidentSse({
  raceId,
  onCriticalAlert,
  enabled = true,
}: UseIncidentSseOptions): { state: SseConnectionState } {
  const qc = useQueryClient();
  const [state, setState] = useState<SseConnectionState>('disconnected');
  const onCriticalRef = useRef(onCriticalAlert);
  useEffect(() => {
    onCriticalRef.current = onCriticalAlert;
  }, [onCriticalAlert]);

  useEffect(() => {
    if (!enabled || !raceId) return;
    if (typeof window === 'undefined' || !window.EventSource) return;

    setState('connecting');
    const url = `/api/admin/races/${encodeURIComponent(raceId)}/medical-incidents/stream`;
    const es = new EventSource(url, { withCredentials: true });

    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedInvalidate = () => {
      if (invalidateTimer) return;
      invalidateTimer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['medical-incidents', raceId] });
        invalidateTimer = null;
      }, 1500);
    };

    es.onopen = () => setState('connected');
    es.onerror = () => {
      setState('disconnected');
      // Browser auto-reconnects; we surface state for UI banner.
    };

    const onCreated = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data) as {
          severity?: Severity;
          id?: string;
          bib?: string;
        };
        if (
          data.severity &&
          AUDIBLE_ALERT_SEVERITIES.has(data.severity) &&
          onCriticalRef.current
        ) {
          onCriticalRef.current({
            incidentId: data.id,
            severity: data.severity,
            bib: data.bib,
          });
        }
      } catch {
        // ignore malformed
      }
      debouncedInvalidate();
    };

    es.addEventListener('incident.created', onCreated);
    es.addEventListener('incident.state_changed', () => debouncedInvalidate());
    es.addEventListener('incident.severity_escalated', onCreated);
    es.addEventListener('heartbeat', () => {
      if (state !== 'connected') setState('connected');
    });

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      es.close();
      setState('disconnected');
    };
    // We intentionally exclude `state` from deps to avoid reconnect loops on
    // every connection state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, raceId, qc]);

  return { state };
}
