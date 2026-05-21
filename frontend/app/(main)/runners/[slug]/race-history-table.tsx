'use client';

import * as React from 'react';

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

/**
 * UI polish — status badge with color-coded pill instead of plain text.
 * Finished = numeric rank (no pill, just bold number).
 * DNF / DNS / DSQ = colored pills with consistent visual weight.
 */
function renderRankCell(row: RaceHistoryRow): React.ReactElement {
  if (row.status === 'finished') {
    const rank = row.overallRank ?? '—';
    return (
      <span className="font-mono text-sm font-semibold tabular-nums text-stone-900">
        {rank}
      </span>
    );
  }
  const statusMeta = {
    dnf: 'bg-orange-100 text-orange-800 ring-orange-200',
    dns: 'bg-stone-100 text-stone-600 ring-stone-200',
    dsq: 'bg-red-100 text-red-800 ring-red-200',
  } as const;
  const label = row.status.toUpperCase();
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ring-1 ${
        statusMeta[row.status as 'dnf' | 'dns' | 'dsq']
      }`}
    >
      {label}
    </span>
  );
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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
      {anyGunTime && (
        <div className="flex items-center justify-end gap-2 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-stone-50/70 px-4 py-2.5 text-xs">
          <label className="inline-flex cursor-pointer select-none items-center gap-2 font-medium text-stone-700 transition hover:text-stone-900">
            <input
              type="checkbox"
              checked={showGunTime}
              onChange={toggle}
              className="h-4 w-4 rounded border-stone-300 text-blue-700 focus:ring-blue-600 focus:ring-offset-0"
              aria-label="Hiện cột Gun Time"
              disabled={!hydrated}
            />
            <span>Hiện Gun Time</span>
          </label>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50/50 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
            <tr>
              <th className="px-4 py-3 text-left">Ngày</th>
              <th className="px-4 py-3 text-left">Race</th>
              <th className="px-4 py-3 text-left">Cự ly</th>
              <th className="px-4 py-3 text-right">Chip Time</th>
              {showGunTime && anyGunTime && (
                <th className="px-4 py-3 text-right">Gun Time</th>
              )}
              <th className="px-4 py-3 text-right">Rank</th>
              {anyAgRank && <th className="px-4 py-3 text-right">AG Rank</th>}
              {anyItra && <th className="px-4 py-3 text-right">ITRA</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((row, i) => {
              const cls = row.raceClassification
                ? CLASSIFICATION_META[row.raceClassification]
                : null;
              const elev = formatElevation(row.elevationGain);
              const isFinished = row.status === 'finished';
              return (
                <tr
                  key={`${row.raceId}-${i}`}
                  className="group relative transition hover:bg-stone-50/70"
                >
                  {/* hover row left-edge accent indicator */}
                  <td className="relative w-0 p-0">
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-0.5 transition-all duration-300 group-hover:w-1 ${
                        isFinished
                          ? 'bg-blue-700/0 group-hover:bg-blue-700'
                          : 'bg-stone-400/0 group-hover:bg-stone-400'
                      }`}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-stone-500 tabular-nums">
                    {row.raceDate
                      ? new Date(row.raceDate).toLocaleDateString('vi-VN')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/giai-chay/${row.raceSlug}`}
                      className="block font-medium text-stone-900 transition hover:text-blue-700"
                    >
                      <span className="bg-gradient-to-r from-blue-700 to-blue-700 bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                        {row.raceTitle}
                      </span>
                    </Link>
                    {(cls || elev) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {cls && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${cls.className}`}
                            title={cls.label}
                          >
                            <span aria-hidden="true">{cls.icon}</span>
                            {cls.label}
                          </span>
                        )}
                        {elev && (
                          <span className="font-mono text-[10px] font-medium text-stone-500">
                            {elev}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                    {row.distance ?? row.courseName}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-bold tabular-nums ${
                      isFinished ? 'text-stone-900' : 'text-stone-300'
                    }`}
                  >
                    {row.chipTime || '—'}
                  </td>
                  {showGunTime && anyGunTime && (
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs tabular-nums text-stone-500">
                      {row.gunTime && row.gunTime.trim() ? row.gunTime : '—'}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {renderRankCell(row)}
                  </td>
                  {anyAgRank && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {row.status === 'finished' && row.categoryRank ? (
                        <div>
                          <div className="font-mono text-sm font-bold tabular-nums text-stone-900">
                            {row.categoryRank}
                          </div>
                          {row.agBracket && (
                            <div className="mt-0.5 text-[10px] font-medium text-stone-500">
                              {row.agBracket}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  )}
                  {anyItra && (
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs font-medium tabular-nums text-stone-700">
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
      </div>
      <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/30 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
          Race Log
        </span>
        <span className="text-xs text-stone-500">
          Tổng{' '}
          <span className="font-mono font-bold tabular-nums text-stone-900">
            {rows.length}
          </span>{' '}
          giải đã tham gia
        </span>
      </div>
    </div>
  );
}
