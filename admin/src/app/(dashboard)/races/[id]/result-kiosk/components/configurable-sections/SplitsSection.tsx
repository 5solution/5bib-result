'use client';

/**
 * F-017 — Splits section extracted from KioskResultCard for config-driven
 * render. Uses BR-AF-23 verbatim parseSplitsFromData logic from F-013
 * (re-exported here for direct call without breaking KioskResultCard).
 */

import { useMemo } from 'react';
import { parseSplitsFromData } from '../KioskResultCard';
import type { AthleteDetailData } from '../../kiosk.types';
import { KIOSK_COPY } from '../../kiosk.microcopy';

interface Props {
  data: AthleteDetailData;
}

export function SplitsSection({ data }: Props) {
  const splits = useMemo(
    () => parseSplitsFromData(data as unknown as Record<string, unknown>),
    [data],
  );
  if (!splits || splits.length === 0) return null;
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4" data-testid="splits-section">
      <div className="text-xs uppercase tracking-wide text-stone-500">
        {KIOSK_COPY.result.splitsTitle}
      </div>
      <ul className="mt-2 divide-y divide-stone-100 text-sm">
        {splits.map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex items-center justify-between px-2 py-2">
            <span className="font-medium text-stone-700">{s.name}</span>
            <span className="font-mono tabular-nums">{s.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
