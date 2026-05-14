"use client";

/**
 * F-024 Contract detail page (PRD Screen 3).
 *
 * Actions:
 *   - Activate (DRAFT → ACTIVE)
 *   - Create acceptance report (only if ACTIVE)
 *   - Create payment request (only if acceptance FINALIZED)
 *   - Export DOCX / PDF
 *   - Cancel contract
 *   - Soft delete
 */
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ContractDetailSections } from "../_components/contract-detail-sections";
import { DocumentDownloadBtn } from "../_components/document-download-btn";
import {
  acceptQuotation,
  activateContract,
  convertQuotation,
  deleteContract,
  getContract,
  rejectQuotation,
  updateContract,
  type ContractView,
} from "@/lib/contracts-api";
import { CheckCircle2, FileSignature, Pencil, ReceiptText, Trash2, Repeat, ChevronLeft, ThumbsUp, ThumbsDown } from "lucide-react";
import { useSetCrumb } from "@/components/admin-shell/breadcrumb-context";
import { useConfirm } from "@/components/confirm-dialog";
import { DetailSkeleton } from "../_components/detail-skeleton";
import { ContractEditDialog } from "../_components/contract-edit-dialog";
// F-028 — embed P&L summary card (admin-only defense-in-depth).
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { PnLSummaryCard } from "../../finance/_components/pnl-summary-card";

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { id } = use(params);
  // F-029 BR-HD-30 — page-level RBAC gate.
  const { isAdmin, isStaff, isLoading: authLoading } = useAuth();

  const [contract, setContract] = useState<ContractView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // F-024 Fix 2 — edit dialog open state
  const [editOpen, setEditOpen] = useState(false);

  // UX-01/UX-04: dynamic breadcrumb + browser tab title từ contractNumber
  const crumbLabel = contract?.contractNumber ?? (loading ? null : "Hợp đồng nháp");
  useSetCrumb(id, crumbLabel);
  useEffect(() => {
    if (!contract) return;
    const cn = contract.contractNumber ?? "Hợp đồng nháp";
    document.title = `${cn} · Hợp đồng · 5BIB Admin`;
  }, [contract]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getContract(id);
      setContract(c);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function activate() {
    if (!contract) return;
    setBusy(true);
    try {
      const next = await activateContract(contract._id);
      toast.success(`Đã kích hoạt: ${next.contractNumber}`);
      setContract(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancelContract() {
    if (!contract) return;
    const ok = await confirm({
      title: "Huỷ hợp đồng?",
      description: `Huỷ HĐ ${contract.contractNumber ?? "này"}? Hành động này không thể hoàn tác.`,
      confirmText: "Huỷ HĐ",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await updateContract(contract._id, { status: "CANCELLED" });
      toast.success("Đã huỷ");
      setContract(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function softDelete() {
    if (!contract) return;
    const ok = await confirm({
      title: "Xoá hợp đồng?",
      description: `Xoá HĐ ${contract.contractNumber ?? "này"}? Có thể khôi phục từ trang admin.`,
      confirmText: "Xoá",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteContract(contract._id);
      toast.success("Đã xoá");
      router.push("/contracts");
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (!contract) return;
    setBusy(true);
    try {
      const next = await convertQuotation(contract._id);
      toast.success(`Đã chuyển sang HĐ: ${next.contractNumber}`);
      router.push(`/contracts/${next._id}`);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // F-024 BUG-001 — đối tác chấp nhận báo giá (Quotation DRAFT → ACCEPTED)
  async function handleAcceptQuotation() {
    if (!contract) return;
    const ok = await confirm({
      title: "Đối tác chấp nhận báo giá?",
      description:
        "Xác nhận đối tác đã chấp nhận báo giá. Sau khi chấp nhận có thể chuyển thành Hợp đồng.",
      confirmText: "Chấp nhận",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await acceptQuotation(contract._id);
      toast.success("Đã ghi nhận đối tác chấp nhận báo giá");
      setContract(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectQuotation() {
    if (!contract) return;
    const ok = await confirm({
      title: "Đối tác từ chối báo giá?",
      description:
        "Xác nhận đối tác đã từ chối. Báo giá sẽ chuyển sang REJECTED và KHÔNG thể chuyển thành hợp đồng.",
      confirmText: "Từ chối",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await rejectQuotation(contract._id);
      toast.success("Đã ghi nhận đối tác từ chối báo giá");
      setContract(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return null;
  if (!isStaff) return <RestrictedAccess />;
  if (loading) return <DetailSkeleton sections={4} />;
  if (!contract) return <div className="p-6">Không tìm thấy hợp đồng</div>;

  const isDraft = contract.status === "DRAFT";
  const isActive = contract.status === "ACTIVE";
  const acceptanceFinalized =
    contract.acceptanceReport?.status === "FINALIZED";
  // F-024 BUG-009 — phân biệt Quotation states để hiển thị button đúng:
  //  - DRAFT (mới tạo) → đối tác chấp nhận / từ chối
  //  - ACCEPTED → admin chuyển thành Hợp đồng
  const isQuotationDoc = contract.documentType === "QUOTATION";
  const isQuotationDraft = isQuotationDoc && contract.status === "DRAFT";
  const isQuotation = isQuotationDoc && contract.status === "ACCEPTED";
  const docType = contract.documentType === "QUOTATION" ? "QUOTATION" : "CONTRACT";
  // F-024 Phase 3 finalize: TICKET_SALES dùng đối soát doanh thu (BR-CM-08),
  // KHÔNG dùng Biên bản nghiệm thu → ẩn toàn bộ flow acceptance.
  const supportsAcceptance = contract.contractType !== "TICKET_SALES";
  // Payment Request flow của TICKET_SALES (nếu có) sẽ pass-through theo
  // acceptance hiện tại (Phase 3 không thay đổi). Hiển thị download Payment
  // theo paymentRequest có hay không như cũ.

  return (
    <div className="space-y-6 p-6">
      {/* UX-11 back button — consistent với partner edit / acceptance / payment */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/contracts")}
        >
          <ChevronLeft className="size-4" /> Danh sách hợp đồng
        </Button>
      </div>
      {/* UX-32 actions group 2 row trên màn hẹp:
          Row 1 primary lifecycle actions (left) + destructive (right)
          Row 2 download buttons (right) — riêng row tránh wrap lung tung */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && (
            <>
              <Button
                variant="outline"
                onClick={() => setEditOpen(true)}
                disabled={busy}
                data-testid="btn-edit"
              >
                <Pencil className="size-4" /> Chỉnh sửa
              </Button>
              {/* F-024 BUG-009 — "Kích hoạt" chỉ áp dụng cho CONTRACT, không cho QUOTATION.
                  QUOTATION DRAFT phải đi qua flow accept/reject của đối tác. */}
              {!isQuotationDoc && (
                <Button onClick={activate} disabled={busy} data-testid="btn-activate">
                  <CheckCircle2 className="size-4" /> Kích hoạt
                </Button>
              )}
              {isQuotationDraft && (
                <>
                  <Button
                    onClick={handleAcceptQuotation}
                    disabled={busy}
                    data-testid="btn-accept-quotation"
                  >
                    <ThumbsUp className="size-4" /> Đối tác chấp nhận báo giá
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRejectQuotation}
                    disabled={busy}
                    data-testid="btn-reject-quotation"
                  >
                    <ThumbsDown className="size-4" /> Đối tác từ chối
                  </Button>
                </>
              )}
            </>
          )}
          {/*
            FEATURE-034 (Danny 2026-05-14 "tao muốn sửa được trong mọi trường
            hợp"): non-DRAFT HĐ giờ vẫn cho sửa nhưng đi qua confirm dialog
            cảnh báo legal implication. Audit emit `contract.update.force`
            track accountability backend side.
          */}
          {!isDraft && (
            <Button
              variant="outline"
              onClick={async () => {
                const ok = await confirm({
                  title: `Sửa HĐ đang ${contract.status}?`,
                  description:
                    contract.status === "ACTIVE"
                      ? "HĐ đã ký + có số HĐ chính thức. Sửa = mismatch với DOCX physical đã sign. Bạn nhớ regenerate DOCX/PDF + re-send đối tác sau khi sửa. Tiếp tục?"
                      : contract.status === "COMPLETED"
                        ? "HĐ đã COMPLETED + có biên bản nghiệm thu + yêu cầu thanh toán. Sửa line items KHÔNG auto-recompute acceptance/payment numbers — bạn cần check + fix manual nếu cần. Tiếp tục?"
                      : contract.status === "CANCELLED" || contract.status === "REJECTED"
                        ? `HĐ đã ${contract.status}. Sửa = thay đổi data lịch sử. Audit log sẽ track. Tiếp tục?`
                        : `HĐ đang ${contract.status}. Sửa sẽ override line items / payment terms. Audit log track ai sửa + status snapshot. Tiếp tục?`,
                  confirmText: "Vẫn sửa",
                  variant: "destructive",
                });
                if (ok) setEditOpen(true);
              }}
              disabled={busy}
              title={`Sửa HĐ (audit force_edit từ status ${contract.status})`}
              aria-label={`Chỉnh sửa HĐ ${contract.status}`}
              data-testid="btn-edit-force"
            >
              <Pencil className="size-4" /> Chỉnh sửa
            </Button>
          )}
          {isQuotation && (
            <Button onClick={convert} disabled={busy}>
              <Repeat className="size-4" /> Chuyển thành hợp đồng
            </Button>
          )}
          {isActive && supportsAcceptance && (
            <Button
              variant="outline"
              onClick={() => router.push(`/contracts/${contract._id}/acceptance`)}
              data-testid="btn-create-acceptance"
            >
              <FileSignature className="size-4" /> Tạo biên bản nghiệm thu
            </Button>
          )}
          {acceptanceFinalized && supportsAcceptance && (
            <Button
              variant="outline"
              onClick={() => router.push(`/contracts/${contract._id}/payment`)}
              data-testid="btn-create-payment"
            >
              <ReceiptText className="size-4" /> Tạo đề nghị thanh toán
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelContract}
              disabled={busy || !isActive}
            >
              Huỷ HĐ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={softDelete}
              disabled={busy}
              aria-label="Xoá"
            >
              <Trash2 className="size-4 text-red-600" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DocumentDownloadBtn contractId={contract._id} docType={docType} />
          {acceptanceFinalized && supportsAcceptance && (
            <DocumentDownloadBtn
              contractId={contract._id}
              docType="ACCEPTANCE_REPORT"
            />
          )}
          {contract.paymentRequest && (
            <DocumentDownloadBtn
              contractId={contract._id}
              docType="PAYMENT_REQUEST"
            />
          )}
        </div>
      </div>

      <ContractDetailSections contract={contract} />

      {/* F-028 — Lãi/Lỗ Deal section, admin-only defense-in-depth. */}
      {isAdmin && (
        <section
          data-testid="pnl-deal-section"
          className="space-y-3"
          aria-label="Lãi lỗ Deal"
        >
          <h2 className="text-base font-semibold text-stone-900">
            💰 Lãi/Lỗ Deal
          </h2>
          <PnLSummaryCard contractId={contract._id} compact />
        </section>
      )}

      {/* F-024 Fix 2 — edit dialog (DRAFT only). */}
      {editOpen && contract && (
        <ContractEditDialog
          contract={contract}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => setContract(next)}
        />
      )}
    </div>
  );
}
