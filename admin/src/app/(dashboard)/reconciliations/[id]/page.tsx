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
  ExternalLink,
  CheckCircle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

interface LineItem {
  phase?: string;
  course?: string;
  order_type?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  [key: string]: unknown;
}

interface ManualOrderRow {
  participant_name?: string;
  course?: string;
  quantity: number;
  unit_price: number;
  total: number;
  [key: string]: unknown;
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
  status: "draft" | "reviewed" | "sent" | "signed" | "completed";
  xlsx_url: string | null;
  docx_url: string | null;
  signed_at: string | null;
  line_items: LineItem[];
  manual_orders: ManualOrderRow[];
  createdAt: string;
}

const STATUS_ORDER = ["draft", "reviewed", "sent", "signed", "completed"] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  reviewed: "Đã xem xét",
  sent: "Đã gửi",
  signed: "Đã ký",
  completed: "Hoàn tất",
};

const NEXT_STATUS: Record<string, string> = {
  draft: "reviewed",
  reviewed: "sent",
  sent: "signed",
  signed: "completed",
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  draft: "Chuyển sang Đã xem xét",
  reviewed: "Chuyển sang Đã gửi",
  sent: "Chuyển sang Đã ký",
  signed: "Hoàn tất",
};

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

function formatDate(iso: string | null | undefined) {
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

function StatusStep({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus as typeof STATUS_ORDER[number]);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STATUS_ORDER.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <div
                className={`flex size-6 items-center justify-center rounded-full text-xs ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle className="size-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs ${
                  active ? "font-semibold" : done ? "text-muted-foreground" : "text-muted-foreground/50"
                }`}
              >
                {STATUS_LABELS[s]}
              </span>
            </div>
            {i < STATUS_ORDER.length - 1 && (
              <ArrowRight className="size-3 text-muted-foreground/40 ml-1" />
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

  // Transition modal
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [signedAt, setSignedAt] = useState(new Date().toISOString().slice(0, 10));

  // Regenerate
  const [regenLoading, setRegenLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reconciliations/${id}`, {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data ?? json);
    } catch {
      toast.error("Không thể tải chi tiết đối soát");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  async function handleTransition() {
    if (!token || !data) return;
    const nextStatus = NEXT_STATUS[data.status];
    if (!nextStatus) return;
    setTransitionLoading(true);
    try {
      const body: Record<string, unknown> = { status: nextStatus };
      if (data.status === "sent") {
        body.signed_at = signedAt;
      }
      const res = await fetch(`/api/reconciliations/${id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders(token).headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(`Đã chuyển trạng thái sang: ${STATUS_LABELS[nextStatus]}`);
      setTransitionOpen(false);
      await fetchDetail();
    } catch {
      toast.error("Không thể chuyển trạng thái");
    } finally {
      setTransitionLoading(false);
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
      <div className="flex flex-col gap-4 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => router.push("/reconciliations")} className="self-start">
          <ChevronLeft className="mr-1 size-4" />
          Quay lại
        </Button>
        <p className="text-muted-foreground">Không tìm thấy bản đối soát</p>
      </div>
    );
  }

  const canTransition = data.status !== "completed";
  const nextStatus = NEXT_STATUS[data.status];

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Button variant="ghost" onClick={() => router.push("/reconciliations")} className="self-start -ml-2">
          <ChevronLeft className="mr-1 size-4" />
          Danh sách đối soát
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{data.race_title}</h1>
            <p className="text-sm text-muted-foreground">
              {data.tenant_name} · {formatPeriod(data.period_start, data.period_end)} · Ngày tạo: {formatDate(data.createdAt)}
            </p>
          </div>
          <Badge
            className={
              data.status === "completed"
                ? "bg-green-600/20 text-green-300"
                : data.status === "signed"
                ? "bg-green-500/20 text-green-400"
                : data.status === "sent"
                ? "bg-yellow-500/20 text-yellow-400"
                : data.status === "reviewed"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-zinc-500/20 text-zinc-400"
            }
          >
            {data.status === "completed" && <CheckCircle className="mr-1 size-3" />}
            {STATUS_LABELS[data.status]}
          </Badge>
        </div>
      </div>

      {/* Status stepper */}
      <Card>
        <CardContent className="pt-4">
          <StatusStep currentStatus={data.status} />
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Doanh thu thực</p>
            <p className="text-lg font-bold">{formatVnd(data.net_revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Phí dịch vụ</p>
            <p className="text-lg font-bold text-red-400">{formatVnd(data.fee_amount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">VAT trên phí</p>
            <p className="text-lg font-bold text-red-400">{formatVnd(data.fee_vat_amount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Thanh toán</p>
            <p className="text-lg font-bold text-green-400">{formatVnd(data.payout_amount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thao tác</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Downloads */}
          <div className="flex flex-wrap gap-2">
            {data.xlsx_url && (
              <a
                href={data.xlsx_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <ExternalLink className="size-4" />
                Tải XLSX
              </a>
            )}
            {data.docx_url && (
              <a
                href={data.docx_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <ExternalLink className="size-4" />
                Tải DOCX
              </a>
            )}
          </div>

          {/* Status transition */}
          {canTransition && nextStatus && (
            <div className="flex items-center gap-3">
              <Button onClick={() => setTransitionOpen(true)}>
                <ArrowRight className="mr-2 size-4" />
                {NEXT_STATUS_LABEL[data.status]}
              </Button>
            </div>
          )}

          {/* Regenerate */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={regenLoading}
              onClick={() => handleRegenerate("xlsx")}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Tạo lại XLSX
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={regenLoading}
              onClick={() => handleRegenerate("docx")}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Tạo lại DOCX
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={regenLoading}
              onClick={() => handleRegenerate("both")}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Tạo lại cả hai
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fee config snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cấu hình phí (snapshot)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Tỉ lệ phí</p>
            <p className="font-semibold">{data.fee_rate_applied != null ? `${data.fee_rate_applied}%` : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phí/vé thủ công</p>
            <p className="font-semibold">{formatVnd(data.manual_fee_per_ticket)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">VAT rate</p>
            <p className="font-semibold">{data.fee_vat_rate}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Điều chỉnh thủ công</p>
            <p className={`font-semibold ${data.manual_adjustment > 0 ? "text-green-400" : data.manual_adjustment < 0 ? "text-red-400" : ""}`}>
              {data.manual_adjustment !== 0 ? formatVnd(data.manual_adjustment) : "—"}
            </p>
          </div>
          {data.adjustment_note && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-muted-foreground">Ghi chú điều chỉnh</p>
              <p className="italic text-sm">{data.adjustment_note}</p>
            </div>
          )}
          {data.signed_at && (
            <div>
              <p className="text-muted-foreground">Ngày ký</p>
              <p className="font-semibold">{formatDate(data.signed_at)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line items */}
      {data.line_items && data.line_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bảng chi tiết đơn 5BIB</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">STT</TableHead>
                  <TableHead>Giai đoạn</TableHead>
                  <TableHead>Cự ly</TableHead>
                  <TableHead>Loại đơn</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead className="text-right">Giảm giá</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.line_items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{item.phase ?? "—"}</TableCell>
                    <TableCell>{item.course ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.order_type ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatVnd(item.unit_price)}</TableCell>
                    <TableCell className="text-right">{item.discount ? formatVnd(item.discount) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatVnd(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Manual orders */}
      {data.manual_orders && data.manual_orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Đơn thủ công</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">STT</TableHead>
                  <TableHead>Tên người tham gia</TableHead>
                  <TableHead>Cự ly</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.manual_orders.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{row.participant_name ?? "—"}</TableCell>
                    <TableCell>{row.course ?? "—"}</TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right">{formatVnd(row.unit_price)}</TableCell>
                    <TableCell className="text-right font-medium">{formatVnd(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transition Dialog */}
      <Dialog open={transitionOpen} onOpenChange={setTransitionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chuyển trạng thái đối soát</DialogTitle>
            <DialogDescription>
              Chuyển từ <strong>{STATUS_LABELS[data.status]}</strong> sang{" "}
              <strong>{nextStatus ? STATUS_LABELS[nextStatus] : ""}</strong>
            </DialogDescription>
          </DialogHeader>

          {data.status === "sent" && (
            <div className="flex flex-col gap-2">
              <Label>Ngày ký <span className="text-red-400">*</span></Label>
              <Input
                type="date"
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleTransition} disabled={transitionLoading}>
              {transitionLoading ? "Đang xử lý..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
