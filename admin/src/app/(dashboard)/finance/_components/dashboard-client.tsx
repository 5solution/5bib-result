"use client";

/**
 * F-028 Phase 2 — Dashboard Aggregated Client.
 *
 * State machine:
 *   filter (period/dateFrom/dateTo/groupBy) → useEffect fetch → setData/setLoading
 *
 * Pattern clone Analytics F-026 `AnalyticsOverviewPage` — KPI cards row +
 * tabs aggregated + 2 tables (top profit / loss) + 2 charts (trend / donut).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  FileSignature,
  Coins,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDashboardData,
  formatVnd,
  formatMargin,
  FinanceApiError,
  type DashboardPeriod,
  type DashboardGroupBy,
  type PnLDashboardResponse,
  type FeeSource,
} from "@/lib/finance-api";
import { PeriodFilter } from "./period-filter";
import { SourceMixStrip } from "./source-mix-strip";
import { PnLDashboardTabs } from "./pnl-dashboard-tabs";
import { TopProfitTable } from "./top-profit-table";
import { LossMakingTable } from "./loss-making-table";
import { PnLTrendChart } from "./pnl-trend-chart";
import { PnLCategoryDonut } from "./pnl-category-donut";
import { PnLExportButton } from "./pnl-export-button";

function KpiCard({
  title,
  value,
  icon: Icon,
  tone = "neutral",
  loading,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "good" | "bad";
  loading?: boolean;
}) {
  const colorTone =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-red-700"
        : "text-stone-900";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-36" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {title}
              </span>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <p className={`text-xl font-bold tabular-nums ${colorTone}`}>{value}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const [period, setPeriod] = useState<DashboardPeriod>("last_3_months");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState<DashboardGroupBy>("month");
  const [data, setData] = useState<PnLDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const filter = useMemo(
    () => ({
      period,
      groupBy,
      dateFrom: period === "custom" ? dateFrom : undefined,
      dateTo: period === "custom" ? dateTo : undefined,
    }),
    [period, groupBy, dateFrom, dateTo],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDashboardData(filter);
      setData(res);
    } catch (e) {
      const msg =
        e instanceof FinanceApiError
          ? e.message
          : "Không thể tải dữ liệu dashboard P&L";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // Khi period=custom mà chưa nhập đủ from/to → KHÔNG fetch (đợi user)
    if (period === "custom" && (!dateFrom || !dateTo)) return;
    fetchData();
  }, [fetchData, period, dateFrom, dateTo]);

  const totals = data?.totals;
  const profitTone = (totals?.totalProfit ?? 0) >= 0 ? "good" : "bad";

  // F-040 — navigate F-038 list filtered by source on segment click
  const handleSourceClick = useCallback(
    (source: FeeSource) => {
      router.push(`/finance/contracts?feeSource=${source}`);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="size-6 text-blue-700" aria-hidden />
          <h1 className="text-xl font-bold text-stone-900">Tổng quan P&amp;L</h1>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            Phase 2
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/finance/contracts"
            className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100"
          >
            <FileSignature className="mr-1 inline size-4" aria-hidden />
            P&amp;L theo HĐ
          </Link>
        </div>
      </div>

      {/* Filter + Export bar */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3">
        <PeriodFilter
          period={period}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={({ period: p, dateFrom: df, dateTo: dt }) => {
            setPeriod(p);
            setDateFrom(df);
            setDateTo(dt);
          }}
        />
        <PnLExportButton filter={filter} />
      </div>

      {data && (data.totals.contractCount === 0) && !loading && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertCircle className="size-4" />
          Không có hợp đồng nào trong khoảng thời gian {data.dateFrom} →{" "}
          {data.dateTo}. Thử nới rộng khoảng thời gian hoặc tạo HĐ mới.
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          title="Số HĐ"
          value={totals ? String(totals.contractCount) : "—"}
          icon={FileSignature}
          loading={loading}
        />
        <KpiCard
          title="Tổng doanh thu"
          value={totals ? formatVnd(totals.totalRevenue) : "—"}
          icon={Banknote}
          loading={loading}
        />
        <KpiCard
          title="Tổng chi phí"
          value={totals ? formatVnd(totals.totalCost) : "—"}
          icon={Coins}
          loading={loading}
        />
        <KpiCard
          title="Tổng Lãi/Lỗ"
          value={totals ? formatVnd(totals.totalProfit) : "—"}
          icon={(totals?.totalProfit ?? 0) >= 0 ? TrendingUp : TrendingDown}
          tone={profitTone}
          loading={loading}
        />
        <KpiCard
          title="Margin TB"
          value={totals ? formatMargin(totals.avgMargin) : "—"}
          icon={TrendingUp}
          loading={loading}
        />
      </div>

      {/* F-040 — Source mix strip (hide if total=0) */}
      {totals && totals.contractCount > 0 ? (
        <SourceMixStrip
          mix={totals.feeSourceMix}
          total={totals.contractCount}
          onSegmentClick={handleSourceClick}
        />
      ) : null}

      {/* Tabs aggregated */}
      <PnLDashboardTabs
        byType={data?.byType ?? []}
        byPartner={data?.byPartner ?? []}
        byMonth={data?.byMonth ?? []}
        defaultTab={groupBy}
        onTabChange={setGroupBy}
        loading={loading}
      />

      {/* Trend chart + Donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PnLTrendChart byMonth={data?.byMonth ?? []} loading={loading} />
        </div>
        <PnLCategoryDonut
          costByCategory={data?.totals.costByCategory ?? {}}
          loading={loading}
        />
      </div>

      {/* Separator */}
      <Separator />

      {/* Top profit + Loss-making */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopProfitTable items={data?.topProfit ?? []} loading={loading} />
        <LossMakingTable items={data?.lossMaking ?? []} loading={loading} />
      </div>
    </div>
  );
}
