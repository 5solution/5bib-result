"use client";

/**
 * F-028 Phase 2 — Trigger Excel aggregated export (signed URL S3 15min).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  exportDashboardExcel,
  type DashboardFilter,
  FinanceApiError,
} from "@/lib/finance-api";

export function PnLExportButton({ filter }: { filter: DashboardFilter }) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await exportDashboardExcel(filter);
      // Mở signedUrl trong tab mới — browser xử lý tải xuống.
      window.open(res.signedUrl, "_blank", "noopener");
      toast.success(`Đã tạo Excel tổng hợp — ${res.filename}`);
    } catch (e) {
      const msg =
        e instanceof FinanceApiError
          ? e.message
          : "Không thể xuất Excel. Thử lại sau ít phút.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="mr-1 size-4 animate-spin" />
      ) : (
        <Download className="mr-1 size-4" />
      )}
      Xuất Excel tổng hợp
    </Button>
  );
}
