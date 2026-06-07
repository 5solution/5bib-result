"use client";

/**
 * FEATURE-027 — Phase A4 — Promo Hub Analytics panel.
 *
 * Renders inside admin edit page Analytics tab. Calls
 * `promoHubAnalyticsControllerGetSummary` and displays:
 *   - 3 summary cards (totalViews / totalClicks / CTR)
 *   - AreaChart views per day (last 30 days)
 *   - AreaChart clicks per day (last 30 days)
 *   - Table top sections by click count
 *   - Table top CTA labels by click count
 *
 * AreaChart component reused từ admin/src/components/charts/AreaChart.tsx
 * (SVG-based, no extra dependency).
 */

import { useCallback, useEffect, useState } from "react";
import { promoHubAnalyticsControllerGetSummary } from "@/lib/api-generated";
import type { AnalyticsSummaryDto } from "@/lib/api-generated";
import { AreaChart } from "@/components/charts/AreaChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, RefreshCw, AlertCircle } from "lucide-react";
import { SECTION_TYPE_META, type SectionType } from "./section-types";
import type { EditorSection } from "./SectionCard";

type Props = {
  hubId: string;
  sections: EditorSection[];
};

export function PromoHubAnalytics({ hubId, sections }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await promoHubAnalyticsControllerGetSummary({
        path: { hubId },
      });
      setData(res.data as AnalyticsSummaryDto);
    } catch (err) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, [hubId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="size-4" />
          Không tải được analytics
        </div>
        <div className="mt-1 text-xs">{error}</div>
        <Button variant="outline" size="sm" onClick={load} className="mt-3">
          <RefreshCw className="mr-1.5 size-3.5" /> Thử lại
        </Button>
      </div>
    );
  }

  if (!data) return null;

  // Map TimeSeriesDataPointDto[] → AreaChart {date,value} format
  const viewsSeries = data.viewsByDay.map((d) => ({
    date: d.date,
    value: d.count,
  }));
  const clicksSeries = data.clicksByDay.map((d) => ({
    date: d.date,
    value: d.count,
  }));

  // Build section _id → section type map cho display top sections
  const sectionIndex = new Map<string, EditorSection>();
  sections.forEach((s) => sectionIndex.set(s._id, s));

  return (
    <div className="space-y-6">
      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-[var(--admin-blue)]" />
          <h2 className="text-lg font-bold">Tổng quan 30 ngày</h2>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1.5 size-3.5" /> Làm mới
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Tổng lượt xem"
          value={data.totalViews.toLocaleString("vi-VN")}
          tone="text-foreground"
        />
        <SummaryCard
          label="Tổng lượt click"
          value={data.totalClicks.toLocaleString("vi-VN")}
          tone="text-[var(--admin-blue)]"
        />
        <SummaryCard
          label="CTR"
          value={`${(data.ctr * 100).toFixed(2)}%`}
          tone="text-emerald-700"
          hint={
            data.totalViews === 0
              ? "Chưa có view nào"
              : `${data.totalClicks} click / ${data.totalViews} view`
          }
        />
      </div>

      {/* Time-series charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Lượt xem mỗi ngày" subtitle="30 ngày gần nhất">
          <AreaChart data={viewsSeries} height={220} color="#1d4ed8" />
        </ChartCard>
        <ChartCard title="Lượt click mỗi ngày" subtitle="30 ngày gần nhất">
          <AreaChart data={clicksSeries} height={220} color="#ea580c" />
        </ChartCard>
      </div>

      {/* Top sections + Top labels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Top section theo click
          </h3>
          {data.topSections.length === 0 ? (
            <EmptyHint />
          ) : (
            <ul className="space-y-2">
              {data.topSections.map((ts, i) => {
                const sec = sectionIndex.get(ts.sectionId);
                const meta = sec ? SECTION_TYPE_META[sec.type as SectionType] : null;
                const Icon = meta?.icon;
                const labelHint =
                  (sec?.config?.title as string | undefined) ||
                  (sec?.config?.ctaLabel as string | undefined) ||
                  ts.sectionId.slice(-8);
                return (
                  <li
                    key={ts.sectionId}
                    className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2"
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-md bg-white">
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        #{i + 1}
                      </span>
                    </div>
                    {Icon && (
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {meta?.label ?? "Section đã xóa"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {labelHint}
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {ts.clicks}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Top nhãn CTA
          </h3>
          {data.topLabels.length === 0 ? (
            <EmptyHint />
          ) : (
            <ul className="space-y-2">
              {data.topLabels.map((tl, i) => (
                <li
                  key={`${tl.label}-${i}`}
                  className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2"
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-md bg-white">
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      #{i + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {tl.label || "(không nhãn)"}
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {tl.clicks}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-3xl font-bold leading-none tracking-tight ${tone}`}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-2">
        <div className="text-sm font-bold">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 py-6 text-center text-xs text-muted-foreground">
      Chưa có dữ liệu — sẽ có khi có click.
    </div>
  );
}
