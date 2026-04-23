'use client';

/**
 * F-06 — Performance Percentile.
 *
 * SEMANTIC (v2, 2026-04-20): `percentile` is "Top X%" — LOWER = faster.
 * The fastest runner on a course is at Top 1%, the slowest at Top 100%.
 *
 * Special cases:
 * - Athlete IS the fastest (athleteSeconds === minSeconds):
 *     → badge shows "🏆 #1", summary says "Về đích đầu tiên...", hide redundant
 *       "Nhanh nhất" row (it would be identical to "Bạn").
 *     → display percentile capped at 1 (never show "Top 2%" for rank-1).
 * - Always show gap-to-average commentary as a second insight line.
 *
 * Exports:
 *  - <PercentileBadge/>  — compact pill badge (hero area)
 *  - <PercentileGauge/>  — full panel: badge + gauge + comparison bars + insights
 */

import { useTranslation } from 'react-i18next';
import { Award, Flame, Medal, Sparkles, Trophy } from 'lucide-react';
import { usePercentile } from '@/lib/api-hooks';

interface Props {
  raceId: string;
  bib: string;
  /** Khi true (enablePrivateList): ẩn số tuyệt đối "X/Y VĐV", chỉ hiện "top X%" */
  hideAbsoluteCounts?: boolean;
}

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

/** Format a seconds difference as "Xh Ym" or "Ym" — always positive. */
function formatGap(diffSec: number): string {
  const abs = Math.abs(Math.round(diffSec));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  if (h > 0 && m > 0) return `${h}g ${m}p`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
}

/** Build insight lines based on performance relative to field. */
function buildInsights(
  isRankOne: boolean,
  athleteSeconds: number,
  avgSeconds: number,
  minSeconds: number,
  totalFinishers: number,
  lang: string,
  p: number,
  hideAbsoluteCounts = false,
): string[] {
  const vi = lang.startsWith('vi');
  const insights: string[] = [];

  // 1. Rank-1 / fastest highlight
  if (isRankOne) {
    insights.push(
      hideAbsoluteCounts
        ? (vi ? `🏆 Bạn là VĐV về đích đầu tiên cự ly này.` : `🏆 You crossed the finish line first in this course.`)
        : (vi
            ? `🏆 Bạn là VĐV về đích đầu tiên trong số ${totalFinishers} người hoàn thành cự ly này.`
            : `🏆 You crossed the finish line first among all ${totalFinishers} finishers.`),
    );
  }

  // 2. Gap to average
  if (avgSeconds > 0 && athleteSeconds > 0) {
    const diff = avgSeconds - athleteSeconds;
    if (diff > 60) {
      // athlete is faster than average
      insights.push(
        vi
          ? `⚡ Nhanh hơn trung bình ${formatGap(diff)} (trung bình: ${secondsToHms(avgSeconds)}).`
          : `⚡ ${formatGap(diff)} faster than the field average (avg: ${secondsToHms(avgSeconds)}).`,
      );
    } else if (diff < -60) {
      // athlete is slower than average
      const gap = formatGap(-diff);
      insights.push(
        vi
          ? `Chậm hơn trung bình ${gap} — vẫn còn tiềm năng cải thiện thành tích.`
          : `${gap} behind the field average — great target to beat next time.`,
      );
    } else {
      insights.push(
        vi
          ? `Thành tích của bạn sát với mức trung bình của cự ly.`
          : `Your finish time is right on par with the field average.`,
      );
    }
  }

  // 3. Gap to fastest (only if athlete is NOT rank-1)
  if (!isRankOne && minSeconds > 0 && athleteSeconds > 0) {
    const behindLeader = athleteSeconds - minSeconds;
    if (behindLeader > 0) {
      insights.push(
        vi
          ? `📍 Cách VĐV nhanh nhất ${formatGap(behindLeader)} (${secondsToHms(minSeconds)}).`
          : `📍 ${formatGap(behindLeader)} behind the fastest finisher (${secondsToHms(minSeconds)}).`,
      );
    }
  }

  // 4. Top-tier congratulation (only for non rank-1, who already got #1 message)
  if (!isRankOne && p <= 5) {
    insights.push(
      vi
        ? `🔥 Top 5% — đẳng cấp Elite hiếm có.`
        : `🔥 Top 5% — truly elite performance.`,
    );
  } else if (!isRankOne && p <= 10) {
    insights.push(
      vi
        ? `Thành tích top 10% là mức mà phần lớn VĐV mơ ước.`
        : `A top-10% finish is a benchmark most runners aspire to.`,
    );
  }

  return insights;
}

export function PercentileBadge({ raceId, bib }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = usePercentile(raceId, bib);

  if (isLoading || !data) return null;
  if (data.percentile === null) return null;
  if (data.totalFinishers < 5) return null;

  const isRankOne = data.athleteSeconds > 0 && data.athleteSeconds === data.minSeconds;
  // Cap display percentile at 1 when athlete IS the fastest (avoid "Top 2%" for rank-1)
  const displayPct = isRankOne ? 1 : data.percentile;
  const tier = tierOf(displayPct);
  const Icon = isRankOne ? Trophy : tier.Icon;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ${
        isRankOne
          ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'
          : `${tier.bg} ${tier.fg}`
      }`}
    >
      <Icon className="h-4 w-4" />
      {isRankOne ? (
        <span>🏆 #1 Nhanh nhất</span>
      ) : (
        <>
          <span>
            {t('athlete.percentile.label')}{' '}
            <strong className="font-mono">{displayPct}%</strong>
          </span>
          <span className="text-xs opacity-80">
            · {t(`athlete.percentile.tier.${tier.label}`)}
          </span>
        </>
      )}
    </div>
  );
}

export function PercentileGauge({ raceId, bib, hideAbsoluteCounts = false }: Props) {
  const { i18n, t } = useTranslation();
  const { data, isLoading } = usePercentile(raceId, bib);

  if (isLoading || !data) return null;
  if (data.percentile === null) return null;
  if (data.totalFinishers < 5) return null;

  const isRankOne = data.athleteSeconds > 0 && data.athleteSeconds === data.minSeconds;
  const displayPct = isRankOne ? 1 : data.percentile;
  const tier = tierOf(displayPct);
  const Icon = isRankOne ? Trophy : tier.Icon;
  const lang = i18n.language ?? 'vi';

  // Gauge marker — cap at 2px from left so rank-1 is visually at left edge
  const markerLeft = isRankOne ? 2 : Math.max(2, Math.min(98, displayPct));

  // Comparison bars — longer bar = slower. Exclude "fastest" row if athlete IS fastest.
  const maxSec = Math.max(data.athleteSeconds, data.avgSeconds, data.minSeconds, 1);
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
    // Only show "fastest" row when athlete is NOT rank-1 (otherwise it's identical to "you")
    ...(!isRankOne
      ? [
          {
            key: 'fastest',
            label: t('athlete.percentile.compare.fastest'),
            seconds: data.minSeconds,
            color: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
            emphasis: false,
          },
        ]
      : []),
  ];

  const insights = buildInsights(
    isRankOne,
    data.athleteSeconds,
    data.avgSeconds,
    data.minSeconds,
    data.totalFinishers,
    lang,
    displayPct,
    hideAbsoluteCounts,
  );

  // Summary line: different wording for rank-1 vs others, private vs public
  const summaryLine = isRankOne
    ? (hideAbsoluteCounts
        ? (lang.startsWith('vi') ? `Về đích đầu tiên cự ly này.` : `First across the finish line in this course.`)
        : (lang.startsWith('vi')
            ? `Về đích đầu tiên trong số ${data.totalFinishers} VĐV hoàn thành.`
            : `First across the finish line among ${data.totalFinishers} finishers.`))
    : (hideAbsoluteCounts
        ? t('athlete.percentile.summaryPrivate', { pct: displayPct })
        : t('athlete.percentile.summary', {
            pct: displayPct,
            count: data.slowerCount,
            total: data.totalFinishers,
          }));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-stone-600" />
          <h3 className="font-heading text-lg font-semibold text-stone-900">
            {t('athlete.percentile.panel.title')}
          </h3>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            isRankOne
              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'
              : `${tier.bg} ${tier.fg}`
          }`}
        >
          {isRankOne ? (
            <span>🏆 #1</span>
          ) : (
            <>
              {t('athlete.percentile.label')}{' '}
              <span className="font-mono">{displayPct}%</span>
            </>
          )}
        </div>
      </div>

      {/* Gauge bar */}
      <div className="mb-5">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-600"
            style={{ width: '100%' }}
          />
          <div
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-stone-900 shadow-md"
            style={{ left: `${markerLeft}%` }}
            aria-label={isRankOne ? '#1' : `Top ${displayPct}%`}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-stone-400">
          <span>Top 1%</span>
          <span>Top 50%</span>
          <span>Top 100%</span>
        </div>

        {/* Summary line */}
        <p className="mt-2 text-sm text-stone-600">{summaryLine}</p>

        {/* Insight lines */}
        {insights.length > 0 && (
          <ul className="mt-2 space-y-1">
            {insights.map((line, i) => (
              <li key={i} className="text-sm text-stone-500">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Comparison bars */}
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
