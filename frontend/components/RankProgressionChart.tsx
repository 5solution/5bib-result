'use client';

/**
 * F-01 — Rank Progression Chart.
 *
 * Visualises how an athlete's overall rank moved across checkpoints.
 * Y-axis is inverted (rank 1 on top) so "going up" means climbing positions.
 * DNF checkpoints (no rank) are skipped rather than rendered as a gap line.
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface RankProgressionSplit {
  name: string;
  distance?: string;
  overallRank?: string;
  rankDelta?: number;
}

interface Props {
  splits: RankProgressionSplit[];
  finalRank?: string | null;
}

interface DataPoint {
  checkpoint: string;
  distance: string;
  rank: number;
  delta: number;
}

const toNumeric = (r: string | undefined | null): number | null => {
  if (!r) return null;
  const n = parseInt(String(r).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function RankProgressionChart({ splits, finalRank }: Props) {
  const { t } = useTranslation();

  const { data, maxRank, trend } = useMemo(() => {
    const pts: DataPoint[] = [];
    for (const s of splits) {
      const rank = toNumeric(s.overallRank);
      if (rank === null) continue;
      pts.push({
        checkpoint: s.name,
        distance: s.distance ?? '',
        rank,
        delta: s.rankDelta ?? 0,
      });
    }

    // IMPORTANT: upstream data quirk — OverallRanks["Finish"] is the snapshot
    // taken at the instant the athlete crossed the finish line (useful for
    // live tracking), while OverallRank (finalRank) is the AUTHORITATIVE final
    // rank sorted by chip time. When races use wave starts, the two diverge:
    // a runner may cross the line 3rd-overall but have the fastest chip time
    // (rank 1). The big hero card shows `OverallRank`, so the chart MUST agree
    // — otherwise the finish dot silently contradicts the card and creates a
    // "kiện cáo" scenario. Override the last point with `finalRank` whenever
    // it's a valid numeric rank.
    const finalNumeric = toNumeric(finalRank ?? undefined);
    if (finalNumeric !== null && pts.length > 0) {
      const last = pts[pts.length - 1];
      if (last.rank !== finalNumeric) {
        const prev = pts.length >= 2 ? pts[pts.length - 2].rank : last.rank;
        pts[pts.length - 1] = {
          ...last,
          rank: finalNumeric,
          delta: prev - finalNumeric, // positive = climbed
        };
      }
    }

    const last = pts[pts.length - 1];
    const first = pts[0];
    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (first && last) {
      if (last.rank < first.rank) trend = 'up'; // lower number = better
      else if (last.rank > first.rank) trend = 'down';
    }

    const max = pts.reduce((m, p) => Math.max(m, p.rank), 0);
    return { data: pts, maxRank: max, trend };
  }, [splits, finalRank]);

  if (data.length < 2) return null; // need at least 2 points to draw a line

  const trendIcon =
    trend === 'up' ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : trend === 'down' ? (
      <TrendingDown className="h-4 w-4 text-red-600" />
    ) : (
      <Minus className="h-4 w-4 text-stone-500" />
    );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-stone-900">
          {t('athlete.rankProgression.title')}
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
          {trendIcon}
          {t(`athlete.rankProgression.trend.${trend}`)}
        </span>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              dataKey="checkpoint"
              tick={{ fontSize: 11, fill: '#57534e' }}
              axisLine={{ stroke: '#d6d3d1' }}
              tickLine={false}
            />
            <YAxis
              reversed
              domain={[1, Math.max(maxRank, 10)]}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#57534e' }}
              axisLine={{ stroke: '#d6d3d1' }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e7e5e4',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, _name, entry) => {
                const payload = entry?.payload as DataPoint | undefined;
                const delta = payload?.delta ?? 0;
                const suffix =
                  delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : '';
                return [
                  `#${value as number}${suffix}`,
                  t('athlete.rankProgression.rank'),
                ];
              }}
              labelFormatter={(label, payload) => {
                const d = (payload?.[0]?.payload as DataPoint | undefined)
                  ?.distance;
                return d ? `${String(label)} · ${d}` : String(label);
              }}
            />
            <ReferenceLine
              y={1}
              stroke="#ea580c"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <Line
              type="monotone"
              dataKey="rank"
              stroke="#1d4ed8"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 7 }}
            >
              <LabelList
                dataKey="rank"
                position="top"
                fontSize={10}
                fill="#1c1917"
                formatter={(label) => `#${label as number}`}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default RankProgressionChart;
