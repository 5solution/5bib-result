"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import {
  dashboardControllerGetKpi,
  dashboardControllerGetSparklines,
} from "@/lib/api-generated/sdk.gen";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * F-023 BR-DASH-01/02/03/21 — KPI Strip 4 cột.
 *
 * - Render 4 KPI: GMV / Net / VĐV / Phí 5BIB (MTD vs prev MTD).
 * - Currency dùng `font-mono` (JetBrains Mono — F-022 token), thousand `.`.
 * - Delta NULL → render "—" (BR-DASH-02).
 * - Sparkline lazy load — KPI value/delta render trước.
 */
type KpiCard = {
  key: string;
  label: string;
  value: number;
  prevValue: number;
  deltaPercent: number | null;
  unit: "vnd" | "count";
};

type SparklinePoint = { date: string; value: number };
type SparklineSeries = { key: string; points: SparklinePoint[] };

function formatVnd(value: number): string {
  return value.toLocaleString("vi-VN");
}

function formatCount(value: number): string {
  return value.toLocaleString("vi-VN");
}

function deltaColor(delta: number | null): string {
  if (delta === null) return "text-stone-500";
  if (delta > 0) return "text-emerald-600";
  if (delta < 0) return "text-rose-600";
  return "text-stone-500";
}

function deltaLabel(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function Sparkline({ points }: { points: SparklinePoint[] }) {
  if (points.length === 0) return <div className="h-8 w-full" />;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const step = w / Math.max(1, points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p.value - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full text-blue-600">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function KPIStrip() {
  const { token } = useAuth();
  const [kpis, setKpis] = useState<KpiCard[] | null>(null);
  const [sparklines, setSparklines] = useState<SparklineSeries[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;

    async function load() {
      setLoading(true);
      try {
        const kpiRes = await dashboardControllerGetKpi({
          ...authHeaders(token),
        });
        if (cancelled) return;
        const kpiPayload = kpiRes.data as unknown as { kpis?: KpiCard[] };
        setKpis(kpiPayload?.kpis ?? []);
      } catch {
        if (!cancelled) setKpis([]);
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const sparkRes = await dashboardControllerGetSparklines({
          ...authHeaders(token),
        });
        if (cancelled) return;
        const sparkPayload = sparkRes.data as unknown as {
          series?: SparklineSeries[];
        };
        setSparklines(sparkPayload?.series ?? []);
      } catch {
        if (!cancelled) setSparklines([]);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading || !kpis) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => {
        const series = sparklines?.find((s) => s.key === k.key);
        const formatted =
          k.unit === "vnd" ? formatVnd(k.value) : formatCount(k.value);
        return (
          <Card key={k.key} className="card-hover">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                {k.label}
              </p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-stone-900">
                {formatted}
                {k.unit === "vnd" ? (
                  <span className="ml-1 text-sm font-normal text-stone-500">
                    đ
                  </span>
                ) : null}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center text-xs font-semibold ${deltaColor(
                    k.deltaPercent,
                  )}`}
                >
                  {k.deltaPercent !== null && k.deltaPercent !== 0 ? (
                    k.deltaPercent > 0 ? (
                      <ArrowUp className="mr-0.5 size-3" />
                    ) : (
                      <ArrowDown className="mr-0.5 size-3" />
                    )
                  ) : null}
                  {deltaLabel(k.deltaPercent)}
                </span>
                <span className="w-[60%] max-w-[120px]">
                  {series ? (
                    <Sparkline points={series.points} />
                  ) : (
                    <Skeleton className="h-8 w-full" />
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
