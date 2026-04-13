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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
}

function currentMonthStr() {
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

interface MerchantRow {
  tenant_id: number;
  merchant_name: string;
  fee_rate: number;
  races: number;
  orders: number;
  gmv: number;
  platform_fee: number;
  manual_pct: number;
  voided_pct: number;
}

// ─── SVG Scatter Plot ─────────────────────────────────────────────────────────

function ScatterPlot({ data }: { data: MerchantRow[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) return null;

  const width = 500;
  const height = 240;
  const padL = 56;
  const padR = 20;
  const padT = 12;
  const padB = 36;
  const cw = width - padL - padR;
  const ch = height - padT - padB;

  const maxGmv = Math.max(...data.map((d) => d.gmv)) || 1;
  const maxOrders = Math.max(...data.map((d) => d.orders)) || 1;

  const toX = (gmv: number) => padL + (gmv / maxGmv) * cw;
  const toY = (orders: number) => padT + ch - (orders / maxOrders) * ch;

  function fmtX(v: number) {
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(0) + "B";
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(0) + "M";
    return (v / 1_000).toFixed(0) + "K";
  }

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: height }}
      >
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={padT + ch * (1 - f)}
              x2={width - padR}
              y2={padT + ch * (1 - f)}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
            <text
              x={padL - 5}
              y={padT + ch * (1 - f) + 4}
              textAnchor="end"
              fontSize="9"
              fill="currentColor"
              opacity="0.4"
            >
              {Math.round(maxOrders * f)}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <text
            key={i}
            x={padL + cw * f}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill="currentColor"
            opacity="0.4"
          >
            {fmtX(maxGmv * f)}
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={width / 2}
          y={height - 1}
          textAnchor="middle"
          fontSize="9"
          fill="currentColor"
          opacity="0.5"
        >
          GMV
        </text>

        {/* Dots */}
        {data.map((d, i) => {
          const cx = toX(d.gmv);
          const cy = toY(d.orders);
          const isHovered = hoveredIdx === i;
          return (
            <g key={d.tenant_id}>
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 7 : 5}
                fill="#3b82f6"
                fillOpacity={isHovered ? 1 : 0.7}
                stroke={isHovered ? "white" : "transparent"}
                strokeWidth="1.5"
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              {isHovered && (
                <foreignObject
                  x={cx + 8}
                  y={cy - 30}
                  width="140"
                  height="50"
                >
                  <div
                    className="rounded border bg-popover px-2 py-1 text-xs shadow-md"
                  >
                    <p className="font-medium text-foreground">{d.merchant_name}</p>
                    <p className="text-muted-foreground">
                      {d.orders} đơn · {formatVnd(d.gmv)}
                    </p>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MerchantComparisonPage() {
  const { token } = useAuth();
  const [month, setMonth] = useState(currentMonthStr());
  const [rows, setRows] = useState<MerchantRow[]>([]);
  const [loading, setLoading] = useState(true);

  const monthOpts = monthOptions();

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/merchants?month=${month}`, {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRows(json.data ?? json ?? []);
    } catch {
      toast.error("Không thể tải dữ liệu merchant");
    } finally {
      setLoading(false);
    }
  }, [token, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalGmv = rows.reduce((s, r) => s + r.gmv, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">So sánh Merchant</h1>
          <p className="text-sm text-muted-foreground">{rows.length} merchants</p>
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
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOpts.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead className="hidden md:table-cell text-right">Fee rate</TableHead>
                <TableHead className="text-right">Races</TableHead>
                <TableHead className="text-right">Đơn hàng</TableHead>
                <TableHead className="text-right">GMV</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Platform fee</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Manual %</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Voided %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Chưa có dữ liệu merchant trong tháng này
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.tenant_id}>
                    <TableCell>
                      <p className="font-medium text-sm">{row.merchant_name}</p>
                      <p className="text-xs text-muted-foreground">ID: {row.tenant_id}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-sm tabular-nums text-muted-foreground">
                      {row.fee_rate != null ? `${(row.fee_rate * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {row.races}
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
                    <TableCell className="hidden xl:table-cell text-right text-sm tabular-nums">
                      <span className={row.manual_pct > 20 ? "text-yellow-500" : "text-muted-foreground"}>
                        {row.manual_pct.toFixed(1)}%
                      </span>
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

          {/* Scatter plot */}
          {rows.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Scatter: GMV vs Đơn hàng
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Mỗi điểm là một merchant. Hover để xem chi tiết.
                </p>
              </CardHeader>
              <CardContent>
                <ScatterPlot data={rows} />
              </CardContent>
            </Card>
          )}

          {rows.length > 0 && (
            <div className="rounded-lg border bg-muted/20 px-4 py-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Tổng GMV tháng này:</span>{" "}
                <span className="font-bold">{formatVnd(totalGmv)}</span>
                {" "}·{" "}
                <span className="text-muted-foreground">
                  {rows.reduce((s, r) => s + r.orders, 0).toLocaleString("vi-VN")} đơn hàng
                </span>
                {" "}·{" "}
                <span className="text-muted-foreground">
                  {formatVnd(rows.reduce((s, r) => s + r.platform_fee, 0))} platform fee
                </span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
