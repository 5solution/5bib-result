'use client';

/**
 * F-02 — Pace Zone Analysis.
 *
 * Bar chart of per-segment pace, colour-coded into zones relative to the
 * athlete's average pace. Segments flagged as isPaceAlert (backend BR-02)
 * are highlighted red.
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
  avgPace?: string; // e.g. "5:30/km" — optional, falls back to computed
}

interface DataPoint {
  checkpoint: string;
  paceSeconds: number;
  paceLabel: string;
  zone: 'fast' | 'steady' | 'slow' | 'alert';
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

const ZONE_COLOR: Record<DataPoint['zone'], string> = {
  fast: '#16a34a',    // green — faster than avg
  steady: '#1d4ed8',  // blue — at avg
  slow: '#f59e0b',    // amber — slower but not alert
  alert: '#dc2626',   // red — backend flagged
};

export function PaceZoneChart({ splits, avgPace }: Props) {
  const { t } = useTranslation();

  const { data, avgSeconds, strategy } = useMemo((): {
    data: DataPoint[];
    avgSeconds: number;
    strategy: 'even' | 'negative' | 'positive' | null;
  } => {
    const pts: DataPoint[] = [];
    const paceSecs: number[] = [];

    for (const s of splits) {
      const secs = paceToSeconds(s.pace);
      if (secs === null || secs <= 0) continue;
      paceSecs.push(secs);
    }

    if (paceSecs.length === 0)
      return { data: pts, avgSeconds: 0, strategy: null };

    const providedAvg = paceToSeconds(avgPace);
    const avg =
      providedAvg && providedAvg > 0
        ? providedAvg
        : Math.round(paceSecs.reduce((a, b) => a + b, 0) / paceSecs.length);

    for (const s of splits) {
      const secs = paceToSeconds(s.pace);
      if (secs === null || secs <= 0) continue;

      // PRD F-02 BR-01 zones: green (on pace ≤ avg×1.05), yellow (≤ avg×1.20),
      // red (> avg×1.20 OR backend-flagged isPaceAlert). We extend with a
      // "fast" (< avg×0.95) sub-category for richer UX — still a subset of
      // the PRD green zone by strict definition.
      let zone: DataPoint['zone'];
      if (s.isPaceAlert || secs > avg * 1.2) zone = 'alert';
      else if (secs > avg * 1.05) zone = 'slow';
      else if (secs < avg * 0.95) zone = 'fast';
      else zone = 'steady';

      pts.push({
        checkpoint: s.name,
        paceSeconds: secs,
        paceLabel: secondsToPace(secs),
        zone,
      });
    }

    // PRD F-02 BR-02 — split strategy badge
    // Even: max-min < 30s/km (0.5 min/km)
    // Negative: last half avg faster than first half
    // Positive: last half >= first half + 18s/km (0.3 min/km)
    let strategy: 'even' | 'negative' | 'positive' | null = null;
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

      if (max - min < 30) strategy = 'even';
      else if (lastAvg > firstAvg + 18) strategy = 'positive';
      else if (lastAvg < firstAvg) strategy = 'negative';
    }

    return { data: pts, avgSeconds: avg, strategy };
  }, [splits, avgPace]);

  if (data.length < 2) return null;

  const zoneCounts = data.reduce(
    (acc, d) => ({ ...acc, [d.zone]: acc[d.zone] + 1 }),
    { fast: 0, steady: 0, slow: 0, alert: 0 },
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-lg font-semibold text-stone-900">
            {t('athlete.paceZone.title')}
          </h3>
          {strategy && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                strategy === 'even'
                  ? 'bg-emerald-100 text-emerald-700'
                  : strategy === 'negative'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {t(`athlete.paceZone.strategy.${strategy}`)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(['fast', 'steady', 'slow', 'alert'] as const).map((z) =>
            zoneCounts[z] > 0 ? (
              <span
                key={z}
                className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-stone-700"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ZONE_COLOR[z] }}
                />
                {t(`athlete.paceZone.zones.${z}`)}: {zoneCounts[z]}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
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
              width={60}
              reversed
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
                return [p.paceLabel, t(`athlete.paceZone.zones.${p.zone}`)];
              }}
            />
            {avgSeconds > 0 && (
              <ReferenceLine
                y={avgSeconds}
                stroke="#1d4ed8"
                strokeDasharray="4 4"
                label={{
                  value: `${t('athlete.paceZone.avg')} ${secondsToPace(avgSeconds)}`,
                  position: 'right',
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
