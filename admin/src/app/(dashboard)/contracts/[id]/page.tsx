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
  activateContract,
  convertQuotation,
  deleteContract,
  getContract,
  updateContract,
  type ContractView,
} from "@/lib/contracts-api";
import { CheckCircle2, FileSignature, ReceiptText, Trash2, Repeat, ChevronLeft } from "lucide-react";
import { useSetCrumb } from "@/components/admin-shell/breadcrumb-context";
import { useConfirm } from "@/components/confirm-dialog";
import { DetailSkeleton } from "../_components/detail-skeleton";

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { id } = use(params);

  const [contract, setContract] = useState<ContractView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
      const next = await updateContract(contract._id, { status: "CANCELLED" } as any);
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

  if (loading) return <DetailSkeleton sections={4} />;
  if (!contract) return <div className="p-6">Không tìm thấy hợp đồng</div>;

  const isDraft = contract.status === "DRAFT";
  const isActive = contract.status === "ACTIVE";
  const acceptanceFinalized =
    contract.acceptanceReport?.status === "FINALIZED";
  const isQuotation =
    contract.documentType === "QUOTATION" && contract.status === "ACCEPTED";
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
      <div className="flex flex-wrap items-center gap-2">
        {isDraft && (
          <Button onClick={activate} disabled={busy} data-testid="btn-activate">
            <CheckCircle2 className="size-4" /> Kích hoạt
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

      <ContractDetailSections contract={contract} />
    </div>
  );
}
