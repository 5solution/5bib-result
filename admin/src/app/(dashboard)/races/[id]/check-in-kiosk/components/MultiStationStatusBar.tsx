'use client';

/**
 * F-015 BR-CK-09 — Persistent multi-station status bar.
 *
 * Shows: per-station counter (current device's station) + global total +
 * SSE connectivity dot. Mounted at top of every kiosk-mode surface.
 */

import { CheckCircle, AlertCircle, WifiOff } from 'lucide-react';
import { CHECKIN_COPY } from '../checkin.microcopy';
import type { CheckInStatsPayload } from '../checkin.types';

interface MultiStationStatusBarProps {
  stationId: string;
  stats: CheckInStatsPayload | null;
  connected: boolean;
  fallbackPolling: boolean;
}

export function MultiStationStatusBar({
  stationId,
  stats,
  connected,
  fallbackPolling,
}: MultiStationStatusBarProps) {
  const perStationCount =
    stats?.perStation.find((s) => s.stationId === stationId)?.count ?? 0;
  const total = stats?.totalAthletes ?? 0;
  const pickedUp = stats?.pickedUp ?? 0;

  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2 text-sm"
      data-testid="multi-station-status-bar"
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-stone-700">
          {CHECKIN_COPY.status.perStation(stationId, perStationCount)}
        </span>
        <span className="text-stone-400">·</span>
        <span className="font-medium text-stone-700">
          {CHECKIN_COPY.status.global(pickedUp, total)}
        </span>
        {stats?.ratePerMinute !== undefined && stats.ratePerMinute > 0 ? (
          <>
            <span className="text-stone-400">·</span>
            <span className="text-stone-500">
              {CHECKIN_COPY.status.rate(stats.ratePerMinute)}
            </span>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-xs">
        {connected ? (
          <>
            <CheckCircle className="size-4 text-emerald-600" aria-hidden />
            <span className="text-emerald-700">SSE</span>
          </>
        ) : fallbackPolling ? (
          <>
            <AlertCircle className="size-4 text-amber-600" aria-hidden />
            <span className="text-amber-700">polling 30s</span>
          </>
        ) : (
          <>
            <WifiOff className="size-4 text-rose-600" aria-hidden />
            <span className="text-rose-700">disconnected</span>
          </>
        )}
      </div>
    </div>
  );
}
