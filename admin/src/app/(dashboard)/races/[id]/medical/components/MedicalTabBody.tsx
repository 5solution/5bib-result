'use client';

/**
 * F-018 — Surface 1: Medical tab body (orchestrator).
 * Combines list + filters + form modal + detail drawer + SSE + offline banner.
 */
import { useState } from 'react';
import { useKioskSound } from '@/lib/kiosk/useKioskSound';
import { useIncidents } from '../hooks/useIncidents';
import { useIncidentSse } from '../hooks/useIncidentSse';
import { COPY } from '../medical.microcopy';
import type { IncidentResponse } from '../medical.types';
import type { Severity } from '../medical.constant';
import { IncidentList } from './IncidentList';
import { IncidentForm } from './IncidentForm';
import { IncidentDetailDrawer } from './IncidentDetailDrawer';
import { IncidentFilters, FilterState } from './IncidentFilters';
import { OfflineQueueBanner } from './OfflineQueueBanner';
import { PdfExportButton } from './PdfExportButton';

interface MedicalTabBodyProps {
  raceId: string;
  raceStatus: 'draft' | 'pre_race' | 'live' | 'ended';
}

export function MedicalTabBody({ raceId, raceStatus }: MedicalTabBodyProps) {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>({
    severity: [],
    state: [],
    category: null,
    since: null,
  });
  const { ensureAudioContext, beepError } = useKioskSound();

  const { data, isLoading, isError } = useIncidents({
    raceId,
    filter: {
      severity: filter.severity.length ? filter.severity : undefined,
      state: filter.state.length ? filter.state : undefined,
      category: filter.category ?? undefined,
      since: filter.since ?? undefined,
      limit: 50,
      offset: 0,
    },
  });

  const sse = useIncidentSse({
    raceId,
    enabled: raceStatus === 'live' || raceStatus === 'ended',
    onCriticalAlert: (data) => {
      ensureAudioContext();
      beepError();
      // Browser title bump for tabs in background.
      if (typeof document !== 'undefined' && data?.severity) {
        const sev: Severity = data.severity;
        const original = document.title;
        document.title = `🚨 Sev ${sev} — ${original}`;
        setTimeout(() => {
          document.title = original;
        }, 30_000);
      }
    },
  });

  if (raceStatus === 'draft') {
    return (
      <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-12 text-center text-sm text-stone-600">
        {COPY.empty.raceDraft}
      </div>
    );
  }

  const selected: IncidentResponse | null =
    data?.items.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900">{COPY.page.title}</h2>
          {data ? (
            <p className="text-xs text-stone-600">
              <strong className="text-red-700">{data.activeCount}</strong> {COPY.page.activeBadgePrefix} —{' '}
              {data.total} tổng cộng
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-label={`SSE ${sse.state}`}
            className={`size-2 rounded-full ${
              sse.state === 'connected'
                ? 'bg-green-500'
                : sse.state === 'connecting'
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            title={
              sse.state === 'connected'
                ? COPY.sse.connected
                : sse.state === 'connecting'
                ? COPY.sse.reconnecting
                : COPY.sse.disconnected
            }
          />
          <PdfExportButton raceId={raceId} label="Tạo báo cáo tổng" />
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="min-h-[60px] rounded-md bg-red-600 px-6 py-3 text-base font-semibold text-white hover:bg-red-700"
          >
            + {COPY.page.cta}
          </button>
        </div>
      </header>

      <OfflineQueueBanner />

      <IncidentFilters
        value={filter}
        onChange={setFilter}
        totalCount={data?.total ?? 0}
      />

      <IncidentList
        incidents={data?.items ?? []}
        onSelect={setSelectedId}
        isLoading={isLoading}
        isError={isError}
      />

      {showForm ? (
        <IncidentForm
          raceId={raceId}
          onClose={() => setShowForm(false)}
          onCreated={(id) => {
            setShowForm(false);
            setSelectedId(id);
          }}
        />
      ) : null}

      {selected ? (
        <IncidentDetailDrawer
          raceId={raceId}
          incident={selected}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
