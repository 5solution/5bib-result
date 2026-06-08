"use client";

/**
 * F-069 — Merchant race report (merchant.5bib.com/races/[raceId]).
 * 5Solution "Velocity" design. Two tabs:
 *   • "Báo cáo bán vé" (ticket) — always.
 *   • "Báo cáo doanh thu" (revenue) — only if permission revenue_report.
 *
 * Period (7d/30d/90d) drives the trend charts only — summary / breakdown
 * endpoints are race-total (backend accepts raceId only). Granularity
 * toggles per trend card.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { useLang } from "@/lib/mp/lang-context";
import {
  merchantPortalControllerGetMe,
  merchantPortalControllerGetRaces,
  merchantPortalControllerGetTicketSalesSummary,
  merchantPortalControllerGetTicketSalesByCourse,
  merchantPortalControllerGetTicketSalesByType,
  merchantPortalControllerGetTicketSalesTrend,
  merchantPortalControllerGetTicketSalesOrders,
  merchantPortalControllerGetTicketForecast,
  merchantPortalControllerGetTicketHeatmap,
  merchantPortalControllerSetTicketTarget,
  merchantPortalControllerGetRevenueSummary,
  merchantPortalControllerGetRevenueByCategory,
  merchantPortalControllerGetRevenueTrend,
  merchantPortalControllerGetParticipantInsights,
  merchantPortalControllerGetCapacity,
  merchantPortalControllerGetYoyComparable,
  merchantPortalControllerGetYoyCurve,
} from "@/lib/api-generated/sdk.gen";
import type {
  MerchantMeResponseDto,
  MerchantRaceItemDto,
  TicketSalesSummaryDto,
  TicketSalesBreakdownDto,
  TicketTrendDto,
  TicketOrderListDto,
  TicketForecastDto,
  TicketHeatmapDto,
  RevenueSummaryDto,
  RevenueByCategoryDto,
  RevenueTrendDto,
  ParticipantInsightsDto,
  RaceCapacityDto,
  YoyComparableDto,
  YoyCurveDto,
} from "@/lib/api-generated/types.gen";
import { t, lab, L, type Lang } from "@/lib/mp/i18n";
import { fmt, fmtDateStr, parseDate } from "@/lib/mp/fmt";
import {
  AppShell,
  Btn,
  Card,
  EmptyState,
  KpiCard,
  OrderStatusBadge,
  RaceStatusBadge,
  SectionTitle,
  UpdatedFooter,
  type MpUser,
} from "@/components/mp/ui";
import { Icons } from "@/components/mp/icons";
import {
  AreaChart,
  CH,
  Donut,
  Funnel,
  GranularityToggle,
  HBars,
  Heatmap,
  MultiLineChart,
  PaceChart,
  PeriodSelector,
  type DonutItem,
  type GranularityValue,
  type MultiLinePoint,
  type PeriodValue,
} from "@/components/mp/charts";

const ORDERS_PAGE_SIZE = 8;

function extractMsg(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; vi?: unknown; en?: unknown };
    const m = e.message;
    if (typeof m === "string") return m;
    if (m && typeof m === "object") {
      const o = m as { vi?: unknown; en?: unknown };
      if (typeof o.vi === "string") return o.vi;
      if (typeof o.en === "string") return o.en;
    }
    if (typeof e.vi === "string") return e.vi;
    if (typeof e.en === "string") return e.en;
  }
  return "Không tải được dữ liệu";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function toMpUser(me: MerchantMeResponseDto | null): MpUser {
  if (!me) return { name: "—", email: "", initials: "?" };
  return { name: me.userName, email: me.email, initials: initialsOf(me.userName) };
}

function defaultGran(period: PeriodValue): GranularityValue {
  return period === "90d" ? "weekly" : "daily";
}

// status helper: find ticketCount for a financial_status
function statusCount(summary: TicketSalesSummaryDto | null, status: string): number {
  return summary?.byStatus.find((s) => s.financialStatus === status)?.ticketCount ?? 0;
}

// ---------- Tabs ----------
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mp-focusable"
      style={{
        padding: "10px 4px",
        marginRight: 24,
        fontSize: 14,
        fontWeight: 700,
        fontFamily: "var(--font-body)",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: active ? "var(--5s-blue)" : "var(--5s-text-muted)",
        borderBottom: active ? "2px solid var(--5s-blue)" : "2px solid transparent",
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

// ---------- table cell primitives (hoisted; created once) ----------
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{ textAlign: right ? "right" : "left", padding: "10px 22px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--5s-text-subtle)" }}>
      {children}
    </th>
  );
}
function Td({ children, right, mono, bold }: { children: React.ReactNode; right?: boolean; mono?: boolean; bold?: boolean }) {
  return (
    <td
      style={{
        textAlign: right ? "right" : "left",
        padding: "12px 22px",
        fontSize: 13,
        color: "var(--5s-text)",
        fontWeight: bold ? 800 : 500,
        fontFamily: mono || right ? "var(--font-mono)" : "inherit",
      }}
    >
      {children}
    </td>
  );
}

// ---------- Orders table ----------
function OrdersTable({ orders, lang }: { orders: TicketOrderListDto; lang: Lang }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderTop: "1px solid var(--5s-border)", borderBottom: "1px solid var(--5s-border)", background: "var(--5s-bg)" }}>
          <Th>{t("th_no", lang)}</Th>
          <Th>{t("th_buyer", lang)}</Th>
          <Th>{t("th_date", lang)}</Th>
          <Th>{t("th_course", lang)}</Th>
          <Th>{t("th_ticket", lang)}</Th>
          <Th right>{t("th_qty", lang)}</Th>
          <Th>{t("th_status", lang)}</Th>
        </tr>
      </thead>
      <tbody>
        {orders.items.map((o, i) => {
          const d = parseDate(o.paymentOn);
          return (
            <tr key={o.orderId} style={{ borderBottom: "1px solid var(--5s-surface)" }}>
              <Td mono>{(orders.page - 1) * orders.pageSize + i + 1}</Td>
              <Td>
                <div style={{ fontWeight: 600, color: "var(--5s-text)" }}>{o.buyerName || "—"}</div>
                <div style={{ fontSize: 11.5, color: "var(--5s-text-subtle)" }}>{o.buyerEmail || o.buyerPhone || ""}</div>
              </Td>
              <Td mono>{d ? fmt.dateTime(d) : "—"}</Td>
              <Td>
                <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 6, background: "var(--5s-blue-50)", color: "var(--5s-blue)", fontSize: 12, fontWeight: 700 }}>
                  {o.courseName || "—"}
                </span>
              </Td>
              <Td>{o.ticketTypeName || "—"}</Td>
              <Td right mono>{fmt.num(o.quantity, lang)}</Td>
              <Td>
                <OrderStatusBadge status={o.financialStatus} lang={lang} />
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------- Revenue breakdown table ----------
function RevenueBreakdownTable({ rev, lang }: { rev: RevenueByCategoryDto; lang: Lang }) {
  const groupColor: Record<string, string> = { fee_percent: "var(--5s-blue)", fee_fixed: "var(--5s-energy)" };
  const totalGmv = rev.gmv || 0;
  const totalFee = rev.groups.reduce((a, g) => a + g.totalFee, 0);
  const totalNet = rev.groups.reduce((a, g) => a + g.net, 0);
  const totalOrders = rev.groups.reduce((a, g) => a + g.orderCount, 0);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderTop: "1px solid var(--5s-border)", borderBottom: "1px solid var(--5s-border)", background: "var(--5s-bg)" }}>
          <Th>{t("order_type", lang)}</Th>
          <Th right>{t("th_orders", lang)}</Th>
          <Th right>GMV</Th>
          <Th right>{t("kpi_fee", lang)}</Th>
          <Th right>{t("kpi_net", lang)}</Th>
          <Th right>{t("th_pct_gmv", lang)}</Th>
        </tr>
      </thead>
      <tbody>
        {rev.groups.map((g) => (
          <tr key={g.groupKey} style={{ borderBottom: "1px solid var(--5s-surface)" }}>
            <Td>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: groupColor[g.groupKey] ?? "var(--5s-border-strong)" }} />
                {lab(L.feeGroup, g.groupKey, lang)}
              </span>
            </Td>
            <Td right>{fmt.num(g.orderCount, lang)}</Td>
            <Td right>{fmt.vnd(g.gmv, lang)}</Td>
            <Td right>{fmt.vnd(g.totalFee, lang)}</Td>
            <Td right>{fmt.vnd(g.net, lang)}</Td>
            <Td right>{totalGmv > 0 ? ((g.gmv / totalGmv) * 100).toFixed(1) : "0.0"}%</Td>
          </tr>
        ))}
        <tr style={{ background: "var(--5s-bg)", borderTop: "2px solid var(--5s-border)" }}>
          <Td bold>{t("total_row", lang)}</Td>
          <Td right bold>{fmt.num(totalOrders, lang)}</Td>
          <Td right bold>{fmt.vnd(totalGmv, lang)}</Td>
          <Td right bold>{fmt.vnd(totalFee, lang)}</Td>
          <Td right bold>{fmt.vnd(totalNet, lang)}</Td>
          <Td right bold>100%</Td>
        </tr>
      </tbody>
    </table>
  );
}

// ---------- F-074 YoY card ----------
function YoYCard({
  cands,
  compareId,
  onPick,
  curve,
  lang,
}: {
  cands: YoyComparableDto | null;
  compareId: number | null;
  onPick: (id: number | null) => void;
  curve: YoyCurveDto | null;
  lang: Lang;
}) {
  const candidates = cands?.candidates ?? [];

  const data: MultiLinePoint[] = useMemo(() => {
    if (!curve) return [];
    const cur = curve.current.points;
    const cmp = curve.compare.points;
    const merged = cur.map((p, i) => ({
      label: `${p.daysBefore}`,
      current: p.cum,
      compare: cmp[i]?.cum ?? 0,
    }));
    // trim leading stretch where both series are 0
    const first = merged.findIndex((m) => m.current > 0 || m.compare > 0);
    return first <= 0 ? merged : merged.slice(first);
  }, [curve]);

  const series = useMemo(
    () => [
      { key: "current", color: CH.blue, label: t("this_race", lang) },
      { key: "compare", color: CH.textSubtle, label: curve?.compare.title || t("vs_prev", lang) },
    ],
    [lang, curve],
  );

  return (
    <Card style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <SectionTitle>{t("yoy_title", lang)}</SectionTitle>
        {candidates.length > 0 ? (
          <select
            value={compareId ?? ""}
            onChange={(e) => onPick(e.target.value ? Number(e.target.value) : null)}
            className="mp-focusable"
            style={{ border: "1px solid var(--5s-border)", background: "#fff", borderRadius: 9, padding: "7px 11px", fontSize: 13, fontWeight: 600, color: "var(--5s-text)", maxWidth: 320, cursor: "pointer" }}
          >
            <option value="">{t("yoy_pick", lang)}</option>
            {candidates.map((c) => (
              <option key={c.raceId} value={c.raceId}>
                {c.title || `#${c.raceId}`}
                {c.eventStartDate ? ` · ${fmtDateStr(c.eventStartDate, lang)}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--5s-text-subtle)" }}>{t("yoy_empty", lang)}</span>
        )}
      </div>
      {compareId == null ? (
        <div style={{ padding: "28px 0", textAlign: "center", fontSize: 13, color: "var(--5s-text-subtle)" }}>
          {t("yoy_pick", lang)}
        </div>
      ) : curve && data.length > 0 ? (
        <>
          <MultiLineChart data={data} lang={lang} width={1080} height={260} series={series} />
          <div style={{ fontSize: 11.5, color: "var(--5s-text-subtle)", marginTop: 6, textAlign: "right" }}>
            ← {t("days_before_unit", lang)}
          </div>
        </>
      ) : (
        <div style={{ padding: "28px 0", textAlign: "center", fontSize: 13, color: "var(--5s-text-subtle)" }}>
          {t("not_enough_data", lang)}
        </div>
      )}
    </Card>
  );
}

// ---------- F-073 Capacity / quota card ----------
function CapacityCard({ data, lang }: { data: RaceCapacityDto; lang: Lang }) {
  if (!data.courses.length) return null;
  const barColor = (pct: number) =>
    pct >= 90 ? "var(--5s-danger)" : pct >= 70 ? "var(--5s-energy)" : "var(--5s-blue)";
  return (
    <Card style={{ marginBottom: 18 }}>
      <SectionTitle>{t("capacity_title", lang)}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
        {data.courses.map((c) => (
          <div key={c.courseId}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--5s-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.courseName}>
                {c.courseName}
              </span>
              <span style={{ fontSize: 12, color: "var(--5s-text-muted)", fontFamily: "var(--font-mono)", flex: "0 0 auto" }}>
                {c.unlimited ? (
                  t("unlimited_word", lang)
                ) : (
                  <>
                    {fmt.num(c.sold, lang)} / {fmt.num(c.quota, lang)} · {c.pctFilled.toFixed(1)}%
                  </>
                )}
              </span>
            </div>
            {!c.unlimited && (
              <div style={{ height: 9, borderRadius: 99, background: "var(--5s-surface)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, c.pctFilled)}%`, background: barColor(c.pctFilled), borderRadius: 99, transition: "width .3s" }} />
              </div>
            )}
            {!c.unlimited && (
              <div style={{ fontSize: 11, color: "var(--5s-text-subtle)", marginTop: 3 }}>
                {t("remaining_word", lang)}: {fmt.num(c.remaining, lang)}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- F-072 Participants tab ----------
function ParticipantsTab({
  data,
  lang,
  exporting,
  onExport,
}: {
  data: ParticipantInsightsDto | null;
  lang: Lang;
  exporting: boolean;
  onExport: () => void;
}) {
  const toBars = (b: { label: string; count: number }[]) =>
    b.map((x) => ({ name: x.label, count: x.count }));
  const toDonut = (b: { label: string; count: number }[]): DonutItem[] =>
    b.map((x) => ({ key: x.label, vi: x.label, en: x.label, count: x.count }));

  if (!data) {
    return (
      <div className="shimmer" style={{ height: 280, borderRadius: 14, background: "var(--5s-surface)" }} />
    );
  }
  if (data.totalParticipants === 0) {
    return <EmptyState icon={Icons.Users} title={t("no_participants", lang)} body={t("no_participants", lang)} />;
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <KpiCard icon={Icons.Users} iconBg="var(--5s-blue-50)" iconFg="var(--5s-blue)" label={t("kpi_participants", lang)} value={fmt.num(data.totalParticipants, lang)} lang={lang} />
        <Btn variant="secondary" icon={Icons.Download} onClick={onExport} disabled={exporting}>
          {exporting ? t("exporting", lang) : t("export_size", lang)}
        </Btn>
      </div>

      <Card style={{ marginBottom: 18 }}>
        <SectionTitle>{t("by_size", lang)}</SectionTitle>
        {data.shirtSizes.some((s) => s.label !== "Khác" && s.label !== "Không rõ") ? (
          <HBars items={toBars(data.shirtSizes)} lang={lang} color={CH.blue} />
        ) : (
          <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--5s-text-subtle)" }}>
            {t("no_size_data", lang)}
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <Card>
          <SectionTitle>{t("by_gender", lang)}</SectionTitle>
          <Donut items={toDonut(data.genders)} lang={lang} />
        </Card>
        <Card>
          <SectionTitle>{t("by_agegroup", lang)}</SectionTitle>
          <HBars items={toBars(data.ageGroups)} lang={lang} color={CH.blue} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <SectionTitle>{t("by_nationality", lang)}</SectionTitle>
          <HBars items={toBars(data.nationalities)} lang={lang} color={CH.blue} />
        </Card>
        <Card>
          <SectionTitle>{t("by_province", lang)}</SectionTitle>
          <HBars items={toBars(data.provinces)} lang={lang} color={CH.blue} />
        </Card>
      </div>

      <UpdatedFooter lang={lang} />
    </>
  );
}

export default function RaceReportPage() {
  const params = useParams<{ raceId: string }>();
  const searchParams = useSearchParams();
  const raceId = Number(params?.raceId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lang } = useLang();

  const [me, setMe] = useState<MerchantMeResponseDto | null>(null);
  const [race, setRace] = useState<MerchantRaceItemDto | null>(null);
  const initialTab =
    searchParams?.get("tab") === "revenue"
      ? "revenue"
      : searchParams?.get("tab") === "participants"
        ? "participants"
        : "ticket";
  const [tab, setTab] = useState<"ticket" | "revenue" | "participants">(initialTab);
  const [period, setPeriod] = useState<PeriodValue>("30d");
  const [ticketGran, setTicketGran] = useState<GranularityValue>("daily");
  const [revGran, setRevGran] = useState<GranularityValue>("daily");

  // Ticket
  const [summary, setSummary] = useState<TicketSalesSummaryDto | null>(null);
  const [byCourse, setByCourse] = useState<TicketSalesBreakdownDto | null>(null);
  const [byType, setByType] = useState<TicketSalesBreakdownDto | null>(null);
  const [trend, setTrend] = useState<TicketTrendDto | null>(null);
  const [orders, setOrders] = useState<TicketOrderListDto | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);

  // F-070 MKT analytics
  const [forecast, setForecast] = useState<TicketForecastDto | null>(null);
  const [heatmap, setHeatmap] = useState<TicketHeatmapDto | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [targetErr, setTargetErr] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);

  // F-072 Participant insights
  const [participants, setParticipants] = useState<ParticipantInsightsDto | null>(null);
  const [exporting, setExporting] = useState(false);

  // F-073 Capacity / quota
  const [capacity, setCapacity] = useState<RaceCapacityDto | null>(null);

  // F-074 YoY
  const [yoyCands, setYoyCands] = useState<YoyComparableDto | null>(null);
  const [yoyCompareId, setYoyCompareId] = useState<number | null>(null);
  const [yoyCurve, setYoyCurve] = useState<YoyCurveDto | null>(null);

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
      const idQ = { query: { raceId }, ...authHeaders(token) };
      const trendQ = { query: { raceId, period, granularity: ticketGran }, ...authHeaders(token) };
      const [meR, racesR, sumR, courseR, typeR, trendR, capR] = await Promise.all([
        merchantPortalControllerGetMe({ ...authHeaders(token) }),
        merchantPortalControllerGetRaces({ ...authHeaders(token) }),
        merchantPortalControllerGetTicketSalesSummary(idQ),
        merchantPortalControllerGetTicketSalesByCourse(idQ),
        merchantPortalControllerGetTicketSalesByType(idQ),
        merchantPortalControllerGetTicketSalesTrend(trendQ),
        merchantPortalControllerGetCapacity(idQ),
      ]);
      // capacity is additive — a capacity error must not blank the ticket tab
      const firstErr = [meR, racesR, sumR, courseR, typeR, trendR].find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      setMe(meR.data ?? null);
      setRace(racesR.data?.races.find((r) => r.raceId === raceId) ?? null);
      setSummary(sumR.data ?? null);
      setByCourse(courseR.data ?? null);
      setByType(typeR.data ?? null);
      setTrend(trendR.data ?? null);
      if (!capR.error) setCapacity(capR.data ?? null);
    } catch (err) {
      console.error("[merchant race report] load failed:", err);
      setError(extractMsg(err));
    } finally {
      setLoading(false);
    }
  }, [token, raceId, period, ticketGran]);

  const loadOrders = useCallback(async () => {
    if (!token || !Number.isFinite(raceId)) return;
    const r = await merchantPortalControllerGetTicketSalesOrders({
      query: { raceId, page: ordersPage, pageSize: ORDERS_PAGE_SIZE },
      ...authHeaders(token),
    });
    if (!r.error) setOrders(r.data ?? null);
  }, [token, raceId, ordersPage]);

  const loadAnalytics = useCallback(async () => {
    if (!token || !Number.isFinite(raceId)) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const idQ = { query: { raceId }, ...authHeaders(token) };
      const [fcR, hmR] = await Promise.all([
        merchantPortalControllerGetTicketForecast(idQ),
        merchantPortalControllerGetTicketHeatmap(idQ),
      ]);
      const firstErr = [fcR, hmR].find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      setForecast(fcR.data ?? null);
      setHeatmap(hmR.data ?? null);
      // seed target input with saved value (only when non-null)
      const tg = fcR.data?.target;
      setTargetInput(tg != null && tg > 0 ? String(tg) : "");
      setTargetErr(null);
    } catch (err) {
      console.error("[merchant race report] analytics load failed:", err);
      setAnalyticsError(extractMsg(err));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [token, raceId]);

  const savedTarget = forecast?.target != null && forecast.target > 0 ? forecast.target : null;

  const saveTarget = useCallback(async () => {
    if (!token || !Number.isFinite(raceId)) return;
    const trimmed = targetInput.trim();
    if (trimmed === "") return;
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) {
      setTargetErr(t("target_invalid", lang));
      return;
    }
    setTargetErr(null);
    setSavingTarget(true);
    try {
      const r = await merchantPortalControllerSetTicketTarget({
        body: { raceId, target: n },
        ...authHeaders(token),
      });
      if (r.error) throw r.error;
      toast.success(t("target_saved", lang));
      await loadAnalytics();
    } catch (err) {
      console.error("[merchant race report] save target failed:", err);
      toast.error(extractMsg(err));
    } finally {
      setSavingTarget(false);
    }
  }, [token, raceId, targetInput, lang, loadAnalytics]);

  const loadRevenue = useCallback(async () => {
    if (!token || !Number.isFinite(raceId) || !hasRevenue) return;
    const idQ = { query: { raceId }, ...authHeaders(token) };
    const trendQ = { query: { raceId, period, granularity: revGran }, ...authHeaders(token) };
    const [sR, cR, tR] = await Promise.all([
      merchantPortalControllerGetRevenueSummary(idQ),
      merchantPortalControllerGetRevenueByCategory(idQ),
      merchantPortalControllerGetRevenueTrend(trendQ),
    ]);
    if (!sR.error) setRevSummary(sR.data ?? null);
    if (!cR.error) setRevByCat(cR.data ?? null);
    if (!tR.error) setRevTrend(tR.data ?? null);
  }, [token, raceId, hasRevenue, period, revGran]);

  const loadParticipants = useCallback(async () => {
    if (!token || !Number.isFinite(raceId)) return;
    const res = await merchantPortalControllerGetParticipantInsights({
      query: { raceId },
      ...authHeaders(token),
    });
    if (!res.error) setParticipants(res.data ?? null);
  }, [token, raceId]);

  const exportSize = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Goes through the runtime /api proxy (injects Logto token server-side).
      const resp = await fetch(
        `/api/merchant-portal/participants/export?raceId=${raceId}`,
      );
      if (!resp.ok) throw new Error(String(resp.status));
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `co-cau-vdv-race-${raceId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* swallow — button returns to idle */
    } finally {
      setExporting(false);
    }
  }, [raceId, exporting]);

  useEffect(() => {
    if (isAuthenticated && tab === "participants") loadParticipants();
  }, [isAuthenticated, tab, loadParticipants]);

  const loadYoyCandidates = useCallback(async () => {
    if (!token || !Number.isFinite(raceId)) return;
    const r = await merchantPortalControllerGetYoyComparable({ query: { raceId }, ...authHeaders(token) });
    if (!r.error) setYoyCands(r.data ?? null);
  }, [token, raceId]);

  const loadYoyCurve = useCallback(async () => {
    if (!token || !Number.isFinite(raceId) || yoyCompareId == null) {
      setYoyCurve(null);
      return;
    }
    const r = await merchantPortalControllerGetYoyCurve({
      query: { raceId, compareRaceId: yoyCompareId },
      ...authHeaders(token),
    });
    if (!r.error) setYoyCurve(r.data ?? null);
  }, [token, raceId, yoyCompareId]);

  useEffect(() => {
    if (isAuthenticated) loadYoyCandidates();
  }, [isAuthenticated, loadYoyCandidates]);
  useEffect(() => {
    if (isAuthenticated) loadYoyCurve();
  }, [isAuthenticated, loadYoyCurve]);

  useEffect(() => {
    if (isAuthenticated) loadCore();
  }, [isAuthenticated, loadCore]);
  useEffect(() => {
    if (isAuthenticated) loadOrders();
  }, [isAuthenticated, loadOrders]);
  useEffect(() => {
    if (isAuthenticated) loadAnalytics();
  }, [isAuthenticated, loadAnalytics]);
  useEffect(() => {
    if (isAuthenticated && tab === "revenue") loadRevenue();
  }, [isAuthenticated, tab, loadRevenue]);

  const user = useMemo(() => toMpUser(me), [me]);
  const raceTitle = race?.title ?? `${t("nav_races", lang)} #${raceId}`;

  // chart data adapters
  const ticketTrendData = useMemo(
    () => (trend?.series ?? []).map((p) => ({ label: p.label, count: p.orderCount, fullLabel: p.label })),
    [trend],
  );
  const courseBars = useMemo(() => (byCourse?.items ?? []).map((it) => ({ name: it.name, count: it.ticketCount })), [byCourse]);
  const typeDonut: DonutItem[] = useMemo(
    () => (byType?.items ?? []).map((it) => ({ key: String(it.id), vi: it.name, en: it.name, count: it.ticketCount })),
    [byType],
  );
  const revTrendData: MultiLinePoint[] = useMemo(
    () => (revTrend?.series ?? []).map((p) => ({ label: p.label, fullLabel: p.label, gmv: p.gmv, totalFee: p.totalFee, net: p.net })),
    [revTrend],
  );
  const revSeries = useMemo(
    () => [
      { key: "gmv", color: CH.blue, label: "GMV" },
      { key: "totalFee", color: CH.energy, label: t("kpi_fee", lang) },
      { key: "net", color: CH.green, label: t("kpi_net", lang) },
    ],
    [lang],
  );

  const totalPages = orders ? Math.max(1, Math.ceil(orders.total / ORDERS_PAGE_SIZE)) : 1;

  function exportRevenue() {
    window.open(`/api/merchant-portal/revenue/export?raceId=${raceId}`, "_blank");
  }

  if (authLoading || (!isAuthenticated && !error)) {
    return (
      <div className="mp-root" style={{ display: "grid", minHeight: "100vh", placeItems: "center", fontSize: 14, color: "var(--5s-text-muted)", background: "var(--5s-bg)" }}>
        {t("loading", lang)}
      </div>
    );
  }

  const center = <PeriodSelector value={period} onChange={(v) => { setPeriod(v); const g = defaultGran(v); setTicketGran(g); setRevGran(g); }} lang={lang} />;

  return (
    <AppShell
      lang={lang}
      finance={hasRevenue}
      active="races"
      breadcrumb={[t("nav_races", lang), raceTitle]}
      center={center}
      showRefresh
      onRefresh={() => {
        loadCore();
        loadOrders();
        loadAnalytics();
        if (tab === "revenue") loadRevenue();
      }}
      user={user}
      currentRaceId={Number.isFinite(raceId) ? raceId : undefined}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <a href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "var(--5s-blue)", textDecoration: "none", marginBottom: 8 }}>
            <Icons.ChevR size={13} color="var(--5s-blue)" style={{ transform: "scaleX(-1)" }} />
            {t("all_races_link", lang)}
          </a>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em" }}>{raceTitle}</h1>
          {race && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 6 }}>
              <span style={{ fontSize: 13, color: "var(--5s-text-muted)" }} className="mp-data">
                {fmtDateStr(race.eventStartDate, lang)}
              </span>
              <RaceStatusBadge status={race.status} lang={lang} />
            </div>
          )}
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--5s-border)", marginBottom: 22 }}>
        <TabButton active={tab === "ticket"} onClick={() => setTab("ticket")}>
          {t("ticket_report", lang)}
        </TabButton>
        {hasRevenue && (
          <TabButton active={tab === "revenue"} onClick={() => setTab("revenue")}>
            {t("revenue_report", lang)}
          </TabButton>
        )}
        <TabButton active={tab === "participants"} onClick={() => setTab("participants")}>
          {t("participants_report", lang)}
        </TabButton>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="shimmer" style={{ flex: 1, height: 110, borderRadius: 14, background: "var(--5s-surface)" }} />
            ))}
          </div>
          <div className="shimmer" style={{ height: 280, borderRadius: 14, background: "var(--5s-surface)" }} />
        </div>
      ) : error ? (
        <Card style={{ borderColor: "var(--5s-danger)", background: "var(--5s-danger-bg)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "12px 0" }}>
            <Icons.Alert size={28} color="var(--5s-danger)" />
            <p style={{ fontSize: 14, color: "var(--5s-danger)", textAlign: "center", margin: 0 }}>{error}</p>
            <button onClick={loadCore} className="mp-focusable" style={{ border: "1px solid var(--5s-border)", background: "#fff", borderRadius: 9, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {t("retry", lang)}
            </button>
          </div>
        </Card>
      ) : tab === "ticket" ? (
        <>
          {/* KPIs */}
          <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
            <KpiCard icon={Icons.Ticket} iconBg="var(--5s-blue-50)" iconFg="var(--5s-blue)" label={t("kpi_total", lang)} value={fmt.num(summary?.totalTickets ?? 0, lang)} lang={lang} />
            <KpiCard icon={Icons.CheckCircle} iconBg="var(--5s-success-bg)" iconFg="var(--5s-success)" label={t("kpi_paid", lang)} value={fmt.num(statusCount(summary, "paid"), lang)} lang={lang} />
            <KpiCard icon={Icons.Clock} iconBg="var(--5s-warning-bg)" iconFg="var(--5s-warning)" label={t("kpi_pending", lang)} value={fmt.num(statusCount(summary, "pending"), lang)} lang={lang} />
            <KpiCard icon={Icons.XCircle} iconBg="var(--5s-danger-bg)" iconFg="var(--5s-danger)" label={t("kpi_cancelled", lang)} value={fmt.num(statusCount(summary, "voided"), lang)} lang={lang} />
          </div>

          {/* Registration trend */}
          <Card style={{ marginBottom: 18 }}>
            <SectionTitle right={<GranularityToggle value={ticketGran} onChange={setTicketGran} lang={lang} />}>{t("trend_reg", lang)}</SectionTitle>
            <AreaChart data={ticketTrendData} lang={lang} width={1080} height={250} />
          </Card>

          {/* By course + by type */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
            <Card>
              <SectionTitle>{t("by_course", lang)}</SectionTitle>
              <HBars items={courseBars} lang={lang} />
            </Card>
            <Card>
              <SectionTitle>{t("by_ticket_type", lang)}</SectionTitle>
              <Donut items={typeDonut} lang={lang} />
            </Card>
          </div>

          {/* F-073 — Capacity / quota */}
          {capacity && capacity.courses.length > 0 && (
            <CapacityCard data={capacity} lang={lang} />
          )}

          {/* Orders table */}
          <Card pad={0}>
            <div style={{ padding: "18px 22px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>
                {t("order_detail", lang)}
                {orders ? ` · ${fmt.num(orders.total, lang)}` : ""}
              </h3>
            </div>
            {orders && orders.items.length > 0 ? (
              <>
                <OrdersTable orders={orders} lang={lang} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", fontSize: 13 }}>
                  <span style={{ color: "var(--5s-text-subtle)" }}>
                    {t("page_word", lang)} {orders.page}/{totalPages}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      disabled={ordersPage <= 1}
                      onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                      className="mp-focusable"
                      style={{ border: "1px solid var(--5s-border)", background: "#fff", borderRadius: 8, padding: "6px 13px", fontSize: 13, fontWeight: 700, cursor: ordersPage <= 1 ? "default" : "pointer", opacity: ordersPage <= 1 ? 0.4 : 1 }}
                    >
                      {t("prev_page", lang)}
                    </button>
                    <button
                      disabled={ordersPage >= totalPages}
                      onClick={() => setOrdersPage((p) => p + 1)}
                      className="mp-focusable"
                      style={{ border: "1px solid var(--5s-border)", background: "#fff", borderRadius: 8, padding: "6px 13px", fontSize: 13, fontWeight: 700, cursor: ordersPage >= totalPages ? "default" : "pointer", opacity: ordersPage >= totalPages ? 0.4 : 1 }}
                    >
                      {t("next_page", lang)}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "8px 0 24px" }}>
                <EmptyState icon={Icons.Inbox} title={t("no_orders", lang)} body={t("no_data", lang)} />
              </div>
            )}
          </Card>

          {/* F-070 — MKT analytics */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "30px 0 16px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--5s-magenta)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", color: "var(--5s-text)" }}>
              {t("mkt_analytics", lang)}
            </h2>
          </div>

          {analyticsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="shimmer" style={{ height: 250, borderRadius: 14, background: "var(--5s-surface)" }} />
              ))}
            </div>
          ) : analyticsError ? (
            <Card style={{ borderColor: "var(--5s-danger)", background: "var(--5s-danger-bg)" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "12px 0" }}>
                <Icons.Alert size={28} color="var(--5s-danger)" />
                <p style={{ fontSize: 14, color: "var(--5s-danger)", textAlign: "center", margin: 0 }}>{analyticsError}</p>
                <button onClick={loadAnalytics} className="mp-focusable" style={{ border: "1px solid var(--5s-border)", background: "#fff", borderRadius: 9, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {t("retry", lang)}
                </button>
              </div>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Forecast card */}
              <Card>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--5s-text)" }}>{t("forecast_title", lang)}</h3>
                  {forecast?.raceEnded ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 99, background: "var(--5s-surface)", color: "var(--5s-text-subtle)", fontSize: 12, fontWeight: 700 }}>
                      {t("race_ended_note", lang)}
                    </span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label htmlFor="mkt-target" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--5s-text-muted)" }}>
                          {t("ticket_target", lang)}
                        </label>
                        <input
                          id="mkt-target"
                          type="number"
                          min={0}
                          max={10_000_000}
                          step={1}
                          value={targetInput}
                          onChange={(e) => {
                            setTargetInput(e.target.value);
                            if (targetErr) setTargetErr(null);
                          }}
                          className="mp-focusable"
                          style={{
                            width: 130,
                            padding: "7px 11px",
                            border: `1px solid ${targetErr ? "var(--5s-danger)" : "var(--5s-border)"}`,
                            borderRadius: 9,
                            fontSize: 13,
                            fontFamily: "var(--font-mono)",
                            color: "var(--5s-text)",
                            background: "#fff",
                          }}
                        />
                        <Btn
                          variant="primary"
                          size="sm"
                          onClick={saveTarget}
                          disabled={savingTarget || targetInput.trim() === "" || (savedTarget != null && Number(targetInput.trim()) === savedTarget)}
                        >
                          {savingTarget ? t("saving", lang) : t("save", lang)}
                        </Btn>
                      </div>
                      {targetErr && <span style={{ fontSize: 11.5, color: "var(--5s-danger)" }}>{targetErr}</span>}
                    </div>
                  )}
                </div>
                {forecast ? (
                  <PaceChart data={forecast} lang={lang} target={forecast.raceEnded ? null : savedTarget} />
                ) : (
                  <EmptyState icon={Icons.Inbox} title={t("no_reg_data", lang)} body={t("no_data", lang)} />
                )}
              </Card>

              {/* Heatmap card */}
              <Card>
                <SectionTitle>{t("heatmap_title", lang)}</SectionTitle>
                {heatmap ? (
                  <Heatmap data={heatmap} lang={lang} />
                ) : (
                  <EmptyState icon={Icons.Inbox} title={t("no_reg_data", lang)} body={t("no_data", lang)} />
                )}
              </Card>

              {/* Funnel card */}
              <Card>
                <SectionTitle>{t("funnel_title", lang)}</SectionTitle>
                {summary ? (
                  <Funnel summary={summary} lang={lang} />
                ) : (
                  <EmptyState icon={Icons.Inbox} title={t("no_reg_data", lang)} body={t("no_data", lang)} />
                )}
              </Card>
            </div>
          )}

          {/* F-074 — YoY so với mùa trước */}
          <YoYCard
            cands={yoyCands}
            compareId={yoyCompareId}
            onPick={setYoyCompareId}
            curve={yoyCurve}
            lang={lang}
          />

          <UpdatedFooter lang={lang} />
        </>
      ) : tab === "revenue" ? (
        /* Revenue tab (finance only) */
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              {!!revSummary && revSummary.gmv > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 99, background: "var(--5s-warning-bg)", color: "var(--5s-warning)", fontSize: 12, fontWeight: 700 }}>
                  {t("fee_rate_now", lang)}: {((revSummary.totalFee / revSummary.gmv) * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <Btn variant="secondary" icon={Icons.Download} onClick={exportRevenue}>
              {t("export_excel", lang)}
            </Btn>
          </div>

          {!!revSummary?.warnings?.length && (
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 16px", background: "var(--5s-warning-bg)", border: "1px solid #FCD34D", borderRadius: 12, marginBottom: 18 }}>
              <Icons.Alert size={18} color="var(--5s-warning)" />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#92400E" }}>{revSummary.warnings.join(" · ")}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
            <KpiCard icon={Icons.Dollar} iconBg="var(--5s-blue-50)" iconFg="var(--5s-blue)" label={t("kpi_gmv", lang)} value={fmt.vnd(revSummary?.gmv ?? 0, lang)} lang={lang} />
            <KpiCard icon={Icons.Shield} iconBg="#FFEDD5" iconFg="var(--5s-energy)" label={t("kpi_fee", lang)} value={fmt.vnd(revSummary?.totalFee ?? 0, lang)} lang={lang} accent="var(--5s-energy)" />
            <KpiCard icon={Icons.CheckCircle} iconBg="var(--5s-success-bg)" iconFg="var(--5s-success)" label={t("kpi_net", lang)} value={fmt.vnd(revSummary?.net ?? 0, lang)} lang={lang} accent="var(--5s-success)" />
            <KpiCard icon={Icons.Ticket} iconBg="var(--5s-surface)" iconFg="var(--5s-text-muted)" label={t("kpi_orders", lang)} value={fmt.num(revSummary?.orderCount ?? 0, lang)} lang={lang} />
          </div>

          <Card style={{ marginBottom: 18 }}>
            <SectionTitle right={<GranularityToggle value={revGran} onChange={setRevGran} lang={lang} />}>{t("trend_rev", lang)}</SectionTitle>
            <MultiLineChart data={revTrendData} lang={lang} width={1080} height={260} series={revSeries} />
          </Card>

          <Card pad={0}>
            <div style={{ padding: "18px 22px 4px" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{t("breakdown_cat", lang)}</h3>
            </div>
            {revByCat ? (
              <RevenueBreakdownTable rev={revByCat} lang={lang} />
            ) : (
              <div style={{ padding: "8px 0 24px" }}>
                <EmptyState icon={Icons.Inbox} title={t("no_data", lang)} body={t("no_data", lang)} />
              </div>
            )}
          </Card>
          <UpdatedFooter lang={lang} />
        </>
      ) : (
        /* F-072 Participants tab (ticket-scope, no-PII) */
        <ParticipantsTab
          data={participants}
          lang={lang}
          exporting={exporting}
          onExport={exportSize}
        />
      )}
    </AppShell>
  );
}
