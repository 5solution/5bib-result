'use client';

/**
 * F-06 — Performance Percentile.
 *
 * SEMANTIC (v2, 2026-04-20): `percentile` is now "Top X%" — LOWER = faster.
 * The fastest runner on a course is at Top 1%, the slowest at Top 100%.
 * This matches conventional running terminology and reverses the v1 meaning
 * ("% of finishers I beat"). Backend returns the same field name but with
 * inverted semantics; tier thresholds and gauge marker math are inverted
 * accordingly.
 *
 * PRD BR-02: gauge bar green→blue gradient; marker LEFT = better (top 1%).
 * PRD BR-03: comparison bars — You vs Average vs Fastest.
 * PRD BR-04: finishers only — hook returns null percentile for DNF; we hide.
 *
 * Exports:
 *  - <PercentileBadge/>  — compact pill badge (hero area)
 *  - <PercentileGauge/>  — full panel: badge + gauge + comparison bars
 */

import { useTranslation } from 'react-i18next';
import { Award, Flame, Medal, Sparkles } from 'lucide-react';
import { usePercentile } from '@/lib/api-hooks';

interface Props {
  raceId: string;
  bib: string;
}

/**
 * Tier thresholds use the "Top X%" semantic (lower = better).
 *   p ≤ 10  → Elite   (Top 10%)
 *   p ≤ 25  → Strong  (Top 25%)
 *   p ≤ 50  → Solid   (Top 50%)
 *   else    → Midpack (bottom half)
 * i18n keys kept stable (top10/top25/top50/midpack) so translation files
 * don't need a schema change.
 */
function tierOf(p: number): {
  label: string;
  bg: string;
  fg: string;
  Icon: typeof Award;
} {
  if (p <= 10)
    return {
      label: 'top10',
      bg: 'bg-gradient-to-r from-amber-400 to-orange-500',
      fg: 'text-white',
      Icon: Flame,
    };
  if (p <= 25)
    return {
      label: 'top25',
      bg: 'bg-gradient-to-r from-blue-500 to-indigo-500',
      fg: 'text-white',
      Icon: Medal,
    };
  if (p <= 50)
    return {
      label: 'top50',
      bg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      fg: 'text-white',
      Icon: Sparkles,
    };
  return {
    label: 'midpack',
    bg: 'bg-stone-100',
    fg: 'text-stone-700',
    Icon: Award,
  };
}

function secondsToHms(s: number): string {
  if (!s || s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function PercentileBadge({ raceId, bib }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = usePercentile(raceId, bib);

  if (isLoading || !data) return null;
  if (data.percentile === null) return null;
  if (data.totalFinishers < 5) return null;

  const tier = tierOf(data.percentile);
  const Icon = tier.Icon;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ${tier.bg} ${tier.fg}`}
    >
      <Icon className="h-4 w-4" />
      <span>
        {t('athlete.percentile.label')}{' '}
        <strong className="font-mono">{data.percentile}%</strong>
      </span>
      <span className="text-xs opacity-80">
        · {t(`athlete.percentile.tier.${tier.label}`)}
      </span>
    </div>
  );
}

export function PercentileGauge({ raceId, bib }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = usePercentile(raceId, bib);

  if (isLoading || !data) return null;
  if (data.percentile === null) return null;
  if (data.totalFinishers < 5) return null;

  const p = data.percentile;
  const tier = tierOf(p);
  const Icon = tier.Icon;

  // Comparison bar widths: longer bar = slower time.
  const maxSec = Math.max(
    data.athleteSeconds,
    data.avgSeconds,
    data.minSeconds,
    1,
  );
  const pct = (s: number) => (s > 0 ? Math.max(5, (s / maxSec) * 100) : 0);

  const comparison = [
    {
      key: 'you',
      label: t('athlete.percentile.compare.you'),
      seconds: data.athleteSeconds,
      color: 'bg-gradient-to-r from-orange-400 to-orange-600',
      emphasis: true,
    },
    {
      key: 'avg',
      label: t('athlete.percentile.compare.avg'),
      seconds: data.avgSeconds,
      color: 'bg-stone-400',
      emphasis: false,
    },
    {
      key: 'fastest',
      label: t('athlete.percentile.compare.fastest'),
      seconds: data.minSeconds,
      color: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
      emphasis: false,
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-stone-600" />
          <h3 className="font-heading text-lg font-semibold text-stone-900">
            {t('athlete.percentile.panel.title')}
          </h3>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tier.bg} ${tier.fg}`}
        >
          {t('athlete.percentile.label')}{' '}
          <span className="font-mono">{p}%</span>
        </div>
      </div>

      {/* Gauge bar — PRD BR-02.
          Semantics (v2): Top 1% = left (best, emerald) → Top 100% = right
          (worst, indigo). Marker position uses `p` directly so smaller p
          visually anchors toward the "better" side. */}
      <div className="mb-5">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-600"
            style={{ width: '100%' }}
          />
          <div
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-stone-900 shadow-md"
            style={{ left: `${Math.max(2, Math.min(98, p))}%` }}
            aria-label={`Top ${p}%`}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-stone-400">
          <span>Top 1%</span>
          <span>Top 50%</span>
          <span>Top 100%</span>
        </div>
        <p className="mt-2 text-sm text-stone-600">
          {t('athlete.percentile.summary', {
            pct: p,
            count: data.slowerCount,
            total: data.totalFinishers,
          })}
        </p>
      </div>

      {/* Comparison bars — PRD BR-03 */}
      <div className="space-y-3">
        {comparison.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span
                className={`font-medium ${
                  row.emphasis ? 'text-orange-700' : 'text-stone-700'
                }`}
              >
                {row.label}
              </span>
              <span className="font-mono font-semibold text-stone-900">
                {secondsToHms(row.seconds)}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full rounded-full ${row.color}`}
                style={{ width: `${pct(row.seconds)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PercentileBadge;
