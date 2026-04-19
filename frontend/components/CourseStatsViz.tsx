'use client';

/**
 * F-03 — Course Stats Visualisation wrapper.
 *
 * PRD BR-01: 5-card summary + finish-rate donut (Finished / DNF / DNS).
 * PRD BR-02: finish-rate badge (finished / started) coloured by tier.
 * PRD BR-03: time-distribution histogram with optional athlete highlight.
 */

import { useTranslation } from 'react-i18next';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  Target,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import TimeDistributionChart from './TimeDistributionChart';

interface Props {
  courseId: string;
  started?: number;
  finished?: number;
  dnf?: number;
  /** Optional; defaults to max(0, started − finished − dnf). */
  dns?: number;
  avgTime?: string;
  minTime?: string;
  highlightSeconds?: number;
  highlightLabel?: string;
}

const COLORS = {
  finished: '#16a34a',
  dnf: '#dc2626',
  dns: '#a8a29e',
} as const;

function finishRateTier(pct: number): { bg: string; fg: string } {
  if (pct >= 90) return { bg: 'bg-emerald-100', fg: 'text-emerald-700' };
  if (pct >= 75) return { bg: 'bg-blue-100', fg: 'text-blue-700' };
  if (pct >= 50) return { bg: 'bg-amber-100', fg: 'text-amber-700' };
  return { bg: 'bg-red-100', fg: 'text-red-700' };
}

export function CourseStatsViz({
  courseId,
  started,
  finished,
  dnf,
  dns,
  avgTime,
  minTime,
  highlightSeconds,
  highlightLabel,
}: Props) {
  const { t } = useTranslation();

  const startedNum = typeof started === 'number' ? started : 0;
  const finishedNum = typeof finished === 'number' ? finished : 0;
  const dnfNum = typeof dnf === 'number' ? dnf : 0;
  const dnsNum =
    typeof dns === 'number'
      ? dns
      : Math.max(0, startedNum - finishedNum - dnfNum);

  const finishRate =
    startedNum > 0 ? Math.round((finishedNum / startedNum) * 100) : 0;
  const rateTier = finishRateTier(finishRate);

  const pieData = [
    {
      key: 'finished',
      name: t('stats.cards.finished'),
      value: finishedNum,
      color: COLORS.finished,
    },
    {
      key: 'dnf',
      name: t('stats.cards.dnf'),
      value: dnfNum,
      color: COLORS.dnf,
    },
    {
      key: 'dns',
      name: t('stats.cards.dns'),
      value: dnsNum,
      color: COLORS.dns,
    },
  ].filter((d) => d.value > 0);

  const hasPie = pieData.length > 0 && startedNum > 0;

  const cards = [
    {
      key: 'started',
      icon: Users,
      value: started ?? '—',
      label: t('stats.cards.started'),
      color: 'text-stone-600',
      bg: 'bg-stone-50',
    },
    {
      key: 'finished',
      icon: CheckCircle2,
      value: finished ?? '—',
      label: t('stats.cards.finished'),
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      key: 'dnf',
      icon: XCircle,
      value: dnf ?? '—',
      label: t('stats.cards.dnf'),
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      key: 'avg',
      icon: Clock,
      value: avgTime ?? '—',
      label: t('stats.cards.avgTime'),
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      key: 'best',
      icon: Trophy,
      value: minTime ?? '—',
      label: t('stats.cards.bestTime'),
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.key}
              className={`rounded-2xl border border-stone-200 ${c.bg} p-4 shadow-sm`}
            >
              <Icon className={`mb-2 h-5 w-5 ${c.color}`} />
              <div className="font-mono text-xl font-bold text-stone-900">
                {c.value}
              </div>
              <div className="mt-0.5 text-xs text-stone-600">{c.label}</div>
            </div>
          );
        })}
      </div>

      {hasPie && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-stone-600" />
              <h3 className="font-heading text-lg font-semibold text-stone-900">
                {t('stats.finishRate.title')}
              </h3>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${rateTier.bg} ${rateTier.fg}`}
            >
              {t('stats.finishRate.label')}{' '}
              <span className="font-mono">{finishRate}%</span>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e7e5e4',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => {
                    const v = Number(value);
                    const pct =
                      startedNum > 0
                        ? `${Math.round((v / startedNum) * 100)}%`
                        : '';
                    return [`${v} (${pct})`, String(name)];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={24}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <TimeDistributionChart
        courseId={courseId}
        highlightSeconds={highlightSeconds}
        highlightLabel={highlightLabel}
      />
    </div>
  );
}

export default CourseStatsViz;
