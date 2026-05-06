'use client';

/**
 * FEATURE-005 — Summary Cards Row component (Command Center).
 *
 * 5 metric cards horizontal: Racekit nhận / VĐV xuất phát / VĐV về đích / DNS / Miss%
 * - Plus Jakarta Sans labels (var(--font-display))
 * - JetBrains Mono numbers (var(--font-mono))
 * - Color-coded miss% (green <2%, amber 2-5%, magenta >5%)
 * - Card style matches design canvas: rounded-[14px] + shadow-xs + border --5s-border
 */

import type { SummaryCards } from '@/lib/timing-alert-api';

interface SummaryCardsRowProps {
  summary: SummaryCards;
}

export function SummaryCardsRow({ summary }: SummaryCardsRowProps) {
  const missColorMap = {
    bg: '#DCFCE7',
    fg: '#166534',
  };
  const missAccent =
    summary.missRate > 5
      ? { bg: '#FEE2E2', fg: '#991B1B' }
      : summary.missRate >= 2
        ? { bg: '#FEF3C7', fg: '#92400E' }
        : missColorMap;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <MetricCard
        label="Racekit nhận"
        value={summary.racekitPickedUp.toLocaleString('vi-VN')}
        sublabel={`/ ${summary.totalRegistered.toLocaleString('vi-VN')}`}
        accent={{ bg: '#FFE0EC', fg: '#FF0E65' }}
        progress={
          summary.totalRegistered > 0
            ? (summary.racekitPickedUp / summary.totalRegistered) * 100
            : undefined
        }
      />
      <MetricCard
        label="VĐV xuất phát"
        value={summary.started.toLocaleString('vi-VN')}
        sublabel="có time tại Start"
        accent={{ bg: '#DCFCE7', fg: '#166534' }}
      />
      <MetricCard
        label="VĐV về đích"
        value={summary.finished.toLocaleString('vi-VN')}
        sublabel={
          summary.started > 0
            ? `${((summary.finished / summary.started) * 100).toFixed(1)}% / xuất phát`
            : 'có time tại Finish'
        }
        accent={{ bg: '#FFE0EC', fg: '#FF0E65' }}
        progress={
          summary.started > 0
            ? (summary.finished / summary.started) * 100
            : undefined
        }
      />
      <MetricCard
        label="DNS"
        value={summary.dns.toLocaleString('vi-VN')}
        sublabel="không xuất phát"
        accent={{ bg: '#F3F0EB', fg: '#78716C' }}
      />
      <MetricCard
        label="Miss %"
        value={`${summary.missRate.toFixed(1)}%`}
        sublabel={`${summary.missCount.toLocaleString('vi-VN')} alerts mở`}
        accent={missAccent}
        valueClassName={
          summary.missRate > 5
            ? 'text-[#FF0E65]'
            : summary.missRate >= 2
              ? 'text-amber-700'
              : 'text-emerald-700'
        }
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  accent,
  progress,
  valueClassName,
}: {
  label: string;
  value: string;
  sublabel: string;
  accent: { bg: string; fg: string };
  progress?: number;
  valueClassName?: string;
}) {
  return (
    <div
      className="flex min-w-[140px] flex-col rounded-[14px] border bg-white p-4"
      style={{
        borderColor: 'var(--5s-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded"
          style={{ background: accent.fg }}
        />
        <div
          className="text-[10px] font-extrabold uppercase tracking-[.12em] text-stone-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {label}
        </div>
      </div>
      <div
        className={`text-2xl font-bold leading-none ${valueClassName ?? 'text-stone-900'}`}
        style={{
          fontFamily: 'var(--font-mono)',
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-stone-500">{sublabel}</div>
      {progress !== undefined && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--5s-surface)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, progress)}%`,
              background:
                progress >= 90
                  ? 'var(--5s-success)'
                  : progress >= 70
                    ? 'var(--5s-warning)'
                    : 'var(--5s-danger)',
            }}
          />
        </div>
      )}
    </div>
  );
}
