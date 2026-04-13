"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Clock, AlertCircle, X } from "lucide-react";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelData {
  paidOrders: number;
  voidedOrders: number;
  conversionRate: number;
  voidRate: number;
  avgTimeToPay: number | null;
  breakdownByCategory: {
    financialStatus: string;
    orderCategory: string;
    count: number;
  }[];
}

// ─── Funnel SVG ───────────────────────────────────────────────────────────────

function FunnelViz({
  created,
  paid,
  voided,
}: {
  created: number;
  paid: number;
  voided: number;
}) {
  const width = 400;
  const height = 260;
  const topWidth = 300;
  const midWidth = Math.max(60, (paid / Math.max(created, 1)) * topWidth);
  const voidWidth = Math.max(30, (voided / Math.max(created, 1)) * topWidth);

  const cx = width / 2;
  const step = 80;
  const y0 = 20;
  const y1 = y0 + step;
  const y2 = y1 + step;

  // Top trapezoid: Created → Paid
  const topPath = [
    `M ${cx - topWidth / 2} ${y0}`,
    `L ${cx + topWidth / 2} ${y0}`,
    `L ${cx + midWidth / 2} ${y1}`,
    `L ${cx - midWidth / 2} ${y1}`,
    "Z",
  ].join(" ");

  // Paid trapezoid (continuation down)
  const paidPath = [
    `M ${cx - midWidth / 2} ${y1}`,
    `L ${cx + midWidth / 2} ${y1}`,
    `L ${cx + midWidth / 2 - 10} ${y2}`,
    `L ${cx - midWidth / 2 + 10} ${y2}`,
    "Z",
  ].join(" ");

  // Void side drip
  const voidPath = [
    `M ${cx + topWidth / 2} ${y0}`,
    `L ${cx + topWidth / 2 + voidWidth} ${y0}`,
    `L ${cx + topWidth / 2 + voidWidth * 0.7} ${y1}`,
    `L ${cx + midWidth / 2} ${y1}`,
    "Z",
  ].join(" ");

  function fmt(n: number) {
    return n.toLocaleString("vi-VN");
  }

  const convPct = created > 0 ? ((paid / created) * 100).toFixed(1) : "0";
  const voidPct = created > 0 ? ((voided / created) * 100).toFixed(1) : "0";

  return (
    <div className="flex justify-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-sm">
        {/* Top: Created */}
        <path d={topPath} fill="#3b82f6" fillOpacity="0.7" />
        <text x={cx} y={y0 + step / 2} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="white" fontWeight="600">
          {fmt(created)} tạo
        </text>

        {/* Arrow connector */}
        <line x1={cx} y1={y1} x2={cx} y2={y1 + 8} stroke="#3b82f6" strokeWidth="2" />
        <polygon points={`${cx},${y1 + 16} ${cx - 6},${y1 + 8} ${cx + 6},${y1 + 8}`} fill="#3b82f6" />

        {/* Mid: Paid */}
        <path d={paidPath} fill="#10b981" fillOpacity="0.8" />
        <text x={cx} y={y1 + step / 2} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="white" fontWeight="600">
          {fmt(paid)} thanh toán
        </text>
        <text x={cx} y={y1 + step / 2 + 14} textAnchor="middle" fontSize="9" fill="white" opacity="0.8">
          {convPct}% conversion
        </text>

        {/* Voided side bubble */}
        {voided > 0 && (
          <>
            <path d={voidPath} fill="#ef4444" fillOpacity="0.65" />
            <text
              x={cx + topWidth / 2 + voidWidth / 2}
              y={y0 + step / 3}
              textAnchor="middle"
              fontSize="10"
              fill="white"
              fontWeight="600"
            >
              {fmt(voided)}
            </text>
            <text
              x={cx + topWidth / 2 + voidWidth / 2}
              y={y0 + step / 3 + 12}
              textAnchor="middle"
              fontSize="9"
              fill="white"
              opacity="0.8"
            >
              void {voidPct}%
            </text>
          </>
        )}

        {/* Labels */}
        <text x={cx - topWidth / 2} y={y0 - 6} fontSize="9" fill="currentColor" opacity="0.5">
          Tạo đơn
        </text>
        <text x={cx - midWidth / 2} y={y1 - 4} fontSize="9" fill="currentColor" opacity="0.5">
          Đã thanh toán
        </text>
        {voided > 0 && (
          <text x={cx + topWidth / 2 + 4} y={y0 - 6} fontSize="9" fill="#ef4444" opacity="0.8">
            Void
          </text>
        )}
      </svg>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  danger,
  loading,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{title}</span>
              <Icon className={`size-4 ${danger ? "text-red-500" : "text-muted-foreground"}`} />
            </div>
            <p className={`text-xl font-bold tabular-nums ${danger ? "text-red-500" : ""}`}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesFunnelPage() {
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
  const [tenantId, setTenantId] = useState("all");
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  const [merchants, setMerchants] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (!token) return;
    fetch("/api/merchants?pageSize=200", { headers: authHeaders(token).headers })
      .then((r) => r.json())
      .then((j) => setMerchants((j.data?.list ?? j.data ?? []).map((m: any) => ({ id: m.id, name: m.name }))))
      .catch(() => {});
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from,
        to,
        ...(tenantId !== "all" && { tenantId }),
      });
      const res = await fetch(`/api/analytics/funnel?${params}`, {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data ?? json);
    } catch {
      toast.error("Không thể tải dữ liệu funnel");
    } finally {
      setLoading(false);
    }
  }, [token, from, to, tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales Funnel</h1>
          <p className="text-sm text-muted-foreground">
            Phân tích conversion từ tạo đơn đến thanh toán
          </p>
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

      {/* Filters */}
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
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Merchant</span>
          <Select value={tenantId} onValueChange={(v) => { if (v != null) setTenantId(v); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tất cả merchant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả merchant</SelectItem>
              {merchants.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(from !== defaultFrom || to !== defaultTo || tenantId !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFrom(defaultFrom); setTo(defaultTo); setTenantId("all"); }}
          >
            <X className="mr-1 size-3" /> Reset
          </Button>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Funnel viz */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Funnel: Created → Paid → Voided</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="mx-auto h-64 w-64 rounded-full" />
            ) : data ? (
              <FunnelViz
                created={data.paidOrders + data.voidedOrders}
                paid={data.paidOrders}
                voided={data.voidedOrders}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu
              </p>
            )}
          </CardContent>
        </Card>

        {/* KPI cards 2×2 */}
        <div className="grid grid-cols-2 gap-4 content-start">
          <KpiCard
            title="Conversion rate"
            value={data ? `${data.conversionRate.toFixed(1)}%` : "—"}
            sub="tỷ lệ thanh toán thành công"
            icon={TrendingUp}
            loading={loading}
          />
          <KpiCard
            title="Void rate"
            value={data ? `${data.voidRate.toFixed(1)}%` : "—"}
            sub="tỷ lệ đơn bị hủy"
            icon={TrendingDown}
            danger={data ? data.voidRate > 10 : false}
            loading={loading}
          />
          <KpiCard
            title="Avg time to pay"
            value={data ? `${(data.avgTimeToPay ?? 0).toFixed(0)} phút` : "—"}
            sub="trung bình từ tạo → thanh toán"
            icon={Clock}
            loading={loading}
          />
          <KpiCard
            title="Tổng đơn"
            value={data ? (data.paidOrders + data.voidedOrders).toLocaleString("vi-VN") : "—"}
            sub={`${data?.paidOrders ?? 0} paid · ${data?.voidedOrders ?? 0} voided`}
            icon={AlertCircle}
            loading={loading}
          />
        </div>
      </div>

      {/* Breakdown by category */}
      {!loading && data && data.breakdownByCategory && data.breakdownByCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Phân tích theo danh mục</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Danh mục</TableHead>
                  <TableHead className="text-right">Trạng thái</TableHead>
                  <TableHead className="text-right">Số đơn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.breakdownByCategory.map((cat, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{cat.orderCategory}</TableCell>
                    <TableCell className="text-right text-sm">
                      <span className={cat.financialStatus === 'paid' ? 'text-green-600' : 'text-red-500'}>
                        {cat.financialStatus}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {cat.count.toLocaleString("vi-VN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!loading && data && (data.breakdownByCategory ?? []).length === 0 && (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Chưa có dữ liệu funnel trong khoảng thời gian này
          </p>
        </div>
      )}
    </div>
  );
}
