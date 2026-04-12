"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Reconciliation {
  _id: string;
  tenant_id: number;
  mysql_race_id: number;
  race_title: string;
  tenant_name: string;
  period_start: string;
  period_end: string;
  fee_rate_applied: number | null;
  net_revenue: number;
  fee_amount: number;
  fee_vat_amount: number;
  payout_amount: number;
  status: "draft" | "reviewed" | "sent" | "signed" | "completed";
  xlsx_url: string | null;
  docx_url: string | null;
  createdAt: string;
}

interface CronLog {
  period: string; // "2026-03"
  ran_at: string;
  created_count: number;
  skipped_count: number;
  error_count: number;
  error_details: Array<{ merchant_name: string; race_title: string; reason: string }>;
  triggered_by: string;
}

interface BatchPreflightItem {
  tenant_id: number;
  merchant_name: string;
  period: string;
  can_create: boolean;
  races_with_orders: Array<{ race_id: number; race_name: string; order_count: number; gross_revenue: number }>;
  races_skipped: Array<{ race_id: number; race_name: string; reason: string }>;
  warnings: Array<{ type: string; severity: "ERROR" | "WARNING" | "INFO"; message: string; count: number | null }>;
  summary: { total_orders: number; estimated_gross_revenue: number; estimated_fee: number | null };
}

interface BatchResult {
  created: number;
  skipped: number;
  failed: number;
  results: Array<{
    merchant_id: number;
    merchant_name: string;
    race_id: number;
    race_title: string;
    status: string;
    reason?: string;
    reconciliation_id?: string;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Nháp", className: "bg-zinc-500/20 text-zinc-400" },
  reviewed: { label: "Đã xem xét", className: "bg-blue-500/20 text-blue-400" },
  sent: { label: "Đã gửi", className: "bg-yellow-500/20 text-yellow-400" },
  signed: { label: "Đã ký", className: "bg-green-500/20 text-green-400" },
  completed: { label: "Hoàn tất", className: "bg-green-600/20 text-green-300" },
};

const MONTH_NAMES = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
  "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
  "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <Badge className={c.className}>
      {status === "completed" && <CheckCircle className="mr-1 size-3" />}
      {c.label}
    </Badge>
  );
}

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPeriod(start: string, end: string) {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

function isRecentPeriod(period: string): boolean {
  // period is "YYYY-MM"
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  return period === currentPeriod || period === prevPeriod;
}

export default function ReconciliationsPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  // M5: Cron error banner
  const [cronLogs, setCronLogs] = useState<CronLog[]>([]);
  const [cronBannerExpanded, setCronBannerExpanded] = useState(false);

  // M3: Batch modal state
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchStep, setBatchStep] = useState<0 | 1 | 2>(0);
  const [batchMonth, setBatchMonth] = useState(String(new Date().getMonth())); // 0-indexed
  const [batchYear, setBatchYear] = useState(String(new Date().getFullYear()));
  const [batchPreflight, setBatchPreflight] = useState<BatchPreflightItem[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set());
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [batchErrorOpen, setBatchErrorOpen] = useState(false);

  const cronLog = cronLogs[0] ?? null;

  // Computed period string "YYYY-MM"
  const batchPeriod = `${batchYear}-${String(Number(batchMonth) + 1).padStart(2, "0")}`;

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: "20",
        ...(status !== "all" && { status }),
      });
      const res = await fetch(`/api/reconciliations?${params}`, {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(Math.ceil((json.total ?? 0) / 20));
    } catch {
      toast.error("Không thể tải danh sách đối soát");
    } finally {
      setLoading(false);
    }
  }, [token, status, page]);

  const fetchCronLogs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/reconciliations/cron-logs", {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) return;
      const json = await res.json();
      setCronLogs(json.data ?? json ?? []);
    } catch {
      // silently ignore — banner is non-critical
    }
  }, [token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchCronLogs();
  }, [fetchCronLogs]);

  async function handleBatchPreflight() {
    setBatchLoading(true);
    try {
      const res = await fetch("/api/reconciliations/preflight/batch", {
        method: "POST",
        headers: { ...authHeaders(token!).headers, "Content-Type": "application/json" },
        body: JSON.stringify({ period: batchPeriod, merchant_ids: "all" }),
      });
      const json = await res.json();
      const preflight: BatchPreflightItem[] = json.data ?? json;
      setBatchPreflight(preflight);
      // Auto-select: checked if can_create AND no ERROR severity warning
      const autoSelected = new Set(
        preflight
          .filter(
            (p) =>
              p.can_create &&
              !p.warnings.some((w) => w.severity === "ERROR")
          )
          .map((p) => p.tenant_id)
      );
      setBatchSelected(autoSelected);
      setBatchStep(1);
    } catch {
      toast.error("Không thể tải dữ liệu preflight");
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleBatchCreate() {
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const res = await fetch("/api/reconciliations/batch", {
        method: "POST",
        headers: { ...authHeaders(token!).headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          period: batchPeriod,
          merchant_ids: Array.from(batchSelected),
          skip_errors: skipErrors,
        }),
      });
      const json = await res.json();
      setBatchResult(json.data ?? json);
      setBatchStep(2);
    } catch {
      toast.error("Không thể tạo hàng loạt");
    } finally {
      setBatchLoading(false);
    }
  }

  function handleBatchClose() {
    setBatchOpen(false);
    setBatchStep(0);
    setBatchPreflight([]);
    setBatchSelected(new Set());
    setBatchResult(null);
    setSkipErrors(false);
    setBatchErrorOpen(false);
  }

  function toggleBatchSelect(tenantId: number) {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) {
        next.delete(tenantId);
      } else {
        next.add(tenantId);
      }
      return next;
    });
  }

  // Derived preflight groupings
  const preflightCanCreate = batchPreflight.filter((p) => p.can_create);
  const preflightSkipped = batchPreflight.filter((p) => !p.can_create);

  const selectedRevenue = preflightCanCreate
    .filter((p) => batchSelected.has(p.tenant_id))
    .reduce((sum, p) => sum + (p.summary.estimated_gross_revenue ?? 0), 0);

  // Generate year options: current year and previous 2 years
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  // Cron banner visibility
  const showCronBanner =
    cronLog !== null &&
    cronLog.error_count > 0 &&
    isRecentPeriod(cronLog.period);

  const cronPeriodFormatted = cronLog
    ? (() => {
        const [y, m] = cronLog.period.split("-");
        return `T${m}/${y}`;
      })()
    : "";

  return (
    <div className="flex flex-col gap-6">
      {/* M5: Cron error banner */}
      {showCronBanner && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-400" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium text-yellow-200">
                  {cronLog!.error_count} merchant chưa được tạo đối soát {cronPeriodFormatted} (cần xử lý thủ công)
                </p>
                <button
                  onClick={() => setCronBannerExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors shrink-0"
                >
                  Xem chi tiết
                  {cronBannerExpanded ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )}
                </button>
              </div>
              {cronBannerExpanded && cronLog!.error_details.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                  {cronLog!.error_details.map((detail, i) => (
                    <div
                      key={i}
                      className="rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200"
                    >
                      <span className="font-medium">{detail.merchant_name}</span>
                      {detail.race_title && (
                        <span className="text-yellow-400"> · {detail.race_title}</span>
                      )}
                      <span className="text-yellow-500"> — {detail.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Đối soát doanh thu</h1>
          <p className="text-sm text-muted-foreground">{total} bản ghi đối soát</p>
        </div>
        <div className="flex items-center gap-2">
          {/* M3: Batch button */}
          <Button variant="outline" onClick={() => setBatchOpen(true)}>
            <Users className="mr-2 size-4" />
            Tạo hàng loạt
          </Button>
          <Link href="/reconciliations/new">
            <Button>
              <Plus className="mr-2 size-4" />
              Tạo đối soát mới
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Trạng thái</span>
          <Select value={status} onValueChange={(v) => { if (v) { setStatus(v); setPage(0); } }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="draft">Nháp</SelectItem>
              <SelectItem value="reviewed">Đã xem xét</SelectItem>
              <SelectItem value="sent">Đã gửi</SelectItem>
              <SelectItem value="signed">Đã ký</SelectItem>
              <SelectItem value="completed">Hoàn tất</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
                <TableHead>Giải đấu</TableHead>
                <TableHead className="hidden md:table-cell">Kỳ đối soát</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Doanh thu thực</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Phí</TableHead>
                <TableHead className="text-right">Thanh toán</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="hidden sm:table-cell">Ngày tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    Không tìm thấy bản ghi đối soát nào
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow
                    key={item._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/reconciliations/${item._id}`)}
                  >
                    <TableCell>
                      <span className="font-medium">{item.tenant_name}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{item.race_title}</p>
                        <p className="text-xs text-muted-foreground">ID: {item.mysql_race_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatPeriod(item.period_start, item.period_end)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm">
                      {formatVnd(item.net_revenue)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm">
                      {formatVnd(item.fee_amount + item.fee_vat_amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatVnd(item.payout_amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
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

      {/* M3: Batch creation modal */}
      <Dialog open={batchOpen} onOpenChange={(open) => { if (!open) handleBatchClose(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo đối soát hàng loạt</DialogTitle>
          </DialogHeader>

          {/* Step 0: Choose period */}
          {batchStep === 0 && (
            <div className="flex flex-col gap-6 py-2">
              <p className="text-sm text-muted-foreground">
                Chọn kỳ đối soát. Hệ thống sẽ kiểm tra tất cả merchant và hiển thị kết quả trước khi tạo.
              </p>
              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Tháng</span>
                  <Select value={batchMonth} onValueChange={(v) => { if (v != null) setBatchMonth(v); }}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Năm</span>
                  <Select value={batchYear} onValueChange={(v) => { if (v != null) setBatchYear(v); }}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Kỳ được chọn:{" "}
                <span className="font-medium text-foreground">
                  {MONTH_NAMES[Number(batchMonth)]} {batchYear}
                </span>
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={handleBatchClose}>
                  Hủy
                </Button>
                <Button onClick={handleBatchPreflight} disabled={batchLoading}>
                  {batchLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Tiếp theo →
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 1: Preflight results */}
          {batchStep === 1 && (
            <div className="flex flex-col gap-4 py-2">
              {batchLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Summary bar */}
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <span className="font-medium">{batchSelected.size} merchant được chọn</span>
                    {selectedRevenue > 0 && (
                      <span className="text-muted-foreground">
                        {" "}· Ước tính {formatVnd(selectedRevenue)} doanh thu
                      </span>
                    )}
                  </div>

                  <div className="max-h-[360px] overflow-y-auto pr-1">
                    <div className="flex flex-col gap-2">
                      {/* Merchants with orders */}
                      {preflightCanCreate.length > 0 && (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                            Có đơn hàng ({preflightCanCreate.length})
                          </p>
                          {preflightCanCreate.map((p) => {
                            const hasError = p.warnings.some((w) => w.severity === "ERROR");
                            const isChecked = batchSelected.has(p.tenant_id);
                            return (
                              <div
                                key={p.tenant_id}
                                className="flex items-start gap-3 rounded-lg border px-3 py-3 hover:bg-muted/30 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  id={`batch-merchant-${p.tenant_id}`}
                                  checked={isChecked}
                                  onChange={() => toggleBatchSelect(p.tenant_id)}
                                  className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary"
                                />
                                <div className="flex-1 min-w-0">
                                  <label
                                    htmlFor={`batch-merchant-${p.tenant_id}`}
                                    className="cursor-pointer font-medium text-sm"
                                  >
                                    {p.merchant_name}
                                  </label>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                    <span className="text-xs text-muted-foreground">
                                      {p.summary.total_orders} đơn
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ~{formatVnd(p.summary.estimated_gross_revenue)}
                                    </span>
                                    {p.races_with_orders.length > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        {p.races_with_orders.length} giải
                                      </span>
                                    )}
                                  </div>
                                  {hasError && (
                                    <div className="mt-1.5 flex flex-col gap-1">
                                      {p.warnings
                                        .filter((w) => w.severity === "ERROR")
                                        .map((w, i) => (
                                          <p key={i} className="text-xs text-red-400">
                                            ⚠ {w.message}
                                          </p>
                                        ))}
                                    </div>
                                  )}
                                  {!hasError &&
                                    p.warnings.filter((w) => w.severity === "WARNING").length > 0 && (
                                      <div className="mt-1.5 flex flex-col gap-1">
                                        {p.warnings
                                          .filter((w) => w.severity === "WARNING")
                                          .map((w, i) => (
                                            <p key={i} className="text-xs text-yellow-400">
                                              ⚡ {w.message}
                                            </p>
                                          ))}
                                      </div>
                                    )}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Merchants with no orders (skipped) */}
                      {preflightSkipped.length > 0 && (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">
                            Không có đơn hàng ({preflightSkipped.length} bỏ qua)
                          </p>
                          {preflightSkipped.map((p) => (
                            <div
                              key={p.tenant_id}
                              className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 opacity-50"
                            >
                              <input type="checkbox" disabled checked={false} onChange={() => {}} className="size-4 cursor-not-allowed rounded border-input" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-muted-foreground">{p.merchant_name}</p>
                                {p.races_skipped.length > 0 && (
                                  <p className="text-xs text-muted-foreground/60">
                                    {p.races_skipped[0]?.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Skip errors checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="skip-errors"
                      checked={skipErrors}
                      onChange={(e) => setSkipErrors(e.target.checked)}
                      className="size-4 cursor-pointer rounded border-input accent-primary"
                    />
                    <label htmlFor="skip-errors" className="text-sm cursor-pointer">
                      Bỏ qua merchant có lỗi (chỉ tạo merchant sạch)
                    </label>
                  </div>
                </>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={handleBatchClose}>
                  Hủy
                </Button>
                <Button
                  onClick={handleBatchCreate}
                  disabled={batchLoading || batchSelected.size === 0}
                >
                  {batchLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Tạo {batchSelected.size > 0 ? batchSelected.size : ""} đối soát ▶▶
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2: Results */}
          {batchStep === 2 && (
            <div className="flex flex-col gap-4 py-2">
              {batchLoading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Đang tạo đối soát...</p>
                </div>
              ) : batchResult ? (
                <>
                  {/* Result summary */}
                  <div className="flex gap-4 rounded-lg border bg-muted/30 px-4 py-4">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-2xl font-bold text-green-400">
                        {batchResult.created}
                      </span>
                      <span className="text-xs text-muted-foreground">thành công</span>
                    </div>
                    <div className="w-px bg-border" />
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-2xl font-bold text-yellow-400">
                        {batchResult.skipped}
                      </span>
                      <span className="text-xs text-muted-foreground">bỏ qua</span>
                    </div>
                    <div className="w-px bg-border" />
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-2xl font-bold text-red-400">
                        {batchResult.failed}
                      </span>
                      <span className="text-xs text-muted-foreground">thất bại</span>
                    </div>
                  </div>

                  {/* Failed list */}
                  {batchResult.failed > 0 && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setBatchErrorOpen((v) => !v)}
                        className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        {batchErrorOpen ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                        Xem danh sách thất bại ({batchResult.failed})
                      </button>
                      {batchErrorOpen && (
                        <div className="max-h-[200px] overflow-y-auto">
                          <div className="flex flex-col gap-1.5">
                            {batchResult.results
                              .filter((r) => r.status === "failed" || r.status === "error")
                              .map((r, i) => (
                                <div
                                  key={i}
                                  className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs"
                                >
                                  <span className="font-medium text-red-300">
                                    {r.merchant_name}
                                  </span>
                                  {r.race_title && (
                                    <span className="text-red-400/70"> · {r.race_title}</span>
                                  )}
                                  {r.reason && (
                                    <span className="text-red-500"> — {r.reason}</span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}

              <DialogFooter>
                <Button
                  onClick={() => {
                    handleBatchClose();
                    fetchItems();
                  }}
                >
                  Đóng
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
