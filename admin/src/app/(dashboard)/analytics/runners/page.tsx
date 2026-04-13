"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { HeatmapChart } from "@/components/charts/HeatmapChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { toast } from "sonner";
import { Users, Repeat, Clock, X } from "lucide-react";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => String(i));

const CATEGORY_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#f97316",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunnerBehaviorData {
  repeatRunnerRate: number;
  avgLeadTimeDays: number;
  totalRunners: number;
  repeatRunners: number;
  peakBookingHour: number;
  peakByHour: { hour: number; orderCount: number }[];
  peakByDow: { dow: number; orderCount: number }[];
  categoryMix: { category: string; count: number }[];
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{title}</span>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RunnerBehaviorPage() {
  const { token } = useAuth();

  const defaultFrom = `${currentMonthStr()}-01`;
  const defaultTo = (() => {
    const m = currentMonthStr();
    const [y, mo] = m.split("-");
    const days = new Date(Number(y), Number(mo), 0).getDate();
    return `${m}-${String(days).padStart(2, "0")}`;
  })();

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<RunnerBehaviorData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/runners/behavior?from=${from}&to=${to}`, {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data ?? json);
    } catch {
      toast.error("Không thể tải dữ liệu hành vi runner");
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const donutData = (data?.categoryMix ?? []).map((c, i) => ({
    label: c.category,
    value: c.count,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  // Build 7×24 heatmap from peakByHour (flatten into single row for now)
  const heatmap: number[][] = Array.from({ length: 7 }, (_, dow) => {
    return Array.from({ length: 24 }, (_, hour) => {
      const dowEntry = data?.peakByDow?.find((d) => d.dow === dow + 1);
      const hourEntry = data?.peakByHour?.find((h) => h.hour === hour);
      return dowEntry && hourEntry ? Math.round((dowEntry.orderCount * hourEntry.orderCount) / Math.max((data?.totalRunners ?? 1), 1)) : 0;
    });
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hành vi Runner</h1>
          <p className="text-sm text-muted-foreground">Phân tích hành vi đặt vé của runners</p>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          {[
            { href: "/analytics", label: "Tổng quan" },
            { href: "/analytics/races", label: "Races" },
            { href: "/analytics/merchants", label: "Merchants" },
            { href: "/analytics/runners", label: "Runners" },
            { href: "/analytics/funnel", label: "Funnel" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-2.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Từ ngày</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Đến ngày</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-[150px]"
          />
        </div>
        {(from !== defaultFrom || to !== defaultTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFrom(defaultFrom); setTo(defaultTo); }}
          >
            <X className="mr-1 size-3" /> Reset
          </Button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Tỷ lệ runner quay lại"
          value={data ? `${data.repeatRunnerRate.toFixed(1)}%` : "—"}
          sub="runners đặt vé lần 2+"
          icon={Repeat}
          loading={loading}
        />
        <KpiCard
          title="Avg booking lead time"
          value={data ? `${data.avgLeadTimeDays.toFixed(0)} ngày` : "—"}
          sub="trung bình trước ngày race"
          icon={Clock}
          loading={loading}
        />
        <KpiCard
          title="Unique runners"
          value={data ? data.totalRunners.toLocaleString("vi-VN") : "—"}
          sub="trong khoảng thời gian"
          icon={Users}
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Booking heatmap — Ngày × Giờ
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Mật độ đặt vé theo thứ trong tuần và giờ trong ngày
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <HeatmapChart
                data={heatmap}
                rowLabels={DAY_LABELS}
                colLabels={HOUR_LABELS}
                color="#3b82f6"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Category mix</CardTitle>
            <p className="text-xs text-muted-foreground">
              Phân bổ loại sản phẩm được đặt
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center gap-3 pt-2">
                <Skeleton className="size-40 rounded-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            ) : donutData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu danh mục
              </p>
            ) : (
              <DonutChart
                data={donutData}
                size={160}
                thickness={30}
                formatValue={(v) => v.toLocaleString("vi-VN") + " đơn"}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
