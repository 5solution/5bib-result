"use client";

/**
 * F-062 Wave 3-2 NEW — Runner Summary 4 KPI strip (BR-SA-20f v3).
 *
 * Tab 4 Runner header: uniqueRunners + repeatRate + avgLeadTime + avgOrdersPerRunner
 * với delta MoM badges.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Users, Repeat, Clock, ShoppingBag, TrendingUp, TrendingDown } from "lucide-react";
import { useRunnerSummaryKpi } from "@/lib/analytics-hooks";

interface Props {
  from?: string;
  to?: string;
  month?: string;
  tenantId?: number;
}

function DeltaBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-xs text-stone-400">N/A</span>;
  const positive = pct >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        positive ? "text-emerald-700" : "text-red-700"
      }`}
    >
      <Icon className="h-3 w-3" />
      {(pct >= 0 ? "+" : "") + pct.toFixed(1) + "%"}
    </span>
  );
}

export function RunnerSummaryKpiStrip(props: Props) {
  const { data, isLoading } = useRunnerSummaryKpi(props);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-16 animate-pulse bg-stone-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const d = (data as {
    uniqueRunners: number;
    repeatRate: number;
    avgLeadTime: number | null;
    avgOrdersPerRunner: number;
    deltaMoM: {
      uniqueRunnersPct: number | null;
      repeatRatePct: number | null;
      avgLeadTimePct: number | null;
      avgOrdersPerRunnerPct: number | null;
    };
  }) || null;

  if (!d) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
        Không tải được Runner KPI.
      </div>
    );
  }

  const kpis = [
    {
      icon: Users,
      label: "VĐV duy nhất",
      value: new Intl.NumberFormat("vi-VN").format(d.uniqueRunners),
      delta: d.deltaMoM.uniqueRunnersPct,
      color: "text-blue-700",
    },
    {
      icon: Repeat,
      label: "Repeat rate",
      value: d.repeatRate.toFixed(1) + "%",
      delta: d.deltaMoM.repeatRatePct,
      color: "text-emerald-700",
    },
    {
      icon: Clock,
      label: "Avg lead time",
      value: d.avgLeadTime != null ? `${d.avgLeadTime.toFixed(1)} ngày` : "—",
      delta: d.deltaMoM.avgLeadTimePct,
      color: "text-amber-700",
    },
    {
      icon: ShoppingBag,
      label: "Đơn/runner",
      value: d.avgOrdersPerRunner.toFixed(2),
      delta: d.deltaMoM.avgOrdersPerRunnerPct,
      color: "text-orange-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg bg-stone-100 ${k.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <DeltaBadge pct={k.delta} />
              </div>
              <div className="text-xs text-stone-500 uppercase tracking-wide">
                {k.label}
              </div>
              <div className="text-xl font-bold text-stone-900 tabular-nums">
                {k.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
