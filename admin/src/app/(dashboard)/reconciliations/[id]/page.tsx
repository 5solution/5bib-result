"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronLeft,
  Download,
  CheckCircle,
  RefreshCw,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Calendar,
  Building2,
  Clock,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

async function downloadWithAuth(url: string, filename: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function fmtDate(s: string): string {
  if (!s) return "";
  const parts = s.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s;
}

function buildRecFilename(data: ReconciliationDetail, ext: string): string {
  const parts = [
    data.tenant_name || String(data.tenant_id),
    data.race_title,
    `${fmtDate(data.period_start)} đến ${fmtDate(data.period_end)}`,
  ].filter(Boolean);
  return `${parts.join(" - ")}.${ext}`;
}

interface LineItem {
  order_category: string;
  ticket_type_name: string;
  distance_name: string;
  unit_price: number;
  quantity: number;
  discount_amount: number;
  subtotal: number;
  add_on_price: number;
}

interface ManualOrderRow {
  order_id: number;
  ticket_type_name: string;
  participant_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  note: string | null;
}

interface ReconciliationDetail {
  _id: string;
  tenant_id: number;
  tenant_name: string;
  mysql_race_id: number;
  race_title: string;
  period_start: string;
  period_end: string;
  fee_rate_applied: number | null;
  manual_fee_per_ticket: number;
  fee_vat_rate: number;
  net_revenue: number;
  fee_amount: number;
  fee_vat_amount: number;
  manual_fee_amount: number;
  manual_ticket_count: number;
  manual_adjustment: number;
  adjustment_note: string | null;
  payout_amount: number;
  status: "draft" | "flagged" | "ready" | "approved" | "sent" | "reviewed" | "signed" | "completed";
  flags?: Array<{
    type: string;
    severity: "ERROR" | "WARNING" | "INFO";
    message: string;
    count: number | null;
  }>;
  approved_by?: number | null;
  approved_at?: string | null;
  created_source?: string;
  xlsx_url: string | null;
  docx_url: string | null;
  signed_at: string | null;
  line_items: LineItem[];
  manual_orders: ManualOrderRow[];
  createdAt: string;
}

const STATUS_ORDER = ["draft", "ready", "approved", "sent", "completed"] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  flagged: "Có vấn đề",
  ready: "Sẵn sàng duyệt",
  approved: "Đã duyệt",
  sent: "Đã gửi",
  reviewed: "Đã xem xét",
  signed: "Đã ký",
  completed: "Hoàn tất",
};

const NEXT_STATUS: Record<string, string> = {
  draft: "reviewed",
  flagged: "approved",
  ready: "approved",
  approved: "sent",
  reviewed: "sent",
  sent: "signed",
  signed: "completed",
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  draft: "Chuyển sang Đã xem xét",
  flagged: "Duyệt (bỏ qua lỗi)",
  ready: "Approve",
  approved: "Đánh dấu Đã gửi",
  reviewed: "Đánh dấu Đã gửi",
  sent: "Đánh dấu Đã ký",
  signed: "Hoàn tất",
};

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatPeriod(start: string, end: string) {
  if (!start || !end) return "—";
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600 border-gray-300",
  flagged:   "bg-red-100 text-red-700 border-red-300",
  ready:     "bg-blue-100 text-blue-700 border-blue-300",
  approved:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  sent:      "bg-amber-100 text-amber-700 border-amber-300",
  reviewed:  "bg-blue-100 text-blue-700 border-blue-300",
  signed:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  completed: "bg-emerald-600/15 text-emerald-300 border-emerald-600/20",
};

function StatusStepper({ currentStatus }: { currentStatus: string }) {
  const displayStatus = currentStatus === "flagged" ? "draft" : currentStatus;
  const currentIdx = STATUS_ORDER.indexOf(displayStatus as typeof STATUS_ORDER[number]);
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {STATUS_ORDER.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground/50"
              }`}>
                {done ? <CheckCircle className="size-4" /> : i + 1}
              </div>
              <span className={`text-[11px] font-medium ${
                active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/40"
              }`}>
                {STATUS_LABELS[s]}
              </span>
            </div>
            {i < STATUS_ORDER.length - 1 && (
              <div className={`h-px w-12 mx-2 mb-4 ${i < currentIdx ? "bg-emerald-500/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ReconciliationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<ReconciliationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [signedAt, setSignedAt] = useState(new Date().toISOString().slice(0, 10));
  const [regenLoading, setRegenLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reconciliations/${id}`, { headers: authHeaders(token).headers });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data ?? json);
    } catch {
      toast.error("Không thể tải chi tiết đối soát");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function handleTransition() {
    if (!token || !data) return;
    const nextStatus = NEXT_STATUS[data.status];
    if (!nextStatus) return;
    setTransitionLoading(true);
    try {
      const body: Record<string, unknown> = { status: nextStatus };
      if (data.status === "sent") body.signed_at = signedAt;
      const res = await fetch(`/api/reconciliations/${id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(`Đã chuyển sang: ${STATUS_LABELS[nextStatus]}`);
      setTransitionOpen(false);
      await fetchDetail();
    } catch {
      toast.error("Không thể chuyển trạng thái");
    } finally {
      setTransitionLoading(false);
    }
  }

  async function handleQuickApprove() {
    if (!token || !data) return;
    setApproveLoading(true);
    try {
      const res = await fetch(`/api/reconciliations/${id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Đã approve đối soát");
      await fetchDetail();
    } catch {
      toast.error("Không thể approve");
    } finally {
      setApproveLoading(false);
    }
  }

  async function handleRegenerate(type: "xlsx" | "docx" | "both") {
    if (!token || !data) return;
    setRegenLoading(true);
    try {
      const res = await fetch(`/api/reconciliations/${id}/regenerate`, {
        method: "POST",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error();
      toast.success("Đã tạo lại tài liệu");
      await fetchDetail();
    } catch {
      toast.error("Không thể tạo lại tài liệu");
    } finally {
      setRegenLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 max-w-5xl">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-48 col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => router.push("/reconciliations")} className="self-start">
          <ChevronLeft className="mr-1 size-4" /> Quay lại
        </Button>
        <p className="text-muted-foreground">Không tìm thấy bản đối soát</p>
      </div>
    );
  }

  const canTransition = data.status !== "completed";
  const nextStatus = NEXT_STATUS[data.status];
  const badgeClass = STATUS_BADGE[data.status] ?? STATUS_BADGE.draft;
  const isFlagged = data.status === "flagged";
  const isReady = data.status === "ready";
  const isApproved = data.status === "approved";

  const totalFees = data.fee_amount + data.manual_fee_amount + data.fee_vat_amount;

  return (
    <div className="flex flex-col gap-5 max-w-5xl">

      {/* ── Back nav ── */}
      <Button variant="ghost" onClick={() => router.push("/reconciliations")} className="self-start -ml-2 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 size-4" />
        Danh sách đối soát
      </Button>

      {/* ── Header card ── */}
      <Card className="overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold leading-tight truncate">{data.race_title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3.5 shrink-0" />
                  {data.tenant_name}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 shrink-0" />
                  {formatPeriod(data.period_start, data.period_end)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0" />
                  Tạo {formatDate(data.createdAt)}
                  {data.created_source === "cron" && <span className="text-xs text-muted-foreground/60">(auto)</span>}
                </span>
              </div>
            </div>
            <Badge className={`${badgeClass} border text-sm px-3 py-1 shrink-0`}>
              {data.status === "completed" && <CheckCircle className="mr-1.5 size-3.5" />}
              {STATUS_LABELS[data.status]}
            </Badge>
          </div>
        </div>

        {/* ── Banner inside header ── */}
        {isReady && (
          <div className="border-t border-emerald-500/20 bg-emerald-500/5 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="size-4 text-emerald-400 shrink-0" />
              <span className="text-sm font-medium text-emerald-400">Đối soát sạch — không có cảnh báo lỗi</span>
            </div>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" onClick={handleQuickApprove} disabled={approveLoading}>
              {approveLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
              <span className="ml-1.5">Approve</span>
            </Button>
          </div>
        )}

        {isFlagged && (
          <div className="border-t border-red-200 bg-red-50 px-6 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive shrink-0" />
              <span className="text-sm font-semibold text-destructive">Có vấn đề cần kiểm tra</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {data.flags?.map((flag, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs rounded px-3 py-2 border ${
                  flag.severity === "ERROR"
                    ? "bg-red-50 text-red-700 border-red-300"
                    : flag.severity === "WARNING"
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-blue-50 text-blue-700 border-blue-300"
                }`}>
                  <span className="shrink-0 mt-px">
                    {flag.severity === "ERROR" ? "🔴" : flag.severity === "WARNING" ? "🟡" : "🔵"}
                  </span>
                  {flag.message}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleQuickApprove} disabled={approveLoading} className="self-start text-muted-foreground text-xs">
              {approveLoading ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
              Approve anyway (không khuyến nghị)
            </Button>
          </div>
        )}

        {isApproved && (
          <div className="border-t border-blue-200 bg-blue-50 px-6 py-3 flex items-center gap-2.5">
            <CheckCircle className="size-4 text-blue-400 shrink-0" />
            <span className="text-sm text-blue-400">
              Đã duyệt {formatDate(data.approved_at)} · Merchant nhận{" "}
              <strong className="text-blue-300">{formatVnd(data.payout_amount)}</strong>
            </span>
          </div>
        )}
      </Card>

      {/* ── Status stepper ── */}
      <Card>
        <CardContent className="py-4 px-6">
          <StatusStepper currentStatus={data.status} />
        </CardContent>
      </Card>

      {/* ── Main content: Financials + Actions ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

        {/* Financial ledger */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tổng kết tài chính</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-0 text-sm">
              {/* Revenue */}
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Doanh thu thực</span>
                <span className="font-semibold tabular-nums">{formatVnd(data.net_revenue)}</span>
              </div>
              <Separator />

              {/* Fees */}
              <div className="flex items-center justify-between py-2 text-red-700">
                <span className="text-muted-foreground pl-3">Phí dịch vụ {data.fee_rate_applied != null ? `(${data.fee_rate_applied}%)` : ""}</span>
                <span className="tabular-nums">− {formatVnd(data.fee_amount)}</span>
              </div>
              {data.manual_fee_amount > 0 && (
                <div className="flex items-center justify-between py-2 text-red-700">
                  <span className="text-muted-foreground pl-3">
                    Phí thủ công
                    {data.manual_ticket_count > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground/60">
                        ({data.manual_ticket_count} vé × {formatVnd(data.manual_fee_per_ticket)})
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">− {formatVnd(data.manual_fee_amount)}</span>
                </div>
              )}
              {data.fee_vat_amount > 0 && (
                <div className="flex items-center justify-between py-2 text-red-700">
                  <span className="text-muted-foreground pl-3">VAT trên phí ({data.fee_vat_rate}%)</span>
                  <span className="tabular-nums">− {formatVnd(data.fee_vat_amount)}</span>
                </div>
              )}
              {data.manual_adjustment !== 0 && (
                <div className={`flex items-center justify-between py-2 ${data.manual_adjustment > 0 ? "text-emerald-700" : "text-red-700"}`}>
                  <span className="text-muted-foreground pl-3">Điều chỉnh thủ công</span>
                  <span className="tabular-nums">{data.manual_adjustment > 0 ? "+" : "−"} {formatVnd(Math.abs(data.manual_adjustment))}</span>
                </div>
              )}

              <Separator />

              {/* Subtotal fees */}
              <div className="flex items-center justify-between py-2 text-xs text-muted-foreground/60">
                <span className="pl-3">Tổng phí khấu trừ</span>
                <span className="tabular-nums">− {formatVnd(totalFees)}</span>
              </div>

              <Separator />

              {/* Payout */}
              <div className="flex items-center justify-between py-3">
                <span className="font-semibold">Merchant nhận</span>
                <span className="text-lg font-bold text-emerald-400 tabular-nums">{formatVnd(data.payout_amount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Thao tác</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-4">

            {/* Downloads */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium">Tải xuống</p>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadWithAuth(
                    data.xlsx_url || `/api/reconciliations/${data._id}/download/xlsx`,
                    buildRecFilename(data, "xlsx"), token!
                  ).catch(() => toast.error("Tải XLSX thất bại"))}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  <FileSpreadsheet className="size-4" />
                  XLSX
                </button>
                <button
                  onClick={() => downloadWithAuth(
                    data.docx_url || `/api/reconciliations/${data._id}/download/docx`,
                    buildRecFilename(data, "docx"), token!
                  ).catch(() => toast.error("Tải DOCX thất bại"))}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <FileText className="size-4" />
                  DOCX
                </button>
              </div>
            </div>

            {/* Transition */}
            {canTransition && nextStatus && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground font-medium">Chuyển trạng thái</p>
                  <Button className="w-full" onClick={() => setTransitionOpen(true)}>
                    <ArrowRight className="mr-2 size-4" />
                    {NEXT_STATUS_LABEL[data.status]}
                  </Button>
                </div>
              </>
            )}

            {/* Regenerate */}
            <Separator />
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium">Tạo lại tài liệu</p>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" disabled={regenLoading} onClick={() => handleRegenerate("xlsx")} className="text-xs">
                  <RefreshCw className="mr-1 size-3" />
                  XLSX
                </Button>
                <Button variant="outline" size="sm" disabled={regenLoading} onClick={() => handleRegenerate("docx")} className="text-xs">
                  <RefreshCw className="mr-1 size-3" />
                  DOCX
                </Button>
                <Button variant="outline" size="sm" disabled={regenLoading} onClick={() => handleRegenerate("both")} className="text-xs">
                  <RefreshCw className="mr-1 size-3" />
                  Cả hai
                </Button>
              </div>
            </div>

            {/* Fee config (compact) */}
            <Separator />
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium">Cấu hình phí</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <span className="text-muted-foreground">Tỉ lệ</span>
                <span className="font-medium text-right">{data.fee_rate_applied != null ? `${data.fee_rate_applied}%` : "—"}</span>
                <span className="text-muted-foreground">Phí/vé thủ công</span>
                <span className="font-medium text-right">{formatVnd(data.manual_fee_per_ticket)}</span>
                <span className="text-muted-foreground">VAT rate</span>
                <span className="font-medium text-right">{data.fee_vat_rate}%</span>
                {data.signed_at && (
                  <>
                    <span className="text-muted-foreground">Ngày ký</span>
                    <span className="font-medium text-right">{formatDate(data.signed_at)}</span>
                  </>
                )}
              </div>
              {data.adjustment_note && (
                <p className="text-xs text-muted-foreground/70 italic mt-0.5">{data.adjustment_note}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Line items ── */}
      {data.line_items && data.line_items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Bảng chi tiết đơn 5BIB
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-6">#</TableHead>
                  <TableHead>Loại đơn</TableHead>
                  <TableHead>Loại vé</TableHead>
                  <TableHead>Cự ly</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead className="text-right">Giảm giá</TableHead>
                  <TableHead className="text-right pr-6">Thành tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.line_items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground pl-6">{i + 1}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {item.order_category || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{item.ticket_type_name || "—"}</TableCell>
                    <TableCell className="text-sm">{item.distance_name || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatVnd(item.unit_price)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {item.discount_amount ? formatVnd(item.discount_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold pr-6">{formatVnd(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
                {/* Total row */}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={7} className="pl-6 text-sm">Tổng doanh thu</TableCell>
                  <TableCell className="text-right tabular-nums pr-6">{formatVnd(data.net_revenue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Manual orders ── */}
      {data.manual_orders && data.manual_orders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Đơn thủ công
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-6">#</TableHead>
                  <TableHead>Tên người tham gia</TableHead>
                  <TableHead>Loại vé</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead className="text-right pr-6">Thành tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.manual_orders.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground pl-6">{i + 1}</TableCell>
                    <TableCell className="font-medium">{row.participant_name || "—"}</TableCell>
                    <TableCell className="text-sm">{row.ticket_type_name || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatVnd(row.unit_price)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold pr-6">{formatVnd(row.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Transition dialog ── */}
      <Dialog open={transitionOpen} onOpenChange={setTransitionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chuyển trạng thái</DialogTitle>
            <DialogDescription>
              <strong>{STATUS_LABELS[data.status]}</strong>
              {" → "}
              <strong>{nextStatus ? STATUS_LABELS[nextStatus] : ""}</strong>
            </DialogDescription>
          </DialogHeader>

          {data.status === "sent" && (
            <div className="flex flex-col gap-2">
              <Label>Ngày ký <span className="text-destructive">*</span></Label>
              <Input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionOpen(false)}>Hủy</Button>
            <Button onClick={handleTransition} disabled={transitionLoading}>
              {transitionLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
