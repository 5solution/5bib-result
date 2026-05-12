"use client";

/**
 * F-028 Screen 3 — P&L Per Contract Detail.
 *
 * RBAC: FinancePageGate enforce `isAdmin` (UI defense-in-depth). Backend
 * cũng enforce qua LogtoAdminGuard.
 */
import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { Button } from "@/components/ui/button";
import { useSetCrumb } from "@/components/admin-shell/breadcrumb-context";
import { CheckCircle2, ChevronLeft, Download, Link2 } from "lucide-react";
import {
  exportPnLExcel,
  getPnLSummary,
} from "@/lib/finance-api";
import { getContract } from "@/lib/contracts-api";
import { PnLSummaryCard } from "../../_components/pnl-summary-card";
import { CostItemsEditor } from "../../_components/cost-items-editor";
import { ContractEditDialog } from "../../../contracts/_components/contract-edit-dialog";

export default function FinancePerContractGate({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <RestrictedAccess message="Module Tài chính chỉ dành cho admin — bạn không có quyền truy cập." />
    );
  }
  return <FinancePerContractPage params={params} />;
}

function FinancePerContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  useSetCrumb(id, "P&L theo HĐ");

  const {
    data: pnl,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["finance", "pnl", id],
    queryFn: () => getPnLSummary(id),
    staleTime: 30_000,
  });

  // F-028 — fetch contract để biết contractType + link state
  // (UI banner "Liên kết MySQL ngay" chỉ show cho TICKET_SALES chưa link).
  const { data: contract } = useQuery({
    queryKey: ["contracts", "detail", id],
    queryFn: () => getContract(id),
    staleTime: 30_000,
  });

  const isTicketSales = contract?.contractType === "TICKET_SALES";
  const isLinked =
    contract?.linkedTenantId != null &&
    contract?.linkedMysqlRaceId != null;

  async function onExportExcel() {
    setExporting(true);
    try {
      const result = await exportPnLExcel(id);
      toast.success(
        `Đã tạo file ${result.filename} (${(result.bytes / 1024).toFixed(1)} KB)`,
      );
      // Auto-trigger download
      const a = document.createElement("a");
      a.href = result.signedUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      toast.error(`Lỗi export: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/contracts/${id}`}
            className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Quay về HĐ
          </Link>
          <span className="text-stone-300">/</span>
          <h1 className="text-xl font-bold text-stone-900">
            Lãi/Lỗ Deal{" "}
            <span className="text-stone-400">
              · {error ? "(lỗi)" : isLoading ? "..." : id.slice(-6)}
            </span>
          </h1>
        </div>
        <Button onClick={onExportExcel} disabled={exporting || !pnl}>
          <Download className="mr-1 size-4" aria-hidden />
          {exporting ? "Đang xuất..." : "Xuất Excel"}
        </Button>
      </div>

      <PnLSummaryCard contractId={id} summary={pnl ?? undefined} />

      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <CostItemsEditor contractId={id} />
      </div>

      {isTicketSales && isLinked && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            <span>
              <strong>Đã liên kết MySQL platform</strong> — P&amp;L đang dùng
              doanh thu THẬT pull từ vé bán (tenantId={" "}
              <code className="rounded bg-emerald-100 px-1">
                {contract?.linkedTenantId}
              </code>
              , raceId{" "}
              <code className="rounded bg-emerald-100 px-1">
                {contract?.linkedMysqlRaceId}
              </code>
              ).
            </span>
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinkDialogOpen(true)}
            >
              <Link2 className="mr-1 size-4" aria-hidden />
              Cập nhật liên kết
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["finance"] });
                qc.invalidateQueries({ queryKey: ["contracts"] });
                toast.info("Đã làm mới P&L");
              }}
            >
              Làm mới P&amp;L
            </Button>
          </div>
        </div>
      )}

      {isTicketSales && !isLinked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-start gap-2">
            <Link2 className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
            <span>
              <strong>Chưa liên kết MySQL platform</strong> — P&amp;L đang
              dùng{" "}
              <code className="rounded bg-amber-100 px-1">estimatedFee</code>{" "}
              (ước tính). Link tenant + race để pull doanh thu THẬT từ vé bán.
            </span>
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => setLinkDialogOpen(true)}>
              <Link2 className="mr-1 size-4" aria-hidden />
              Liên kết MySQL ngay
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["finance"] });
                toast.info("Đã làm mới P&L");
              }}
            >
              Làm mới P&amp;L
            </Button>
          </div>
        </div>
      )}

      {!isTicketSales && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p>
            Lưu ý: P&amp;L cập nhật tự động sau mỗi mutation chi phí (cache
            60s). Doanh thu HĐ này (TIMING/RACEKIT/OPERATIONS) lấy từ Acceptance
            Report khi FINALIZED, fallback contract.totalAmount.
          </p>
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["finance"] });
                toast.info("Đã làm mới P&L");
              }}
            >
              Làm mới P&amp;L
            </Button>
          </div>
        </div>
      )}

      {contract && (
        <ContractEditDialog
          contract={contract}
          open={linkDialogOpen}
          onClose={() => setLinkDialogOpen(false)}
          onSaved={(updated) => {
            qc.setQueryData(["contracts", "detail", id], updated);
            qc.invalidateQueries({ queryKey: ["finance", "pnl", id] });
          }}
        />
      )}
    </div>
  );
}
