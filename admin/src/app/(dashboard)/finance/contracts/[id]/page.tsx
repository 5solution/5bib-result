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
import { ChevronLeft, Download, ExternalLink } from "lucide-react";
import {
  exportPnLExcel,
  getPnLSummary,
} from "@/lib/finance-api";
import { PnLSummaryCard } from "../../_components/pnl-summary-card";
import { CostItemsEditor } from "../../_components/cost-items-editor";

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

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="flex items-start gap-2">
          <ExternalLink
            className="mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <span>
            Lưu ý: P&amp;L cập nhật tự động sau mỗi mutation chi phí (cache
            60s). Doanh thu từ TICKET_SALES cần link tenant + race MySQL trong{" "}
            <code>templateOverrides</code> mới pull được thật — chưa link sẽ
            dùng <code>estimatedFee</code>.
          </span>
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
    </div>
  );
}
