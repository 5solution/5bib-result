'use client';

/**
 * FEATURE-005 — Alert Feed Panel (Command Center).
 *
 * REFACTOR 2026-05-05:
 * - Data source SWITCHED từ snapshot.recentActivity (poll events spam noise)
 *   sang `listTimingAlerts(raceId, { status: OPEN, pageSize: 50 })` qua
 *   TanStack Query. Phản ánh đúng "Timing Alerts" theo design canvas Artboard 3.
 * - Thêm filter tabs sev: All / Critical / High / Med (=WARNING) / Low (=INFO).
 * - Per-item layout: severity left bar + BIB / contest / "Missing CP" / last seen
 *   + projected rank highlight + Investigate / Dismiss actions + relative time.
 * - Click row hoặc "Investigate" → mở `AlertDetailDialog` (reuse F-001).
 * - "Dismiss" → patchTimingAlert FALSE_ALARM với note default
 *   "Dismissed from Command Center", invalidate query.
 *
 * Design canvas reference: race-ops-command.jsx `AlertFeed` line 206-266.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  listTimingAlerts,
  patchTimingAlert,
  type TimingAlert,
  type TimingAlertSeverity,
} from '@/lib/timing-alert-api';
import { vnSeverityLabel } from '@/lib/vn-microcopy';
import { AlertDetailDialog } from '../AlertDetailDialog';

interface AlertFeedPanelProps {
  raceId: string;
}

type SevFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';

interface FilterTabConfig {
  key: SevFilter;
  label: string;
}

// F-008 BR-CC-21 — VN labels resolved via vn-microcopy single source of truth.
// Filter chips show short forms (Nghiêm trọng / Cao / Cảnh báo / Thông tin).
const FILTER_TABS: FilterTabConfig[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CRITICAL', label: vnSeverityLabel('CRITICAL') },
  { key: 'HIGH', label: vnSeverityLabel('HIGH') },
  { key: 'WARNING', label: vnSeverityLabel('WARNING') },
  { key: 'INFO', label: vnSeverityLabel('INFO') },
];

/** Per-severity color tokens — ngang với Artboard 3 design canvas. */
const SEV_COLOR: Record<TimingAlertSeverity, string> = {
  CRITICAL: '#FF0E65', // 5sport magenta — most urgent
  HIGH: '#DC2626',
  WARNING: '#F59E0B',
  INFO: '#16A34A',
};

// F-008 BR-CC-21 — per-row badge labels resolved via vnSeverityLabel().
// Mapping uppercase form for inline severity badge inside row.
function severityBadgeLabel(sev: TimingAlertSeverity): string {
  return vnSeverityLabel(sev).toUpperCase();
}

/** "NEW" threshold — alert nào first_detected_at trong < 5 phút gần nhất. */
const NEW_THRESHOLD_MS = 5 * 60 * 1000;

export function AlertFeedPanel({ raceId }: AlertFeedPanelProps) {
  const qc = useQueryClient();
  const params = useParams();
  // F-008 v2 BR-CC2-36 — drill-in link reuses the same raceId from URL params
  // so the "Xem tất cả" button works whether the panel renders inside Command
  // Center or somewhere else with the same raceId.
  const linkRaceId = String((params as { id?: string }).id ?? raceId);
  const [filter, setFilter] = useState<SevFilter>('ALL');
  const [detailAlertId, setDetailAlertId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['command-center-alerts', raceId],
    queryFn: () =>
      listTimingAlerts(raceId, { status: 'OPEN', pageSize: 50 }),
    enabled: !!raceId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const dismissMutation = useMutation({
    mutationFn: (alertId: string) =>
      patchTimingAlert(raceId, alertId, {
        action: 'FALSE_ALARM',
        note: 'Dismissed from Command Center',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['command-center-alerts', raceId] });
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
      qc.invalidateQueries({ queryKey: ['timing-alerts-stats', raceId] });
    },
  });

  const items = data?.items ?? [];
  const stats = data?.stats;
  const totalAll = stats?.open_count ?? 0;

  const counts: Record<SevFilter, number> = useMemo(() => {
    const bySev = stats?.by_severity ?? {
      CRITICAL: 0,
      HIGH: 0,
      WARNING: 0,
      INFO: 0,
    };
    return {
      ALL: totalAll,
      CRITICAL: bySev.CRITICAL,
      HIGH: bySev.HIGH,
      WARNING: bySev.WARNING,
      INFO: bySev.INFO,
    };
  }, [stats, totalAll]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items;
    return items.filter((a) => a.severity === filter);
  }, [filter, items]);

  const newCount = useMemo(() => {
    const now = Date.now();
    return items.filter((a) => {
      const t = new Date(a.first_detected_at).getTime();
      return Number.isFinite(t) && now - t < NEW_THRESHOLD_MS;
    }).length;
  }, [items]);

  return (
    <CardShell>
      {/* ─── Header ─── */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--5s-border)' }}
      >
        <div className="flex items-center gap-3">
          <h3
            className="text-[15px] font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Timing Alerts
          </h3>
          {newCount > 0 && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white"
              style={{ background: '#FF0E65', letterSpacing: '.05em' }}
            >
              {newCount} NEW
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.key;
            const count = counts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition-colors"
                style={{
                  height: 30,
                  background: active ? '#0F172A' : 'transparent',
                  color: active ? '#fff' : 'var(--5s-text-muted)',
                  borderColor: active ? '#0F172A' : 'var(--5s-border)',
                  fontFamily: 'inherit',
                }}
              >
                <span>{tab.label}</span>
                <span
                  className="opacity-70"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ─── Body ─── */}
      <div className="max-h-[420px] overflow-y-auto">
        {isLoading ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} totalAll={totalAll} />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--5s-border)' }}>
            {filtered.map((alert) => (
              <AlertRow
                key={alert._id}
                alert={alert}
                onInvestigate={() => setDetailAlertId(alert._id)}
                onDismiss={() => dismissMutation.mutate(alert._id)}
                dismissing={
                  dismissMutation.isPending &&
                  dismissMutation.variables === alert._id
                }
              />
            ))}
          </ul>
        )}
      </div>

      {/* F-008 v2 BR-CC2-36 — drill-in link bottom-right "Xem tất cả N alerts →" */}
      {totalAll > 0 && (
        <div
          className="flex justify-end border-t px-4 py-2"
          style={{ borderColor: 'var(--5s-border)' }}
        >
          <Link
            href={`/races/${linkRaceId}/command-center?view=alerts`}
            className="inline-flex items-center gap-1 text-[12px] font-semibold transition-colors hover:underline"
            style={{ color: 'var(--5s-magenta, #FF0E65)' }}
            data-testid="view-all-alerts-link"
          >
            Xem tất cả {totalAll} alerts
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Reuse F-001 detail dialog */}
      <AlertDetailDialog
        raceId={raceId}
        alertId={detailAlertId}
        open={!!detailAlertId}
        onOpenChange={(o) => {
          if (!o) setDetailAlertId(null);
        }}
      />
    </CardShell>
  );
}

// ─────────── Sub components ───────────

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="overflow-hidden rounded-[14px] border bg-white"
      style={{
        borderColor: 'var(--5s-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {children}
    </section>
  );
}

interface AlertRowProps {
  alert: TimingAlert;
  onInvestigate: () => void;
  onDismiss: () => void;
  dismissing: boolean;
}

function AlertRow({
  alert,
  onInvestigate,
  onDismiss,
  dismissing,
}: AlertRowProps) {
  const sevColor = SEV_COLOR[alert.severity];
  const sevLabel = severityBadgeLabel(alert.severity);
  const projected = alert.projected_age_group_rank;
  const showProjected =
    projected !== null && projected !== undefined && projected <= 10;

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-row-action]')) return;
    onInvestigate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onInvestigate();
    }
  };

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className="flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-stone-50 focus:bg-stone-50 focus:outline-none"
      style={{ borderLeft: `3px solid ${sevColor}`, cursor: 'pointer' }}
    >
      {/* Severity badge */}
      <span
        className="mt-0.5 inline-block shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white"
        style={{
          background: sevColor,
          letterSpacing: '.06em',
        }}
      >
        {sevLabel}
      </span>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className="text-[13px] font-bold"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            BIB {alert.bib_number}
          </span>
          {alert.contest && (
            <span
              className="rounded px-1.5 py-0.5 text-[11px] text-stone-700"
              style={{ background: 'var(--5s-surface)' }}
            >
              {alert.contest}
            </span>
          )}
          <span className="text-[13px] font-semibold text-stone-800">
            — Missing {alert.missing_point}
          </span>
        </div>
        <div
          className="mt-1 text-[11px] text-stone-500"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Last seen: {alert.last_seen_point} at {alert.last_seen_time}
        </div>
        {showProjected && (
          <div
            className="mt-1 text-[11px] font-semibold"
            style={{ color: '#FF0E65' }}
          >
            Projected: Top {projected}
            {alert.age_group ? ` ${alert.age_group}` : ''}
          </div>
        )}
        {alert.athlete_name && (
          <div className="mt-0.5 text-[11px] text-stone-600">
            {alert.athlete_name}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className="text-[10px] text-stone-500"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {formatRelative(alert.first_detected_at)}
        </span>
        <div className="flex items-center gap-1.5" data-row-action>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              onInvestigate();
            }}
          >
            Điều tra
          </Button>
          <button
            type="button"
            disabled={dismissing}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            aria-label="Dismiss alert"
            className="grid size-7 place-items-center rounded-md border bg-white text-stone-500 transition-colors hover:border-stone-400 hover:text-stone-800 disabled:opacity-50"
            style={{ borderColor: 'var(--5s-border)' }}
          >
            ×
          </button>
        </div>
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="divide-y" style={{ borderColor: 'var(--5s-border)' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-stone-200" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/2 animate-pulse rounded bg-stone-200" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-stone-100" />
          </div>
          <div className="h-7 w-20 shrink-0 animate-pulse rounded bg-stone-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  filter,
  totalAll,
}: {
  filter: SevFilter;
  totalAll: number;
}) {
  if (filter === 'ALL' || totalAll === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-stone-600">
        Chưa có cảnh báo miss chip nào — race đang clean.
      </div>
    );
  }
  const tab = FILTER_TABS.find((t) => t.key === filter);
  return (
    <div className="px-4 py-8 text-center text-sm text-stone-600">
      Không có cảnh báo {tab?.label ?? filter}.
    </div>
  );
}

function formatRelative(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return iso;
    const diff = Date.now() - t;
    if (diff < 60_000) return 'vừa xong';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
}
