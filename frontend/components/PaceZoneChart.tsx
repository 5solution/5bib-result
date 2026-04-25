'use client';

/**
 * F-02 — Pace Zone Analysis.
 *
 * Bar chart of per-segment pace, colour-coded into zones relative to the
 * athlete's average pace. Segments flagged as isPaceAlert (backend BR-02)
 * are highlighted red.
 *
 * v2 fixes (2026-04-20):
 *  - Avg bias → use MEDIAN when provided avg is missing (robust to outliers)
 *  - Negative split threshold symmetric (`lastAvg < firstAvg - 18`)
 *  - New "erratic" strategy for high-variance runs with no clear trend
 *  - Legend shows ALL 4 zones with count (incl. zeros)
 *  - Adaptive thresholds scale with distance (5K stricter, ultra looser)
 *  - "alert" zone renamed → "Sụt tốc" / "Fade" (clearer than "Cảnh báo")
 *  - YAxis no longer `reversed`: taller bar = slower, with explicit caption
 *  - Richer tooltip: distance + % vs avg
 *  - ReferenceLine label anchored inside plot area (no overflow)
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import { useTranslation } from 'react-i18next';

export interface PaceZoneSplit {
  name: string;
  distance?: string;
  pace?: string;
  isPaceAlert?: boolean;
}

interface Props {
  splits: PaceZoneSplit[];
  avgPace?: string; // "5:30/km" — when provided overrides computed median
  distanceKm?: number; // total race distance — enables adaptive thresholds
}

type Zone = 'fast' | 'steady' | 'slow' | 'alert';
type Strategy = 'even' | 'negative' | 'positive' | 'erratic';

interface DataPoint {
  checkpoint: string;
  distance: string;
  paceSeconds: number;
  paceLabel: string;
  deltaPct: number; // signed % vs avg. negative = faster.
  zone: Zone;
}

// "5:30/km" → 330, "1:02:30/km" → 3750. Returns null if unparsable.
function paceToSeconds(p: string | undefined | null): number | null {
  if (!p) return null;
  const raw = String(p).replace(/[^\d:]/g, '');
  const parts = raw.split(':').map((x) => parseInt(x, 10));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function secondsToPace(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}/km`;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid];
}

/**
 * Adaptive thresholds. Short races are paced tighter; ultras swing more.
 *  steady band: ±steadyPct   (default 5%)
 *  slow  band: +steadyPct … +alertPct
 *  alert     : > +alertPct OR backend-flagged
 * Strategy thresholds scale too.
 */
function thresholdsFor(distanceKm: number | undefined): {
  steadyPct: number;
  alertPct: number;
  evenRangeSec: number; // max-min below this → "even"
  splitDeltaSec: number; // |lastAvg-firstAvg| above this = clear split
} {
  const km = distanceKm ?? 21;
  if (km <= 10) return { steadyPct: 0.04, alertPct: 0.15, evenRangeSec: 20, splitDeltaSec: 12 };
  if (km <= 25) return { steadyPct: 0.05, alertPct: 0.2, evenRangeSec: 30, splitDeltaSec: 18 };
  if (km <= 50) return { steadyPct: 0.07, alertPct: 0.25, evenRangeSec: 45, splitDeltaSec: 25 };
  return { steadyPct: 0.1, alertPct: 0.3, evenRangeSec: 75, splitDeltaSec: 40 };
}

const ZONE_COLOR: Record<Zone, string> = {
  fast: '#16a34a', // green
  steady: '#1d4ed8', // blue
  slow: '#f59e0b', // amber
  alert: '#dc2626', // red
};

export function PaceZoneChart({ splits, avgPace, distanceKm }: Props) {
  const { t } = useTranslation();

  const { data, avgSeconds, strategy, zoneCounts } = useMemo((): {
    data: DataPoint[];
    avgSeconds: number;
    strategy: Strategy | null;
    zoneCounts: Record<Zone, number>;
  } => {
    const pts: DataPoint[] = [];
    const paceSecs: number[] = [];
    const th = thresholdsFor(distanceKm);

    for (const s of splits) {
      const secs = paceToSeconds(s.pace);
      if (secs === null || secs <= 0) continue;
      paceSecs.push(secs);
    }

    if (paceSecs.length === 0) {
      return {
        data: pts,
        avgSeconds: 0,
        strategy: null,
        zoneCounts: { fast: 0, steady: 0, slow: 0, alert: 0 },
      };
    }

    const providedAvg = paceToSeconds(avgPace);
    // Prefer caller-provided avg (usually the athlete's overall Pace field).
    // Fall back to MEDIAN of segment paces — robust against one-off blow-ups
    // that would otherwise drag a mean and mis-classify the rest.
    const avg = providedAvg && providedAvg > 0 ? providedAvg : median(paceSecs);

    for (const s of splits) {
      const secs = paceToSeconds(s.pace);
      if (secs === null || secs <= 0) continue;

      const deltaPct = (secs - avg) / avg;
      let zone: Zone;
      if (s.isPaceAlert || deltaPct > th.alertPct) zone = 'alert';
      else if (deltaPct > th.steadyPct) zone = 'slow';
      else if (deltaPct < -th.steadyPct) zone = 'fast';
      else zone = 'steady';

      pts.push({
        checkpoint: s.name,
        distance: s.distance ?? '',
        paceSeconds: secs,
        paceLabel: secondsToPace(secs),
        deltaPct: Math.round(deltaPct * 1000) / 10, // one decimal
        zone,
      });
    }

    // Split strategy
    //   even:     max-min < evenRangeSec
    //   negative: lastAvg < firstAvg - splitDeltaSec  (sped up)
    //   positive: lastAvg > firstAvg + splitDeltaSec  (slowed down)
    //   erratic:  high range but neither half dominates → bouncing
    let strategyOut: Strategy | null = null;
    if (paceSecs.length >= 2) {
      const max = Math.max(...paceSecs);
      const min = Math.min(...paceSecs);
      const mid = Math.floor(paceSecs.length / 2);
      const firstHalf = paceSecs.slice(0, mid);
      const lastHalf = paceSecs.slice(mid);
      const firstAvg = firstHalf.length
        ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        : 0;
      const lastAvg = lastHalf.length
        ? lastHalf.reduce((a, b) => a + b, 0) / lastHalf.length
        : 0;
      const diff = lastAvg - firstAvg;

      if (max - min < th.evenRangeSec) strategyOut = 'even';
      else if (diff > th.splitDeltaSec) strategyOut = 'positive';
      else if (diff < -th.splitDeltaSec) strategyOut = 'negative';
      else strategyOut = 'erratic';
    }

    const counts = pts.reduce(
      (acc, d) => ({ ...acc, [d.zone]: acc[d.zone] + 1 }),
      { fast: 0, steady: 0, slow: 0, alert: 0 } as Record<Zone, number>,
    );

    return { data: pts, avgSeconds: avg, strategy: strategyOut, zoneCounts: counts };
  }, [splits, avgPace, distanceKm]);

  if (data.length < 2) return null;

  const strategyBadgeClass: Record<Strategy, string> = {
    even: 'bg-emerald-100 text-emerald-700',
    negative: 'bg-blue-100 text-blue-700',
    positive: 'bg-amber-100 text-amber-700',
    erratic: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-lg font-semibold text-stone-900">
            {t('athlete.paceZone.title')}
          </h3>
          {strategy && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${strategyBadgeClass[strategy]}`}
            >
              {t(`athlete.paceZone.strategy.${strategy}`)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(['fast', 'steady', 'slow', 'alert'] as const).map((z) => (
            <span
              key={z}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                zoneCounts[z] > 0
                  ? 'bg-stone-100 text-stone-700'
                  : 'bg-stone-50 text-stone-400'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: ZONE_COLOR[z],
                  opacity: zoneCounts[z] > 0 ? 1 : 0.4,
                }}
              />
              {t(`athlete.paceZone.zones.${z}`)}: {zoneCounts[z]}
            </span>
          ))}
        </div>
      </div>

      <p className="mb-2 text-[11px] text-stone-400">
        {t('athlete.paceZone.axisHint')}
      </p>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 12, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              dataKey="checkpoint"
              tick={{ fontSize: 11, fill: '#57534e' }}
              axisLine={{ stroke: '#d6d3d1' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#57534e' }}
              axisLine={{ stroke: '#d6d3d1' }}
              tickLine={false}
              tickFormatter={(v: number) => secondsToPace(v)}
              width={64}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e7e5e4',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(_value, _name, entry) => {
                const p = entry?.payload as DataPoint | undefined;
                if (!p) return ['', ''];
                const deltaLabel =
                  p.deltaPct > 0
                    ? `+${p.deltaPct}% ${t('athlete.paceZone.vsAvgSlower')}`
                    : p.deltaPct < 0
                      ? `${p.deltaPct}% ${t('athlete.paceZone.vsAvgFaster')}`
                      : t('athlete.paceZone.vsAvgEqual');
                return [
                  `${p.paceLabel} · ${deltaLabel}`,
                  t(`athlete.paceZone.zones.${p.zone}`),
                ];
              }}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as DataPoint | undefined;
                return p?.distance ? `${String(label)} · ${p.distance}` : String(label);
              }}
            />
            {avgSeconds > 0 && (
              <ReferenceLine
                y={avgSeconds}
                stroke="#1d4ed8"
                strokeDasharray="4 4"
                label={{
                  value: `${t('athlete.paceZone.avg')} ${secondsToPace(avgSeconds)}`,
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: '#1d4ed8',
                }}
              />
            )}
            <Bar dataKey="paceSeconds" radius={[6, 6, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={ZONE_COLOR[d.zone]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PaceZoneChart;
