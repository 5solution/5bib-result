"use client";

/**
 * F-069 M4 — Merchant race report detail (merchant.5bib.com/races/[raceId]).
 * Tabs: Vé (ticket — all merchants) + Doanh thu (revenue — finance role only).
 * Consumes ticket-sales/{summary,by-course,by-type,trend,orders} +
 * revenue/{summary,by-category,trend,export}. Charts = zero-dep CSS bars.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import {
  merchantPortalControllerGetMe,
  merchantPortalControllerGetRaces,
  merchantPortalControllerGetTicketSalesSummary,
  merchantPortalControllerGetTicketSalesByCourse,
  merchantPortalControllerGetTicketSalesByType,
  merchantPortalControllerGetTicketSalesTrend,
  merchantPortalControllerGetTicketSalesOrders,
  merchantPortalControllerGetRevenueSummary,
  merchantPortalControllerGetRevenueByCategory,
  merchantPortalControllerGetRevenueTrend,
} from "@/lib/api-generated/sdk.gen";
import type {
  MerchantMeResponseDto,
  TicketSalesSummaryDto,
  TicketSalesBreakdownDto,
  TicketTrendDto,
  TicketOrderListDto,
  RevenueSummaryDto,
  RevenueByCategoryDto,
  RevenueTrendDto,
} from "@/lib/api-generated/types.gen";
import {
  FINANCIAL_STATUS_LABEL,
  CATEGORY_GROUP_LABEL,
  labelOf,
  fmtVnd,
  fmtNum,
  fmtDate,
} from "@/lib/merchant-labels";

const ORDERS_PAGE_SIZE = 10;

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-stone-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-stone-900">{value}</div>
      {sub && <div className="text-xs text-stone-400">{sub}</div>}
    </div>
  );
}

/** Zero-dep CSS bar chart. */
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0)
    return <div className="py-6 text-center text-xs text-stone-400">Chưa có dữ liệu</div>;
  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: 140 }}>
      {data.map((d, i) => (
        <div key={i} className="flex min-w-[28px] flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-medium text-stone-600">{d.value || ""}</span>
          <div
            className="w-full rounded-t bg-blue-500/80"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="max-w-[44px] truncate text-[9px] text-stone-400" title={d.label}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-stone-700">{title}</h3>
      {children}
    </section>
  );
}

function BreakdownTable({ items }: { items: TicketSalesBreakdownDto["items"] }) {
  if (items.length === 0)
    return <div className="py-3 text-center text-xs text-stone-400">Chưa có dữ liệu</div>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-stone-100">
        {items.map((it) => (
          <tr key={it.id}>
            <td className="py-2 text-stone-700">{it.name}</td>
            <td className="py-2 text-right font-mono text-stone-500">{fmtNum(it.orderCount)} đơn</td>
            <td className="py-2 text-right font-mono font-medium text-stone-900">{fmtNum(it.ticketCount)} vé</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RaceReportPage() {
  const params = useParams();
  const raceId = Number(params?.raceId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [me, setMe] = useState<MerchantMeResponseDto | null>(null);
  const [raceTitle, setRaceTitle] = useState<string>("");
  const [tab, setTab] = useState<"ticket" | "revenue">("ticket");

  // Ticket
  const [summary, setSummary] = useState<TicketSalesSummaryDto | null>(null);
  const [byCourse, setByCourse] = useState<TicketSalesBreakdownDto | null>(null);
  const [byType, setByType] = useState<TicketSalesBreakdownDto | null>(null);
  const [trend, setTrend] = useState<TicketTrendDto | null>(null);
  const [orders, setOrders] = useState<TicketOrderListDto | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);

  // Revenue
  const [revSummary, setRevSummary] = useState<RevenueSummaryDto | null>(null);
  const [revByCat, setRevByCat] = useState<RevenueByCategoryDto | null>(null);
  const [revTrend, setRevTrend] = useState<RevenueTrendDto | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasRevenue = !!me?.permissions.includes("revenue_report");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) window.location.href = "/api/logto/sign-in";
  }, [authLoading, isAuthenticated]);

  const loadCore = useCallback(async () => {
    if (!token || !Number.isFinite(raceId)) return;
    setLoading(true);
    setError(null);
    try {
      const q = { query: { raceId }, ...authHeaders(token) };
      const [meR, racesR, sumR, courseR, typeR, trendR] = await Promise.all([
        merchantPortalControllerGetMe({ ...authHeaders(token) }),
        merchantPortalControllerGetRaces({ ...authHeaders(token) }),
        merchantPortalControllerGetTicketSalesSummary(q),
        merchantPortalControllerGetTicketSalesByCourse(q),
        merchantPortalControllerGetTicketSalesByType(q),
        merchantPortalControllerGetTicketSalesTrend(q),
      ]);
      const firstErr = [meR, racesR, sumR, courseR, typeR, trendR].find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      setMe(meR.data ?? null);
      setRaceTitle(racesR.data?.races.find((r) => r.raceId === raceId)?.title ?? `Giải #${raceId}`);
      setSummary(sumR.data ?? null);
      setByCourse(courseR.data ?? null);
      setByType(typeR.data ?? null);
      setTrend(trendR.data ?? null);
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setLoading(false);
    }
  }, [token, raceId]);

  const loadOrders = useCallback(async () => {
    if (!token || !Number.isFinite(raceId)) return;
    const r = await merchantPortalControllerGetTicketSalesOrders({
      query: { raceId, page: ordersPage, pageSize: ORDERS_PAGE_SIZE },
      ...authHeaders(token),
    });
    if (!r.error) setOrders(r.data ?? null);
  }, [token, raceId, ordersPage]);

  const loadRevenue = useCallback(async () => {
    if (!token || !Number.isFinite(raceId) || !hasRevenue) return;
    const q = { query: { raceId }, ...authHeaders(token) };
    const [sR, cR, tR] = await Promise.all([
      merchantPortalControllerGetRevenueSummary(q),
      merchantPortalControllerGetRevenueByCategory(q),
      merchantPortalControllerGetRevenueTrend(q),
    ]);
    if (!sR.error) setRevSummary(sR.data ?? null);
    if (!cR.error) setRevByCat(cR.data ?? null);
    if (!tR.error) setRevTrend(tR.data ?? null);
  }, [token, raceId, hasRevenue]);

  useEffect(() => {
    if (isAuthenticated) loadCore();
  }, [isAuthenticated, loadCore]);
  useEffect(() => {
    if (isAuthenticated) loadOrders();
  }, [isAuthenticated, loadOrders]);
  useEffect(() => {
    if (isAuthenticated && tab === "revenue") loadRevenue();
  }, [isAuthenticated, tab, loadRevenue]);

  const paidStatus = summary?.byStatus.find((s) => s.financialStatus === "paid");
  const ticketTrendData = useMemo(
    () => (trend?.series ?? []).map((p) => ({ label: p.label, value: p.orderCount })),
    [trend],
  );
  const revTrendData = useMemo(
    () => (revTrend?.series ?? []).map((p) => ({ label: p.label, value: Math.round(p.net) })),
    [revTrend],
  );

  function exportRevenue() {
    // GET endpoint streams xlsx; open via proxy (browser handles download).
    window.open(`/api/merchant-portal/revenue/export?raceId=${raceId}`, "_blank");
  }

  if (authLoading || (!isAuthenticated && !error)) {
    return <div className="grid min-h-screen place-items-center text-sm text-stone-500">Đang tải…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <a href="/dashboard" className="text-sm text-blue-600 hover:underline">← Tất cả giải</a>
      <h1 className="mt-2 text-xl font-bold text-stone-900">{raceTitle || "Báo cáo giải"}</h1>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-stone-200">
        <button
          onClick={() => setTab("ticket")}
          className={`px-4 py-2 text-sm font-medium ${tab === "ticket" ? "border-b-2 border-blue-600 text-blue-700" : "text-stone-500 hover:text-stone-700"}`}
        >
          Báo cáo vé
        </button>
        {hasRevenue && (
          <button
            onClick={() => setTab("revenue")}
            className={`px-4 py-2 text-sm font-medium ${tab === "revenue" ? "border-b-2 border-blue-600 text-blue-700" : "text-stone-500 hover:text-stone-700"}`}
          >
            Báo cáo doanh thu
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-stone-100" />)}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={loadCore} className="mt-3 rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">Thử lại</button>
        </div>
      ) : tab === "ticket" ? (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="Tổng vé" value={fmtNum(summary?.totalTickets)} />
            <Card label="Tổng đơn" value={fmtNum(summary?.totalOrders)} />
            <Card label="Vé đã TT" value={fmtNum(paidStatus?.ticketCount ?? 0)} sub={`${fmtNum(paidStatus?.orderCount ?? 0)} đơn paid`} />
            <Card label="Trạng thái" value={`${summary?.byStatus.length ?? 0} loại`} sub={(summary?.byStatus ?? []).map((s) => labelOf(FINANCIAL_STATUS_LABEL, s.financialStatus)).join(", ")} />
          </div>

          <Section title={`Đơn theo thời gian${trend ? ` (${trend.granularity})` : ""}`}>
            <BarChart data={ticketTrendData} />
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Section title="Theo cự ly"><BreakdownTable items={byCourse?.items ?? []} /></Section>
            <Section title="Theo loại vé"><BreakdownTable items={byType?.items ?? []} /></Section>
          </div>

          <Section title={`Đơn hàng${orders ? ` (${fmtNum(orders.total)})` : ""}`}>
            {orders && orders.items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-stone-400">
                      <tr><th className="py-2">Người mua</th><th className="py-2">Cự ly / Vé</th><th className="py-2 text-right">SL</th><th className="py-2">Trạng thái</th><th className="py-2">Ngày</th></tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {orders.items.map((o) => (
                        <tr key={o.orderId}>
                          <td className="py-2"><div className="font-medium text-stone-800">{o.buyerName || "—"}</div><div className="text-xs text-stone-400">{o.buyerEmail || o.buyerPhone || ""}</div></td>
                          <td className="py-2 text-stone-600">{o.courseName || "—"}{o.ticketTypeName ? ` · ${o.ticketTypeName}` : ""}</td>
                          <td className="py-2 text-right font-mono">{fmtNum(o.quantity)}</td>
                          <td className="py-2 text-xs">{labelOf(FINANCIAL_STATUS_LABEL, o.financialStatus)}</td>
                          <td className="py-2 text-xs text-stone-500">{fmtDate(o.paymentOn)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-stone-400">Trang {orders.page}/{Math.max(1, Math.ceil(orders.total / ORDERS_PAGE_SIZE))}</span>
                  <div className="flex gap-2">
                    <button disabled={ordersPage <= 1} onClick={() => setOrdersPage((p) => p - 1)} className="rounded-md border border-stone-300 px-2.5 py-1 disabled:opacity-40">Trước</button>
                    <button disabled={ordersPage >= Math.ceil((orders.total || 0) / ORDERS_PAGE_SIZE)} onClick={() => setOrdersPage((p) => p + 1)} className="rounded-md border border-stone-300 px-2.5 py-1 disabled:opacity-40">Sau</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-3 text-center text-xs text-stone-400">Chưa có đơn hàng</div>
            )}
          </Section>
        </div>
      ) : (
        /* Revenue tab */
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="GMV (doanh thu gộp)" value={fmtVnd(revSummary?.gmv)} />
            <Card label="Tổng phí 5BIB" value={fmtVnd(revSummary?.totalFee)} sub={`Phí % ${fmtVnd(revSummary?.totalServiceFee)} · cố định ${fmtVnd(revSummary?.totalManualFee)}`} />
            <Card label="Doanh thu ròng (net)" value={fmtVnd(revSummary?.net)} />
            <Card label="Số đơn (paid)" value={fmtNum(revSummary?.orderCount)} />
          </div>

          {!!revSummary?.warnings?.length && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠ {revSummary.warnings.join(" · ")}
            </div>
          )}

          <Section title="Net theo thời gian"><BarChart data={revTrendData} /></Section>

          <Section title="Theo loại phí">
            {(revByCat?.groups ?? []).length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-stone-400">
                  <tr><th className="py-2">Nhóm</th><th className="py-2 text-right">GMV</th><th className="py-2 text-right">Phí</th><th className="py-2 text-right">Net</th><th className="py-2 text-right">Đơn</th></tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(revByCat?.groups ?? []).map((g) => (
                    <tr key={g.groupKey}>
                      <td className="py-2 text-stone-700">{labelOf(CATEGORY_GROUP_LABEL, g.groupKey)}</td>
                      <td className="py-2 text-right font-mono">{fmtVnd(g.gmv)}</td>
                      <td className="py-2 text-right font-mono text-stone-500">{fmtVnd(g.totalFee)}</td>
                      <td className="py-2 text-right font-mono font-medium">{fmtVnd(g.net)}</td>
                      <td className="py-2 text-right font-mono">{fmtNum(g.orderCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-3 text-center text-xs text-stone-400">Chưa có dữ liệu</div>
            )}
          </Section>

          <button onClick={exportRevenue} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Xuất Excel
          </button>
        </div>
      )}
    </div>
  );
}

function extractMsg(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (m && typeof m === "object") {
      const o = m as { vi?: unknown };
      if (typeof o.vi === "string") return o.vi;
    }
  }
  return "Không tải được dữ liệu";
}
