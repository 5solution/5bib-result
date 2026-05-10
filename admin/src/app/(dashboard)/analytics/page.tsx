"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, ShoppingCart, Banknote, Trophy, X } from "lucide-react";
import Link from "next/link";

import {
  PeriodCompareSelector,
  type PeriodKind,
  type CompareKind,
} from "./components/PeriodCompareSelector";
import { RaceDrillDownFilter } from "./components/RaceDrillDownFilter";
import { ExportButton } from "./components/ExportButton";
import { RepeatAthleteRateCard, type RepeatAthleteData } from "./components/RepeatAthleteRateCard";
import { MerchantChurnTable, type MerchantChurnData } from "./components/MerchantChurnTable";
import { TimeToFillTable, type TimeToFillData } from "./components/TimeToFillTable";
import { ClaimRateTable, type ClaimRateData } from "./components/ClaimRateTable";
import { ResolutionSLACard } from "./components/ResolutionSLACard";
import { GeographicDonut, type GeoDemoData } from "./components/GeographicDonut";
import { DemographicStackedBar } from "./components/DemographicStackedBar";
import { RefundCancelCards, type RefundCancelData } from "./components/RefundCancelCards";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
}

function formatPct(n: number, decimals = 1) {
  return (n >= 0 ? "+" : "") + n.toFixed(decimals) + "%";
}

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions(): { value: string; label: string }[] {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
    opts.push({ value: val, label });
  }
  return opts;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  gmv: number;
  netGmv: number;
  orderCount: number;
  platformFee: number;
  openRaces: number;
  pendingReconciliations: number;
  vsLastMonth: { gmvChange: number | null; orderChange: number | null };
  categoryBreakdown: { category: string; count: number; gmv: number }[];
}

interface DailyRevenue {
  date: string;
  gmv: number;
  netGmv: number;
  orderCount: number;
}

interface CategoryRevenue {
  category: string;
  grossGmv: number;
  count: number;
  pct: number;
}

interface TopRace {
  raceId: number;
  raceName: string;
  grossGmv: number;
  orderCount: number;
}

interface TopMerchant {
  tenantId: number;
  merchantName: string;
  grossGmv: number;
  orderCount: number;
}

const CATEGORY_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#f97316",
];

function KpiCard({
  title,
  value,
  sub,
  pct,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  sub?: string;
  pct?: number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{title}</span>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <div className="flex items-center gap-2">
              {pct !== undefined && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    pct >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {pct >= 0 ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {formatPct(pct)}
                </span>
              )}
              {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsOverviewPage() {
  const { token } = useAuth();
  const [month, setMonth] = useState(currentMonthStr());

  // F-026 state
  const [period, setPeriod] = useState<PeriodKind>("rolling12m");
  const [compareWith, setCompareWith] = useState<CompareKind>("prev");
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [categoryRevenue, setCategoryRevenue] = useState<CategoryRevenue[]>([]);
  const [topRaces, setTopRaces] = useState<TopRace[]>([]);
  const [topMerchants, setTopMerchants] = useState<TopMerchant[]>([]);

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingCategory, setLoadingCategory] = useState(true);
  const [loadingTop, setLoadingTop] = useState(true);

  // F-026 widget data
  const [repeatAthlete, setRepeatAthlete] = useState<RepeatAthleteData | null>(null);
  const [merchantChurn, setMerchantChurn] = useState<MerchantChurnData | null>(null);
  const [timeToFill, setTimeToFill] = useState<TimeToFillData | null>(null);
  const [claimRate, setClaimRate] = useState<ClaimRateData | null>(null);
  const [geoDemo, setGeoDemo] = useState<GeoDemoData | null>(null);
  const [refundCancel, setRefundCancel] = useState<RefundCancelData | null>(null);

  const [loadingF026, setLoadingF026] = useState(true);

  const monthOptions_ = monthOptions();

  const [year, mon] = month.split("-");
  const daysInMonth = new Date(Number(year), Number(mon), 0).getDate();
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  // ─── Legacy fetches (giữ nguyên KPI / Revenue / Donut) ──────────────────────

  const fetchOverview = useCallback(async () => {
    if (!token) return;
    setLoadingOverview(true);
    try {
      const res = await fetch(`/api/analytics/overview?month=${month}`, {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setOverview(json.data ?? json);
    } catch {
      toast.error("Không thể tải dữ liệu tổng quan");
    } finally {
      setLoadingOverview(false);
    }
  }, [token, month]);

  const fetchDailyRevenue = useCallback(async () => {
    if (!token) return;
    setLoadingDaily(true);
    try {
      const res = await fetch(
        `/api/analytics/revenue/daily?from=${from}&to=${to}`,
        { headers: authHeaders(token).headers }
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setDailyRevenue(json.data ?? json ?? []);
    } catch {
      toast.error("Không thể tải dữ liệu doanh thu theo ngày");
    } finally {
      setLoadingDaily(false);
    }
  }, [token, from, to]);

  const fetchCategory = useCallback(async () => {
    if (!token) return;
    setLoadingCategory(true);
    try {
      const res = await fetch(
        `/api/analytics/revenue-by-category?month=${month}`,
        { headers: authHeaders(token).headers }
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCategoryRevenue(json.data ?? json ?? []);
    } catch {
      toast.error("Không thể tải dữ liệu theo danh mục");
    } finally {
      setLoadingCategory(false);
    }
  }, [token, month]);

  const fetchTop = useCallback(async () => {
    if (!token) return;
    setLoadingTop(true);
    try {
      const [racesRes, merchantsRes] = await Promise.all([
        fetch(`/api/analytics/top-races?month=${month}&limit=5`, {
          headers: authHeaders(token).headers,
        }),
        fetch(`/api/analytics/merchants?month=${month}`, {
          headers: authHeaders(token).headers,
        }),
      ]);
      if (racesRes.ok) {
        const json = await racesRes.json();
        setTopRaces(json.data ?? json ?? []);
      }
      if (merchantsRes.ok) {
        const json = await merchantsRes.json();
        const list = json.data ?? json ?? [];
        setTopMerchants(list.slice(0, 5));
      }
    } catch {
      toast.error("Không thể tải dữ liệu top races / merchants");
    } finally {
      setLoadingTop(false);
    }
  }, [token, month]);

  // ─── F-026 fetches — chạy song song ─────────────────────────────────────────

  const fetchF026 = useCallback(async () => {
    if (!token) return;
    setLoadingF026(true);
    const headers = authHeaders(token).headers;
    const baseQ = `period=${period}${selectedRaceId ? `&raceId=${selectedRaceId}` : ""}`;
    const compareQ = compareWith !== "none" ? `&compareWith=${compareWith}` : "";

    async function fetchJson<T>(url: string): Promise<T | null> {
      try {
        const r = await fetch(url, { headers });
        if (!r.ok) return null;
        const j = await r.json();
        return (j.data ?? j) as T;
      } catch {
        return null;
      }
    }

    try {
      const [a, b, c, d, e, f] = await Promise.all([
        fetchJson<RepeatAthleteData>(
          `/api/analytics/repeat-athlete-rate?${baseQ}${compareQ}`,
        ),
        fetchJson<MerchantChurnData>(`/api/analytics/merchant-churn?period=${period}`),
        fetchJson<TimeToFillData>(`/api/analytics/time-to-fill?${baseQ}`),
        fetchJson<ClaimRateData>(`/api/analytics/claim-rate?${baseQ}`),
        fetchJson<GeoDemoData>(`/api/analytics/geographic-demographic?${baseQ}`),
        fetchJson<RefundCancelData>(`/api/analytics/refund-cancel-rate?${baseQ}`),
      ]);
      setRepeatAthlete(a);
      setMerchantChurn(b);
      setTimeToFill(c);
      setClaimRate(d);
      setGeoDemo(e);
      setRefundCancel(f);
    } finally {
      setLoadingF026(false);
    }
  }, [token, period, compareWith, selectedRaceId]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchDailyRevenue(); }, [fetchDailyRevenue]);
  useEffect(() => { fetchCategory(); }, [fetchCategory]);
  useEffect(() => { fetchTop(); }, [fetchTop]);
  useEffect(() => { fetchF026(); }, [fetchF026]);

  const areaData = dailyRevenue.map((d) => ({
    date: d.date.slice(5),
    value: d.gmv,
  }));

  const donutData = categoryRevenue.map((c, i) => ({
    label: c.category,
    value: c.grossGmv,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const raceBarData = topRaces.map((r) => ({
    label: r.raceName,
    value: r.grossGmv,
  }));

  const merchantBarData = topMerchants.map((m) => ({
    label: m.merchantName,
    value: m.grossGmv,
  }));

  // F-026 race options từ topRaces (proxy đủ MVP)
  const raceOptions = useMemo(
    () =>
      topRaces.map((r) => ({
        raceId: String(r.raceId),
        raceName: r.raceName,
      })),
    [topRaces],
  );

  const selectedRaceName = useMemo(
    () => raceOptions.find((r) => r.raceId === selectedRaceId)?.raceName,
    [raceOptions, selectedRaceId],
  );

  const handleExportPdf = useCallback(() => {
    toast.info("Export PDF đang được chuẩn bị (MVP — phase 2)");
  }, []);

  const handleExportExcel = useCallback(() => {
    toast.info("Export Excel đang được chuẩn bị (MVP — phase 2)");
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Tổng quan hiệu suất nền tảng — Theo giờ Việt Nam (UTC+7)
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Separator orientation="vertical" className="h-5" />
          <Select value={month} onValueChange={(v) => { if (v != null) setMonth(v); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions_.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* F-026 controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3">
        <PeriodCompareSelector
          period={period}
          compareWith={compareWith}
          onPeriodChange={setPeriod}
          onCompareChange={setCompareWith}
        />
        <div className="flex items-center gap-2">
          <RaceDrillDownFilter
            races={raceOptions}
            selectedRaceId={selectedRaceId}
            onChange={setSelectedRaceId}
          />
          <ExportButton onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} />
        </div>
      </div>

      {/* Drill-down banner */}
      {selectedRaceId && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <span>
            Đang xem race <strong>{selectedRaceName ?? selectedRaceId}</strong> — tất cả widget đã re-fetch
          </span>
          <button
            type="button"
            onClick={() => setSelectedRaceId(null)}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-blue-700 hover:bg-blue-100"
          >
            <X className="size-3.5" /> Bỏ chọn
          </button>
        </div>
      )}

      {/* Row 1: KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Tổng GMV tháng này"
          value={overview ? formatVnd(overview.gmv) : "—"}
          pct={overview?.vsLastMonth?.gmvChange ?? undefined}
          sub="so với tháng trước"
          icon={Banknote}
          loading={loadingOverview}
        />
        <KpiCard
          title="Tổng đơn hàng"
          value={overview ? overview.orderCount.toLocaleString("vi-VN") : "—"}
          pct={overview?.vsLastMonth?.orderChange ?? undefined}
          sub="so với tháng trước"
          icon={ShoppingCart}
          loading={loadingOverview}
        />
        <KpiCard
          title="Platform fee tháng này"
          value={overview ? formatVnd(overview.platformFee) : "—"}
          icon={TrendingUp}
          loading={loadingOverview}
        />
        <KpiCard
          title="Races đang mở"
          value={overview ? String(overview.openRaces) : "—"}
          sub={`${overview?.pendingReconciliations ?? "—"} chờ đối soát`}
          icon={Trophy}
          loading={loadingOverview}
        />
      </div>

      {/* Row 2: Revenue trend + category donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Doanh thu 30 ngày</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDaily ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <AreaChart data={areaData} height={200} color="#3b82f6" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Doanh thu theo danh mục</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCategory ? (
              <div className="flex flex-col items-center gap-3 pt-2">
                <Skeleton className="size-40 rounded-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            ) : (
              <DonutChart
                data={donutData}
                size={160}
                thickness={30}
                formatValue={formatVnd}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* F-026 — 8 widget grid */}
      <div className="border-t border-stone-200 pt-5">
        <h2 className="mb-3 text-lg font-semibold">8 chỉ số insight (F-026)</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <RepeatAthleteRateCard data={repeatAthlete} loading={loadingF026} />
          <MerchantChurnTable data={merchantChurn} loading={loadingF026} />
          <TimeToFillTable data={timeToFill} loading={loadingF026} />
          <ClaimRateTable data={claimRate} loading={loadingF026} />
          <ResolutionSLACard data={claimRate} loading={loadingF026} />
          <GeographicDonut data={geoDemo} loading={loadingF026} />
          <DemographicStackedBar data={geoDemo} loading={loadingF026} />
          <RefundCancelCards data={refundCancel} loading={loadingF026} />
        </div>
      </div>

      {/* Top tables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 5 Races theo GMV</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTop ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : raceBarData.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu race
              </p>
            ) : (
              <BarChart data={raceBarData} color="#3b82f6" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Merchants theo GMV</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTop ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : merchantBarData.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu merchant
              </p>
            ) : (
              <BarChart data={merchantBarData} color="#8b5cf6" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
