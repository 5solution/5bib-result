'use client';

/**
 * FEATURE-050 — Race History table with race-ops columns + Gun Time toggle.
 *
 * Client component because of:
 *   - localStorage persistence for "Hiện Gun Time" toggle (PAUSE-50-05 default hidden)
 *   - Toggle state survives navigation/refresh per BR convention (sticky user pref)
 *
 * Pure presentational otherwise — fetched data passed in via SSR parent page.
 * No mutations, no API calls. All graceful-undefined on F-050 optional fields.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

export interface RaceHistoryRow {
  raceId: string;
  raceSlug: string;
  raceTitle: string;
  courseId: string;
  courseName: string;
  distance?: string;
  chipTime: string;
  bib: string;
  overallRank?: string;
  categoryRank?: string;
  category?: string;
  raceDate?: string;
  status: 'finished' | 'dnf' | 'dns' | 'dsq';
  // F-050 additions
  raceClassification?: 'road' | 'trail' | 'ultra_trail';
  elevationGain?: number;
  itraPoints?: number;
  gunTime?: string;
  agBracket?: string;
}

const STORAGE_KEY = 'runners.profile.showGunTime';

const CLASSIFICATION_META: Record<
  NonNullable<RaceHistoryRow['raceClassification']>,
  { icon: string; label: string; className: string }
> = {
  road: {
    icon: '🛣️',
    label: 'Road',
    className: 'bg-sky-50 text-sky-800 ring-sky-200',
  },
  trail: {
    icon: '🌲',
    label: 'Trail',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  ultra_trail: {
    icon: '🏔️',
    label: 'Ultra Trail',
    className: 'bg-amber-50 text-amber-900 ring-amber-200',
  },
};

function formatElevation(meters: number | undefined): string | null {
  if (typeof meters !== 'number' || meters <= 0) return null;
  // Display PAUSE-50-03 meter format: "D+ 2,580m"
  return `D+ ${meters.toLocaleString('vi-VN')}m`;
}

function renderRankCell(row: RaceHistoryRow): string {
  if (row.status === 'finished') return row.overallRank ?? '—';
  if (row.status === 'dnf') return 'DNF';
  if (row.status === 'dns') return 'DNS';
  return 'DSQ';
}

export function RaceHistoryTable({ rows }: { rows: RaceHistoryRow[] }) {
  const [showGunTime, setShowGunTime] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Read user pref after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setShowGunTime(true);
    } catch {
      /* localStorage unavailable (private mode) — leave default */
    }
    setHydrated(true);
  }, []);

  const toggle = () => {
    setShowGunTime((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Any row in the visible window has a gun time? If none — hide toggle entirely.
  const anyGunTime = rows.some((r) => Boolean(r.gunTime && r.gunTime.trim()));
  const anyItra = rows.some((r) => typeof r.itraPoints === 'number' && r.itraPoints > 0);
  const anyAgRank = rows.some((r) => Boolean(r.categoryRank));

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      {anyGunTime && (
        <div className="flex items-center justify-end gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-2 text-stone-700">
            <input
              type="checkbox"
              checked={showGunTime}
              onChange={toggle}
              className="h-4 w-4 rounded border-stone-300 text-blue-700 focus:ring-blue-600"
              aria-label="Hiện cột Gun Time"
              disabled={!hydrated}
            />
            <span>Hiện Gun Time</span>
          </label>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-600">
          <tr>
            <th className="px-3 py-2 text-left">Ngày</th>
            <th className="px-3 py-2 text-left">Race</th>
            <th className="px-3 py-2 text-left">Cự ly</th>
            <th className="px-3 py-2 text-right">Chip Time</th>
            {showGunTime && anyGunTime && (
              <th className="px-3 py-2 text-right">Gun Time</th>
            )}
            <th className="px-3 py-2 text-right">Rank</th>
            {anyAgRank && <th className="px-3 py-2 text-right">AG Rank</th>}
            {anyItra && <th className="px-3 py-2 text-right">ITRA</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row, i) => {
            const cls = row.raceClassification
              ? CLASSIFICATION_META[row.raceClassification]
              : null;
            const elev = formatElevation(row.elevationGain);
            return (
              <tr key={`${row.raceId}-${i}`} className="hover:bg-stone-50">
                <td className="px-3 py-2 text-xs text-stone-600">
                  {row.raceDate
                    ? new Date(row.raceDate).toLocaleDateString('vi-VN')
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/giai-chay/${row.raceSlug}`}
                    className="font-medium text-stone-900 hover:text-blue-700"
                  >
                    {row.raceTitle}
                  </Link>
                  {(cls || elev) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                      {cls && (
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${cls.className}`}
                          title={cls.label}
                        >
                          <span aria-hidden="true">{cls.icon}</span>
                          {cls.label}
                        </span>
                      )}
                      {elev && (
                        <span className="font-mono text-[11px] text-stone-600">
                          {elev}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-stone-700">
                  {row.distance ?? row.courseName}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {row.chipTime || '—'}
                </td>
                {showGunTime && anyGunTime && (
                  <td className="px-3 py-2 text-right font-mono text-stone-600">
                    {row.gunTime && row.gunTime.trim() ? row.gunTime : '—'}
                  </td>
                )}
                <td className="px-3 py-2 text-right text-xs">{renderRankCell(row)}</td>
                {anyAgRank && (
                  <td className="px-3 py-2 text-right text-xs">
                    {row.status === 'finished' && row.categoryRank ? (
                      <div>
                        <div className="font-semibold text-stone-900">
                          {row.categoryRank}
                        </div>
                        {row.agBracket && (
                          <div className="text-[10px] text-stone-500">
                            {row.agBracket}
                          </div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
                {anyItra && (
                  <td className="px-3 py-2 text-right font-mono text-xs text-stone-700">
                    {typeof row.itraPoints === 'number' && row.itraPoints > 0
                      ? row.itraPoints
                      : '—'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-stone-200 p-3 text-center text-xs text-stone-500">
        Tổng {rows.length} giải đã tham gia
      </div>
    </div>
  );
}
