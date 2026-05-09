'use client';

/**
 * F-018 — Incident list cards (latest-first).
 */
import { IncidentResponse } from '../medical.types';
import { CATEGORY_VN, COPY, STATE_VN } from '../medical.microcopy';
import { SeverityBadge } from './SeverityBadge';
import { CategoryIcon } from './CategoryIcon';
import { isActiveState } from '../medical.constant';

interface IncidentListProps {
  incidents: IncidentResponse[];
  onSelect: (id: string) => void;
  isLoading?: boolean;
  isError?: boolean;
}

export function IncidentList({
  incidents,
  onSelect,
  isLoading,
  isError,
}: IncidentListProps) {
  if (isLoading) {
    return (
      <ul className="space-y-2">
        {[1, 2, 3].map((i) => (
          <li
            key={i}
            className="h-20 animate-pulse rounded-md bg-stone-100"
            aria-hidden
          />
        ))}
      </ul>
    );
  }
  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        {COPY.error.generic}
      </div>
    );
  }
  if (incidents.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-sm text-stone-600">
        {COPY.empty.noIncidents}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {incidents.map((inc) => {
        const active = isActiveState(inc.state);
        return (
          <li key={inc.id}>
            <button
              type="button"
              onClick={() => onSelect(inc.id)}
              className="w-full rounded-md border border-stone-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-stone-400 hover:shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SeverityBadge
                    severity={inc.severity}
                    size="md"
                    pulsing={inc.severity === 5 && active}
                  />
                  <CategoryIcon category={inc.category} className="text-stone-700" />
                  <span className="text-sm font-medium text-stone-900">
                    {CATEGORY_VN[inc.category]}
                  </span>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    active ? 'bg-orange-100 text-orange-900' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {STATE_VN[inc.state]}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
                {inc.bib ? (
                  <span>
                    BIB <strong className="font-mono">{inc.bib}</strong>
                  </span>
                ) : (
                  <span className="italic text-stone-400">
                    VĐV chưa xác định
                  </span>
                )}
                {inc.athleteName ? <span>{inc.athleteName}</span> : null}
                <span className="font-mono text-[11px] text-stone-400">
                  {inc.gpsLocation.lat.toFixed(4)}, {inc.gpsLocation.lng.toFixed(4)}
                </span>
                <time
                  dateTime={inc.reportedAt}
                  className="ml-auto text-[11px] text-stone-500"
                >
                  {new Date(inc.reportedAt).toLocaleString('vi-VN')}
                </time>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
