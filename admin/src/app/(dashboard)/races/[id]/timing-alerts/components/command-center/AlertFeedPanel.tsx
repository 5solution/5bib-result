'use client';

/**
 * FEATURE-005 — Alert Feed Panel component (Command Center).
 *
 * Reuse `recentActivity` từ F-002 snapshot. Per design canvas Artboard 3:
 * - Severity badges (CRITICAL/HIGH/WARNING/INFO) với F-001 mapping
 * - Click → external link alert detail (modal mở từ AlertsTab)
 * - Compact list 5-10 items
 */

import { Badge } from '@/components/ui/badge';
import type { RecentActivityItem } from '@/lib/timing-alert-api';

interface AlertFeedPanelProps {
  items: RecentActivityItem[];
  /** Limit hiển thị (default 8) */
  limit?: number;
}

export function AlertFeedPanel({ items, limit = 8 }: AlertFeedPanelProps) {
  const visible = items.slice(0, limit);

  if (visible.length === 0) {
    return (
      <CardShell>
        <div className="p-4 text-sm text-stone-600">
          Chưa có hoạt động alert nào.
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: 'var(--5s-border)' }}
      >
        <h3
          className="text-[15px] font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Timing Alert Feed
        </h3>
      </div>
      <div className="p-0">
        <ul className="divide-y" style={{ borderColor: 'var(--5s-border)' }}>
          {visible.map((it, idx) => (
            <li
              key={`${it.type}-${idx}-${it.at}`}
              className="flex items-start gap-3 px-3 py-2 text-sm"
            >
              <span className="mt-0.5 flex w-5 shrink-0 items-center justify-center">
                {iconForType(it.type)}
              </span>
              <div className="min-w-0 flex-1">
                <ActivityLine item={it} />
              </div>
              <span
                className="shrink-0 text-xs text-stone-500"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {formatRelative(it.at)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </CardShell>
  );
}

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

function iconForType(type: string): string {
  if (type === 'alert.created') return '🔴';
  if (type === 'alert.resolved') return '✅';
  if (type === 'poll.completed') return '🔄';
  return '•';
}

function severityClass(severity: string | undefined): string {
  switch (severity) {
    case 'CRITICAL':
      return 'border-[#FF0E65] bg-pink-50 text-[#FF0E65]';
    case 'HIGH':
      return 'border-orange-300 bg-orange-50 text-orange-800';
    case 'WARNING':
      return 'border-amber-300 bg-amber-50 text-amber-800';
    case 'INFO':
      return 'border-blue-300 bg-blue-50 text-blue-800';
    default:
      return '';
  }
}

function ActivityLine({ item }: { item: RecentActivityItem }) {
  const p = item.payload;
  if (item.type === 'alert.created' || item.type === 'alert.resolved') {
    const sev =
      typeof p.severity === 'string' ? p.severity : undefined;
    const bib = typeof p.bib === 'string' || typeof p.bib === 'number'
      ? String(p.bib)
      : '?';
    const name = typeof p.name === 'string' ? p.name : '';
    const contest = typeof p.contest === 'string' ? p.contest : '';
    const missingPoint =
      typeof p.missingPoint === 'string' ? p.missingPoint : '';
    return (
      <span className="text-stone-800">
        <strong style={{ fontFamily: 'var(--font-mono)' }}>BIB {bib}</strong>{' '}
        <span className="text-stone-700">{name}</span>
        {contest && (
          <span className="ml-1 text-xs text-stone-500">({contest})</span>
        )}
        {sev && (
          <Badge
            variant="outline"
            className={`ml-2 ${severityClass(sev)}`}
          >
            {sev}
          </Badge>
        )}
        {missingPoint && (
          <span className="ml-1 text-xs text-stone-600">
            miss <strong>{missingPoint}</strong>
          </span>
        )}
        {item.type === 'alert.resolved' && (
          <span className="ml-1 text-xs text-stone-500">(resolved)</span>
        )}
      </span>
    );
  }
  if (item.type === 'poll.completed') {
    const course = typeof p.course === 'string' ? p.course : '';
    const fetched =
      typeof p.athletesFetched === 'number' ? p.athletesFetched : 0;
    const created =
      typeof p.alertsCreated === 'number' ? p.alertsCreated : 0;
    const resolved =
      typeof p.alertsResolved === 'number' ? p.alertsResolved : 0;
    return (
      <span className="text-stone-700">
        Poll <strong>{course}</strong> — fetched{' '}
        {fetched.toLocaleString('vi-VN')}, +{created} new, -{resolved} resolved
      </span>
    );
  }
  return <span className="text-stone-500">{item.type}</span>;
}

function formatRelative(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 60_000) return 'vừa xong';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
}
