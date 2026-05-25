"use client";

/**
 * F-062 Wave 3-2 NEW — Comparison Row (BR-SA-04 v3).
 *
 * 4 KPI cards comparing current vs previous period với delta % badge.
 * Used trong Tab 1 Tổng quan section "So sánh kỳ".
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useRevenueComparison } from "@/lib/analytics-hooks";

interface Props {
  from?: string;
  to?: string;
  month?: string;
  tenantId?: number;
  compareWith?: "wow" | "mom" | "yoy";
}

function fmtVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function DeltaBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) {
    return (
      <span className="inline-flex items-center gap-1 text-stone-400 text-xs">
        <Minus className="h-3 w-3" /> N/A
      </span>
    );
  }
  const positive = pct >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        positive ? "text-emerald-700" : "text-red-700"
      }`}
    >
      <Icon className="h-3 w-3" />
      {fmtPct(pct)}
    </span>
  );
}

export function ComparisonRow(props: Props) {
  const { data, isLoading, error } = useRevenueComparison({
    from: props.from,
    to: props.to,
    month: props.month,
    tenantId: props.tenantId,
    compareWith: props.compareWith ?? "mom",
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-24 animate-pulse bg-stone-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
        Không tải được dữ liệu so sánh: {(error as Error)?.message ?? "unknown"}
      </div>
    );
  }

  const cur = data.current as { label?: string; gmv: number; netGmv: number; platformFee: number; orderCount: number };
  const prev = data.previous as { label?: string; gmv: number; netGmv: number; platformFee: number; orderCount: number };
  const delta = data.delta as { gmvPct: number | null; netGmvPct: number | null; platformFeePct: number | null; orderCountPct: number | null };

  const metrics: Array<{ label: string; cur: string; prev: string; deltaPct: number | null }> = [
    { label: "GMV", cur: fmtVnd(cur.gmv), prev: fmtVnd(prev.gmv), deltaPct: delta.gmvPct },
    { label: "Net GMV", cur: fmtVnd(cur.netGmv), prev: fmtVnd(prev.netGmv), deltaPct: delta.netGmvPct },
    { label: "Phí 5BIB", cur: fmtVnd(cur.platformFee), prev: fmtVnd(prev.platformFee), deltaPct: delta.platformFeePct },
    {
      label: "Số đơn",
      cur: new Intl.NumberFormat("vi-VN").format(cur.orderCount),
      prev: new Intl.NumberFormat("vi-VN").format(prev.orderCount),
      deltaPct: delta.orderCountPct,
    },
  ];

  return (
    <div>
      <div className="text-xs text-stone-500 mb-2">
        So sánh{" "}
        <span className="font-medium text-stone-900">{cur.label ?? "Kỳ hiện tại"}</span>{" "}
        vs{" "}
        <span className="font-medium text-stone-900">{prev.label ?? "Kỳ trước"}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-xl font-bold text-stone-900 tabular-nums">{m.cur}</div>
              <div className="text-xs text-stone-400 line-through tabular-nums">{m.prev}</div>
              <DeltaBadge pct={m.deltaPct} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
