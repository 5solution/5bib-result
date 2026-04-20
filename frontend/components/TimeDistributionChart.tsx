'use client';

/**
 * F-03 — Time Distribution Histogram.
 *
 * Histogram of finish times for a course. Supports an optional highlight
 * marker (an athlete's chip time) so viewers can see where they landed
 * relative to the pack.
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
import { Loader2, Clock } from 'lucide-react';
import { useTimeDistribution } from '@/lib/api-hooks';

interface Props {
  courseId: string;
  /** Highlight a specific athlete's time (seconds) with a vertical marker */
  highlightSeconds?: number;
  /** Highlight label shown next to the marker */
  highlightLabel?: string;
}

function secondsToHms(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}m`;
}

export function TimeDistributionChart({
  courseId,
  highlightSeconds,
  highlightLabel,
}: Props) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useTimeDistribution(courseId);

  const chartData = useMemo(() => {
    if (!data?.buckets) return [];
    return data.buckets.map((b) => ({
      ...b,
      midpoint: (b.minSeconds + b.maxSeconds) / 2,
      label: `${secondsToHms(b.minSeconds)}–${secondsToHms(b.maxSeconds)}`,
    }));
  }, [data]);

  const highlightBucketIdx = useMemo(() => {
    if (!highlightSeconds || !data?.buckets) return -1;
    return data.buckets.findIndex(
      (b) =>
        highlightSeconds >= b.minSeconds && highlightSeconds <= b.maxSeconds,
    );
  }, [highlightSeconds, data]);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-stone-200 bg-white text-sm text-stone-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  if (error || !data || data.buckets.length === 0) {
    return null; // quiet no-render if no data
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-stone-600" />
            <h3 className="font-heading text-lg font-semibold text-stone-900">
              {t('stats.timeDistribution.title')}
            </h3>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {t('stats.timeDistribution.subtitle', {
              total: data.totalFinishers,
            })}
            {data.sampled && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                {t('stats.timeDistribution.sampled')}
              </span>
            )}
          </p>
        </div>

        <div className="hidden items-center gap-3 text-xs text-stone-600 sm:flex">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-stone-400">
              {t('stats.timeDistribution.fastest')}
            </div>
            <div className="font-mono font-semibold text-stone-900">
              {secondsToHms(data.minSeconds)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-stone-400">
              {t('stats.timeDistribution.avg')}
            </div>
            <div className="font-mono font-semibold text-stone-900">
              {secondsToHms(data.avgSeconds)}
            </div>
          </div>
        </div>
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#57534e' }}
              axisLine={{ stroke: '#d6d3d1' }}
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#57534e' }}
              axisLine={{ stroke: '#d6d3d1' }}
              tickLine={false}
              width={35}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e7e5e4',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, _name, entry) => {
                const pct =
                  (entry?.payload as { percentage: number } | undefined)
                    ?.percentage ?? 0;
                return [
                  `${value as number} (${pct}%)`,
                  t('stats.timeDistribution.athletes'),
                ];
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === highlightBucketIdx ? '#ea580c' : '#1d4ed8'}
                  fillOpacity={i === highlightBucketIdx ? 1 : 0.85}
                />
              ))}
            </Bar>
            {highlightSeconds && highlightSeconds > 0 && (
              <ReferenceLine
                x={
                  chartData[highlightBucketIdx]?.label ??
                  chartData[0]?.label
                }
                stroke="#ea580c"
                strokeWidth={2}
                label={{
                  value: highlightLabel ?? t('stats.timeDistribution.you'),
                  position: 'top',
                  fill: '#ea580c',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default TimeDistributionChart;
