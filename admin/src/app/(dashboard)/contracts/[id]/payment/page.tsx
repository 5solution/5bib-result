"use client";

/**
 * F-024 Payment Request page (PRD Screen 5).
 *
 * Reference contract + acceptance report. Hiển thị auto-fill số tiền + cho phép
 * admin ghi notes + chọn payment deadline.
 *
 * Actions: Lưu nháp / Đánh dấu đã thanh toán / Xuất DOCX-PDF.
 */
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatVND,
  getContract,
  markPaymentPaid,
  upsertPaymentRequest,
  type ContractView,
} from "@/lib/contracts-api";
import { DocumentDownloadBtn } from "../../_components/document-download-btn";
import { PaymentStatusBadge } from "../../_components/payment-status-badge";
import { DetailSkeleton } from "../../_components/detail-skeleton";
import { ChevronLeft, Copy, CheckCircle2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";

export default function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { id } = use(params);
  const [contract, setContract] = useState<ContractView | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentDeadline, setPaymentDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    getContract(id)
      .then((c) => {
        setContract(c);
        if (c.paymentRequest) {
          setRequestDate(
            c.paymentRequest.requestDate?.slice(0, 10) ??
              new Date().toISOString().slice(0, 10),
          );
          setPaymentDeadline(c.paymentRequest.paymentDeadline?.slice(0, 10) ?? "");
          setNotes(c.paymentRequest.notes ?? "");
        } else {
          // Default deadline = today + paymentDeadlineDays
          const d = new Date();
          d.setDate(d.getDate() + (c.paymentTerms.paymentDeadlineDays || 15));
          setPaymentDeadline(d.toISOString().slice(0, 10));
        }
      })
      .catch((err) => toast.error(`Lỗi: ${err.message}`))
      .finally(() => setLoading(false));
  }, [id]);

  const auto = useMemo(() => {
    if (!contract) return null;
    const ar = contract.acceptanceReport;
    const total = ar?.actualTotalWithVat ?? contract.totalAmount;
    const advancePaid =
      ar?.advancePaid ?? contract.paymentTerms.advanceAmount ?? 0;
    return {
      totalAmount: total,
      advancePaid,
      amountDue: total - advancePaid,
    };
  }, [contract]);

  async function save() {
    if (!contract) return;
    setSaving(true);
    try {
      const next = await upsertPaymentRequest(contract._id, {
        requestDate,
        paymentDeadline,
        notes,
      });
      setContract(next);
      toast.success("Đã lưu");
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    if (!contract) return;
    const ok = await confirm({
      title: "Xác nhận thanh toán?",
      description:
        "Đánh dấu đã thanh toán? Hợp đồng sẽ chuyển sang trạng thái COMPLETED và không thể chỉnh sửa.",
      confirmText: "Đã thanh toán",
    });
    if (!ok) return;
    setPaying(true);
    try {
      await save();
      const next = await markPaymentPaid(contract._id);
      setContract(next);
      toast.success("Đã đánh dấu thanh toán");
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <DetailSkeleton sections={2} />;
  if (!contract || !auto)
    return <div className="p-6">Không tìm thấy hợp đồng</div>;

  const isPaid = contract.paymentRequest?.status === "PAID";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/contracts/${contract._id}`)}
        >
          <ChevronLeft className="size-4" /> Quay lại HĐ
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Đề nghị thanh toán
          </h1>
          <p className="font-mono text-xs text-[var(--text-muted,#78716C)]">
            HĐ: {contract.contractNumber}
          </p>
        </div>
        <div className="ml-auto">
          <DocumentDownloadBtn
            contractId={contract._id}
            docType="PAYMENT_REQUEST"
          />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="request-date">Ngày đề nghị</Label>
            <Input
              id="request-date"
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              disabled={isPaid}
            />
          </div>
          <div>
            <Label htmlFor="deadline">Hạn thanh toán</Label>
            <Input
              id="deadline"
              type="date"
              value={paymentDeadline}
              onChange={(e) => setPaymentDeadline(e.target.value)}
              disabled={isPaid}
            />
          </div>
          <div>
            <Label>Trạng thái</Label>
            <div className="mt-2">
              <PaymentStatusBadge status={contract.paymentRequest?.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-[#FAF8F5] p-6">
        <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
          Số tiền
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Tổng HĐ (đã VAT)</dt>
            <dd className="font-mono">{formatVND(auto.totalAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Đã tạm ứng</dt>
            <dd className="font-mono">{formatVND(auto.advancePaid)}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--border,#E7E2D9)] pt-2">
            <dt className="font-bold">Số tiền cần thanh toán</dt>
            <dd className="font-mono text-lg font-extrabold">
              {formatVND(auto.amountDue)}
            </dd>
          </div>
        </dl>
        <div className="mt-4 rounded-md bg-white p-3 text-sm">
          <div className="text-[var(--text-muted,#78716C)]">
            Thanh toán vào tài khoản:
          </div>
          <div className="flex items-center gap-2">
            <div className="font-mono">{contract.provider.bankAccount || "—"}</div>
            <CopyAccountBtn value={contract.provider.bankAccount ?? ""} />
          </div>
          <div>{contract.provider.bankName || "—"}</div>
          <div className="text-xs text-[var(--text-muted,#78716C)]">
            {contract.provider.entityName || "—"}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Ghi chú</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          disabled={isPaid}
        />
      </div>

      {!isPaid && (
        <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-[var(--border,#E7E2D9)] bg-white/95 px-6 py-3 backdrop-blur">
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu nháp"}
          </Button>
          <Button onClick={markPaid} disabled={paying} data-testid="btn-mark-paid">
            {paying ? "..." : "Đánh dấu đã thanh toán"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * F-024 UX-35: copy số TK provider — flow phổ biến admin gửi info ngân hàng
 * qua chat / email khi không phải lúc xuất DOCX.
 */
function CopyAccountBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Đã copy số TK", { id: "copy-acc", duration: 1500 });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Trình duyệt chặn clipboard");
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy số tài khoản"
      className="inline-flex size-6 items-center justify-center rounded text-[var(--text-muted,#78716C)] hover:bg-[#F3F0EB] hover:text-[var(--text,#1C1917)]"
    >
      {copied ? (
        <CheckCircle2 className="size-3.5 text-emerald-600" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
