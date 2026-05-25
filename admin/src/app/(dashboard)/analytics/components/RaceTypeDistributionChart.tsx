"use client";

/**
 * F-062 Wave 3-2 NEW — Race Type Distribution horizontal bar chart (BR-SA-21a).
 *
 * GMV by race type — sorted descending. count + gmv + avgGmv per type.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRaceTypeDistribution } from "@/lib/analytics-hooks";

interface Props {
  from?: string;
  to?: string;
  month?: string;
  tenantId?: number;
}

const TYPE_LABEL: Record<string, string> = {
  ROAD_MARATHON: "Road Marathon",
  ROAD_HALF_MARATHON: "Road Half Marathon",
  ULTRA_TRAIL_RACE: "Ultra Trail",
  TRAIL_RACE: "Trail",
  OTHER: "Khác",
};

const TYPE_COLOR: Record<string, string> = {
  ROAD_MARATHON: "bg-blue-500",
  ROAD_HALF_MARATHON: "bg-sky-500",
  ULTRA_TRAIL_RACE: "bg-amber-600",
  TRAIL_RACE: "bg-emerald-600",
  OTHER: "bg-stone-400",
};

function fmtVnd(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B ₫";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M ₫";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
}

export function RaceTypeDistributionChart(props: Props) {
  const { data, isLoading } = useRaceTypeDistribution(props);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="h-48 animate-pulse bg-stone-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  const rows = (Array.isArray(data) ? data : []) as Array<{
    raceType: string;
    count: number;
    gmv: number;
    avgGmv: number;
  }>;
  const sorted = [...rows].sort((a, b) => b.gmv - a.gmv);
  const maxGmv = Math.max(1, ...sorted.map((r) => r.gmv));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">GMV theo loại race</CardTitle>
        <p className="text-xs text-stone-500">BR-SA-21a — Phân bố GMV theo race_type</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-sm text-stone-500">Không có dữ liệu trong kỳ.</p>
        )}
        {sorted.map((r) => {
          const widthPct = (r.gmv / maxGmv) * 100;
          return (
            <div key={r.raceType}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-stone-700">
                  {TYPE_LABEL[r.raceType] ?? r.raceType}
                  <span className="text-xs text-stone-400 ml-2">
                    ({r.count} giải · TB {fmtVnd(r.avgGmv)}/giải)
                  </span>
                </div>
                <div className="text-sm font-bold tabular-nums text-stone-900">
                  {fmtVnd(r.gmv)}
                </div>
              </div>
              <div className="h-3 bg-stone-100 rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${TYPE_COLOR[r.raceType] ?? "bg-stone-400"}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
