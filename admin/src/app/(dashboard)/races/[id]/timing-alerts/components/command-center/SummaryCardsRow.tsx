'use client';

/**
 * FEATURE-005 — Summary Cards Row component (Command Center).
 *
 * 5 metric cards horizontal: Racekit / Started / Finished / DNS / Miss%
 * - Plus Jakarta Sans labels (var(--font-sans))
 * - JetBrains Mono numbers (var(--font-mono))
 * - Color-coded miss% (green <2%, amber 2-5%, red >5%)
 */

import { Card, CardContent } from '@/components/ui/card';
import type { SummaryCards } from '@/lib/timing-alert-api';

interface SummaryCardsRowProps {
  summary: SummaryCards;
}

export function SummaryCardsRow({ summary }: SummaryCardsRowProps) {
  const missColor =
    summary.missRate > 5
      ? 'text-[#FF0E65]'
      : summary.missRate >= 2
        ? 'text-amber-600'
        : 'text-emerald-700';
  const missBg =
    summary.missRate > 5
      ? 'border-[#FF0E65] bg-pink-50'
      : summary.missRate >= 2
        ? 'border-amber-300 bg-amber-50'
        : 'border-emerald-200 bg-emerald-50';

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <MetricCard
        label="Racekit"
        value={summary.racekitPickedUp}
        sublabel={`/ ${summary.totalRegistered.toLocaleString('vi-VN')} đăng ký`}
        accent="border-blue-200 bg-blue-50"
      />
      <MetricCard
        label="Xuất phát"
        value={summary.started}
        sublabel="có time tại Start"
        accent="border-blue-300 bg-blue-50"
      />
      <MetricCard
        label="Về đích"
        value={summary.finished}
        sublabel="có time tại Finish"
        accent="border-emerald-200 bg-emerald-50"
      />
      <MetricCard
        label="DNS"
        value={summary.dns}
        sublabel="không xuất phát"
        accent="border-stone-200 bg-stone-50"
      />
      <Card className={`${missBg} border`}>
        <CardContent className="p-3">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider text-stone-600"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Miss %
          </div>
          <div
            className={`mt-1 text-2xl font-bold ${missColor}`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {summary.missRate.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-[11px] text-stone-600">
            {summary.missCount.toLocaleString('vi-VN')} alerts mở
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: number;
  sublabel: string;
  accent: string;
}) {
  return (
    <Card className={`border ${accent}`}>
      <CardContent className="p-3">
        <div
          className="text-[10px] font-semibold uppercase tracking-wider text-stone-600"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {label}
        </div>
        <div
          className="mt-1 text-2xl font-bold text-stone-900"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {value.toLocaleString('vi-VN')}
        </div>
        <div className="mt-0.5 text-[11px] text-stone-600">{sublabel}</div>
      </CardContent>
    </Card>
  );
}
