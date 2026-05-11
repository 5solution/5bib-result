"use client";

/**
 * F-024 Acceptance Report page (PRD Screen 4).
 *
 * Pre-fill từ contract.lineItems; admin edit / add / remove tự do. Diff hiển
 * thị real-time. Save nháp → Finalize.
 */
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AcceptanceReportForm } from "../../_components/acceptance-report-form";
import { DocumentDownloadBtn } from "../../_components/document-download-btn";
import { getContract, type ContractView } from "@/lib/contracts-api";
import { ChevronLeft } from "lucide-react";

export default function AcceptancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [contract, setContract] = useState<ContractView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getContract(id)
      .then((c) => {
        // F-024 Phase 3 finalize: TICKET_SALES không có Biên bản nghiệm thu
        // (dùng đối soát doanh thu BR-CM-08). Defense-in-depth — redirect về
        // detail page tránh user mở trực tiếp URL.
        if (c.contractType === "TICKET_SALES") {
          toast.error(
            "TICKET_SALES không sử dụng Biên bản nghiệm thu — dùng quy trình đối soát thay thế",
          );
          router.replace(`/contracts/${c._id}`);
          return;
        }
        setContract(c);
      })
      .catch((err) => toast.error(`Lỗi: ${err.message}`))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="p-6">Đang tải...</div>;
  if (!contract) return <div className="p-6">Không tìm thấy hợp đồng</div>;

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
            Biên bản nghiệm thu
          </h1>
          <p className="font-mono text-xs text-[var(--text-muted,#78716C)]">
            HĐ: {contract.contractNumber}
          </p>
        </div>
        {contract.acceptanceReport?.status === "FINALIZED" && (
          <div className="ml-auto">
            <DocumentDownloadBtn
              contractId={contract._id}
              docType="ACCEPTANCE_REPORT"
            />
          </div>
        )}
      </div>

      <AcceptanceReportForm
        contract={contract}
        onUpdated={(next) => setContract(next)}
      />
    </div>
  );
}
