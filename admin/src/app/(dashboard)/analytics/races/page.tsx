"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AreaChart } from "@/components/charts/AreaChart";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
}

function formatPct(n: number, decimals = 1) {
  return (n >= 0 ? "+" : "") + n.toFixed(decimals) + "%";
}

function dateLabel(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const RACE_TYPES = [
  { value: "all", label: "Tất cả loại" },
  { value: "road", label: "Road" },
  { value: "trail", label: "Trail" },
  { value: "virtual", label: "Virtual" },
  { value: "cycling", label: "Cycling" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface RaceRow {
  race_id: number;
  race_title: string;
  tenant_name: string;
  race_type: string;
  race_date: string;
  orders: number;
  gmv: number;
  platform_fee: number;
  avg_order: number;
  voided_pct: number;
}

interface RaceDetail {
  daily_orders: { date: string; orders: number }[];
  category_breakdown: { category: string; orders: number; gmv: number }[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RacePerformancePage() {
  const { token } = useAuth();

  const [rows, setRows] = useState<RaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  // Filters
  const [from, setFrom] = useState(`${currentMonthStr()}-01`);
  const [to, setTo] = useState(() => {
    const m = currentMonthStr();
    const [y, mo] = m.split("-");
    const days = new Date(Number(y), Number(mo), 0).getDate();
    return `${m}-${String(days).padStart(2, "0")}`;
  });
  const [raceType, setRaceType] = useState("all");
  const [tenantId, setTenantId] = useState("");

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRace, setSelectedRace] = useState<RaceRow | null>(null);
  const [detail, setDetail] = useState<RaceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from,
        to,
        page: String(page + 1),
        limit: String(LIMIT),
        ...(raceType !== "all" && { raceType }),
        ...(tenantId && { tenantId }),
      });
      const res = await fetch(`/api/analytics/races?${params}`, {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRows(json.data ?? json ?? []);
      setTotal(json.total ?? (json.data ?? json ?? []).length);
    } catch {
      toast.error("Không thể tải dữ liệu hiệu suất race");
    } finally {
      setLoading(false);
    }
  }, [token, from, to, raceType, tenantId, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  async function openDetail(race: RaceRow) {
    setSelectedRace(race);
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/races/${race.race_id}?from=${from}&to=${to}`,
        { headers: authHeaders(token!).headers }
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setDetail(json.data ?? json);
    } catch {
      toast.error("Không thể tải chi tiết race");
    } finally {
      setDetailLoading(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hiệu suất Race</h1>
          <p className="text-sm text-muted-foreground">{total} races</p>
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
            onChange={(e) => { setFrom(e.target.value); setPage(0); }}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Đến ngày</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(0); }}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Loại race</span>
          <Select value={raceType} onValueChange={(v) => { if (v != null) { setRaceType(v); setPage(0); } }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RACE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Tenant ID</span>
          <Input
            placeholder="Lọc merchant..."
            value={tenantId}
            onChange={(e) => { setTenantId(e.target.value); setPage(0); }}
            className="w-[160px]"
          />
        </div>
        {(raceType !== "all" || tenantId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setRaceType("all"); setTenantId(""); setPage(0); }}
          >
            <X className="mr-1 size-3" /> Xóa lọc
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Race</TableHead>
                <TableHead className="hidden sm:table-cell">Merchant</TableHead>
                <TableHead className="hidden md:table-cell">Loại</TableHead>
                <TableHead className="hidden lg:table-cell">Ngày race</TableHead>
                <TableHead className="text-right">Đơn hàng</TableHead>
                <TableHead className="text-right">GMV</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Platform fee</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Avg/đơn</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Voided %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    Không có dữ liệu race trong khoảng thời gian này
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.race_id}
                    className="cursor-pointer"
                    onClick={() => openDetail(row)}
                  >
                    <TableCell>
                      <p className="font-medium text-sm">{row.race_title}</p>
                      <p className="text-xs text-muted-foreground">ID: {row.race_id}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {row.tenant_name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-xs capitalize">
                        {row.race_type || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {dateLabel(row.race_date)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {row.orders.toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">
                      {formatVnd(row.gmv)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm tabular-nums text-muted-foreground">
                      {formatVnd(row.platform_fee)}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-sm tabular-nums text-muted-foreground">
                      {formatVnd(row.avg_order)}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-sm tabular-nums">
                      <span className={row.voided_pct > 5 ? "text-red-500" : "text-muted-foreground"}>
                        {row.voided_pct.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {page + 1}/{totalPages} · {total} bản ghi
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedRace?.race_title ?? "Chi tiết race"}
            </DialogTitle>
            {selectedRace && (
              <p className="text-xs text-muted-foreground">
                {selectedRace.tenant_name} · {selectedRace.orders.toLocaleString("vi-VN")} đơn ·{" "}
                {formatVnd(selectedRace.gmv)} GMV
              </p>
            )}
          </DialogHeader>

          {detailLoading ? (
            <div className="flex flex-col gap-3 py-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : detail ? (
            <div className="flex flex-col gap-5 py-2">
              {/* Daily orders chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Đơn hàng theo ngày</CardTitle>
                </CardHeader>
                <CardContent>
                  <AreaChart
                    data={detail.daily_orders.map((d) => ({
                      date: d.date.slice(5),
                      value: d.orders,
                    }))}
                    height={160}
                    color="#8b5cf6"
                  />
                </CardContent>
              </Card>

              {/* Category breakdown */}
              {detail.category_breakdown.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Phân loại danh mục
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Danh mục</TableHead>
                        <TableHead className="text-right">Đơn hàng</TableHead>
                        <TableHead className="text-right">GMV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.category_breakdown.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{c.category}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {c.orders.toLocaleString("vi-VN")}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums font-medium">
                            {formatVnd(c.gmv)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Không có dữ liệu chi tiết
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
