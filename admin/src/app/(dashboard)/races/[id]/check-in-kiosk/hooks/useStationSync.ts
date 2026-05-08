'use client';

/**
 * F-015 BR-CK-08/09 — Multi-station SSE subscriber + polling fallback.
 *
 * Subscribes to `GET /api/race-results/:raceId/check-in/stream` via native
 * EventSource. On 3 consecutive failures, falls back to polling
 * `GET /api/race-results/:raceId/check-in/stats` every 30s.
 *
 * Pattern reuses F-005 `timing-alert-sse.controller.ts` SSE shape (event
 * payloads serialized as JSON in `event.data`, heartbeat every 25s server-
 * side).
 *
 * NOTE: Browser EventSource does NOT send Authorization headers natively.
 * Backend SSE endpoint (`@Sse()` decorator) reads Logto session cookie via
 * the runtime proxy (`/api/[...proxy]/route.ts`) — NO query-param token leak.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CHECKIN_CONFIG,
} from '../checkin.constant';
import {
  isCheckInStatsResponse,
  type CheckInSseEvent,
  type CheckInStatsPayload,
} from '../checkin.types';

interface UseStationSyncArgs {
  raceId: string;
  enabled: boolean;
  onPickup?: (evt: CheckInSseEvent) => void;
}

export interface UseStationSyncReturn {
  connected: boolean;
  fallbackPolling: boolean;
  stats: CheckInStatsPayload | null;
  lastError: unknown;
  manualReconnect: () => void;
}

export function useStationSync({ raceId, enabled, onPickup }: UseStationSyncArgs): UseStationSyncReturn {
  const [connected, setConnected] = useState(false);
  const [fallbackPolling, setFallbackPolling] = useState(false);
  const [stats, setStats] = useState<CheckInStatsPayload | null>(null);
  const [lastError, setLastError] = useState<unknown>(null);
  const failuresRef = useRef(0);
  const pollIntervalRef = useRef<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const onPickupRef = useRef(onPickup);
  onPickupRef.current = onPickup;
  const reconnectTickRef = useRef(0);

  const fetchStats = useCallback(async () => {
    if (!raceId) return;
    try {
      const res = await fetch(`/api/race-results/${encodeURIComponent(raceId)}/check-in/stats`);
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as unknown;
      if (isCheckInStatsResponse(data) && data.data) {
        setStats(data.data);
      }
    } catch (err) {
      setLastError(err);
    }
  }, [raceId]);

  const cleanup = useCallback(() => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch { /* ignore */ }
      sseRef.current = null;
    }
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) return;
    setFallbackPolling(true);
    pollIntervalRef.current = window.setInterval(() => {
      void fetchStats();
    }, CHECKIN_CONFIG.SSE_POLLING_FALLBACK_MS);
    void fetchStats();
  }, [fetchStats]);

  const startSse = useCallback(() => {
    if (!raceId || typeof window === 'undefined') return;
    try {
      const url = `/api/race-results/${encodeURIComponent(raceId)}/check-in/stream`;
      const es = new EventSource(url, { withCredentials: true });
      sseRef.current = es;
      es.onopen = () => {
        setConnected(true);
        setFallbackPolling(false);
        failuresRef.current = 0;
        if (pollIntervalRef.current !== null) {
          window.clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as CheckInSseEvent;
          if (parsed && parsed.type === CHECKIN_CONFIG.SSE_EVENT_PICKUP) {
            onPickupRef.current?.(parsed);
            // Refresh stats opportunistically (cheap, polled-cache-backed).
            void fetchStats();
          }
        } catch {
          /* ignore malformed events */
        }
      };
      es.onerror = (err) => {
        setLastError(err);
        setConnected(false);
        failuresRef.current += 1;
        try { es.close(); } catch { /* ignore */ }
        sseRef.current = null;
        if (failuresRef.current >= CHECKIN_CONFIG.SSE_MAX_FAILURES_BEFORE_POLLING) {
          startPolling();
        } else {
          // Backoff retry: exponential 2/4/8s capped.
          const delay = Math.min(2000 * 2 ** (failuresRef.current - 1), 8000);
          window.setTimeout(() => {
            reconnectTickRef.current += 1;
            startSse();
          }, delay);
        }
      };
    } catch (err) {
      setLastError(err);
      startPolling();
    }
  }, [raceId, fetchStats, startPolling]);

  const manualReconnect = useCallback(() => {
    cleanup();
    failuresRef.current = 0;
    setFallbackPolling(false);
    setConnected(false);
    startSse();
  }, [cleanup, startSse]);

  useEffect(() => {
    if (!enabled || !raceId) {
      cleanup();
      return;
    }
    void fetchStats();
    startSse();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, raceId]);

  return { connected, fallbackPolling, stats, lastError, manualReconnect };
}
