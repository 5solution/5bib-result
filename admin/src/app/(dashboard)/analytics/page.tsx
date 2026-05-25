"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
// F-062 Wave 3-2 + Wave 4 NEW — Wave 2 BR-SA components driven by URL filter
import { ComparisonRow } from "./components/ComparisonRow";
import { Ga4OverviewSection } from "./components/Ga4OverviewSection";
import { ExportButtonV2 } from "./components/ExportButtonV2";
import { searchParamsToQuery } from "@/lib/analytics-hooks";
import type { CompareKind as CompareKindLabel } from "@/lib/analytics-labels";
import { authHeaders } from "@/lib/api";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
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

/**
 * RBAC page-level gate — Analytics (F-026) chỉ admin xem được.
 * Backend cũng enforce qua LogtoAdminGuard (defense-in-depth).
 * Gate phải đứng NGOÀI component chính để tránh vi phạm Rules of Hooks
 * khi early-return giữa các useState.
 */
export default function AnalyticsPageGate() {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <RestrictedAccess message="Trang Analytics chỉ dành cho admin — bạn không có quyền truy cập. Liên hệ quản trị hệ thống nếu cần cấp quyền." />
    );
  }
  return <AnalyticsOverviewPage />;
}

function AnalyticsOverviewPage() {
  const { token } = useAuth();
  // F-062 Wave 3-2: read filter params from URL (driven by AnalyticsFilterBar in layout)
  // Declared early so granularityFromUrl is available for fetchDailyRevenue useCallback below.
  const sp = useSearchParams();
  const wave2Query = searchParamsToQuery(sp);
  const wave2Compare = ((sp.get("compare") as CompareKindLabel) === "wow" ||
    (sp.get("compare") as CompareKindLabel) === "yoy"
    ? (sp.get("compare") as "wow" | "yoy")
    : "mom") as "wow" | "mom" | "yoy";
  // F-062 BUG-009: granularity switch for AreaChart endpoint (daily/weekly/monthly per BR-SA-13)
  const granularityFromUrl = sp.get("granularity") ?? "daily";

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
      const endpoint =
        granularityFromUrl === "weekly"
          ? "revenue/weekly"
          : granularityFromUrl === "monthly"
            ? "revenue/monthly"
            : "revenue/daily";
      const res = await fetch(
        `/api/analytics/${endpoint}?from=${from}&to=${to}`,
        { headers: authHeaders(token).headers },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      const rawData: Array<Record<string, unknown>> = json.data ?? json ?? [];
      // Normalize date field per granularity (daily=date, weekly=weekStart, monthly=month)
      const normalized = rawData.map((d) => ({
        date:
          (d.date as string | undefined) ??
          (d.weekStart as string | undefined) ??
          (d.month as string | undefined) ??
          "",
        gmv: Number(d.gmv ?? 0),
        netGmv: Number(d.netGmv ?? 0),
        orderCount: Number(d.orderCount ?? 0),
      }));
      setDailyRevenue(normalized);
    } catch {
      toast.error("Không thể tải dữ liệu doanh thu");
    } finally {
      setLoadingDaily(false);
    }
  }, [token, from, to, granularityFromUrl]);

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
      {/* F-062 Wave 2/4 NEW — Comparison Row + Export buttons + GA4 section */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-stone-900">Tổng quan kỳ ({wave2Compare.toUpperCase()})</h2>
        <div className="flex gap-2">
          <ExportButtonV2 reportType="overview" query={wave2Query} format="xlsx" />
          <ExportButtonV2 reportType="overview" query={wave2Query} format="csv" />
        </div>
      </div>
      <ComparisonRow {...wave2Query} compareWith={wave2Compare} />
      <Ga4OverviewSection {...wave2Query} />

      {/* F-062 BUG-001 fix Wave 2: REMOVED duplicate KPI strip + legacy header +
          tabs sub-nav + month selector. ComparisonRow above already shows GMV/Net/
          Phí/Đơn current vs previous với delta — no need for separate "Tổng GMV
          tháng này" cards. Filter context comes từ layout AnalyticsFilterBar
          (granularity/period/compare) instead of legacy month-only Select.
          Legacy KPI strip + sub-nav + month dropdown removed per Manager refactor
          ARCH-001 (2026-05-25). Below: legacy charts that ARE complementary
          (daily area chart, category donut, top races, top merchants) — NOT
          duplicate of Wave 2 components, kept inline. F-026 6-panel detail block
          wrapped in <details> collapsed default per BR-SA-23 spec.
       */}

      {/* Row 2: Revenue trend + category donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Doanh thu —{" "}
              {granularityFromUrl === "weekly"
                ? "theo tuần"
                : granularityFromUrl === "monthly"
                  ? "theo tháng"
                  : "theo ngày"}
            </CardTitle>
            <p className="text-xs text-stone-400">
              BR-SA-02/03 — chuyển granularity ở filter bar trên cùng
            </p>
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

      {/* F-062 BR-SA-23 — Accordion "Phân tích vận hành chi tiết" (collapsed default).
          Wraps 6 F-026 panels (RepeatAthleteRate / MerchantChurn / TimeToFill /
          ClaimRate+ResolutionSLA / GeoDemo / RefundCancel) per spec line 586-593.
          User explicitly opens to see detail metrics. */}
      <details className="rounded-lg border border-stone-200 bg-white overflow-hidden group">
        <summary className="cursor-pointer flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50 transition-colors select-none list-none">
          <div className="flex items-center gap-2">
            <svg className="size-4 text-stone-400 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
            <h2 className="text-lg font-semibold text-stone-900">Phân tích vận hành chi tiết</h2>
            <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">6 chỉ số F-026</span>
          </div>
          <span className="text-xs text-stone-400 italic">Click để mở/đóng</span>
        </summary>

        <div className="border-t border-stone-100 p-4 space-y-3">
          {/* Controls row — period + race filter + export (chỉ áp F-026 section) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
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
      </details>

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
