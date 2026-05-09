'use client';

/**
 * F-008 v2 BR-CC2-17 — SSE listener hook (body-scoped).
 *
 * Mounts EventSource to `/admin/races/:raceId/timing-alert/sse` and triggers
 * debounced TanStack Query invalidation on `alert.created` / `alert.updated` /
 * `alert.resolved` / `poll.completed` events.
 *
 * Pattern carried over verbatim from F-005 `timing-alerts/page.tsx` SSE
 * listener — same 1500ms debounce coalesce + reconnect-on-error semantics.
 *
 * **Body-scoped** (per PAUSE-CC2-03 resolution): hook lives inside
 * CommandCenterLayout, which means SSE only runs while user is on Command
 * Center tab. Awards tab loses 880Hz alarm — acceptable trade-off because
 * MC monitors races on Command Center surface anyway.
 *
 * @param raceId — race ID; SSE skipped when empty/null
 * @param options.onCriticalAlert — invoked when CRITICAL alert.created arrives
 *   (used by SoundToggleButton to play 880Hz alarm if sound enabled)
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { timingAlertSseUrl } from './timing-alert-api';

export interface UseTimingAlertSseOptions {
  /** Fired with the parsed alert payload when a CRITICAL `alert.created` arrives. */
  onCriticalAlert?: (alert: {
    bib_number?: string;
    athlete_name?: string | null;
    missing_point?: string;
    severity?: string;
  }) => void;
}

export function useTimingAlertSse(
  raceId: string,
  options?: UseTimingAlertSseOptions,
): void {
  const qc = useQueryClient();
  // Stable ref pattern — avoid re-subscribing SSE when caller passes inline callback
  const onCriticalRef = useRef(options?.onCriticalAlert);
  useEffect(() => {
    onCriticalRef.current = options?.onCriticalAlert;
  }, [options?.onCriticalAlert]);

  useEffect(() => {
    if (!raceId) return;
    const url = timingAlertSseUrl(raceId);
    const es = new EventSource(url, { withCredentials: true });

    // Debounce 1500ms — race day 1000+ alerts trong vài giây sẽ trigger N
    // invalidate spam → N×4 severity refetches. Coalesce. (F-005 verbatim.)
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedInvalidate = () => {
      if (invalidateTimer) return;
      invalidateTimer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
        qc.invalidateQueries({ queryKey: ['timing-alerts-stats', raceId] });
        qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
        invalidateTimer = null;
      }, 1500);
    };

    const onAlertCreated = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data) as {
          severity?: string;
          bib_number?: string;
          athlete_name?: string | null;
          missing_point?: string;
        };
        if (data.severity === 'CRITICAL' && onCriticalRef.current) {
          onCriticalRef.current(data);
        }
      } catch {
        // ignore malformed event payload
      }
      debouncedInvalidate();
    };

    const onPodiumPoll = () => {
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      qc.invalidateQueries({ queryKey: ['podium', raceId] });
    };

    es.addEventListener('alert.created', onAlertCreated);
    es.addEventListener('alert.updated', debouncedInvalidate);
    es.addEventListener('alert.resolved', debouncedInvalidate);
    es.addEventListener('poll.completed', onPodiumPoll);

    es.onerror = () => {
      // EventSource auto-reconnects unless es.close() called — leave default
      // browser retry. F-005 pattern unchanged.
    };

    return () => {
      es.close();
      if (invalidateTimer) clearTimeout(invalidateTimer);
    };
  }, [raceId, qc]);
}
