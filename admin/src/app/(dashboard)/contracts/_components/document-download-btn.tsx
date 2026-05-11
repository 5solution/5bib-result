"use client";

/**
 * F-024 Document download button — trigger generate → download blob.
 *
 * Flow:
 *   1. POST /api/contracts/:id/generate/:docType → { docxKey, docxUrl, pdfKey?, pdfUrl? }
 *   2. For DOCX or PDF caller chooses format (default DOCX):
 *      - Option A: use returned signed URL (`docxUrl` / `pdfUrl`) — opens in browser.
 *      - Option B: streamDownloadBlob via /api/contracts/:id/download/stream — bypass
 *        cross-origin signed URL awkwardness (used here for reliability).
 *
 * Note: PDF có thể `undefined` nếu LibreOffice convert fail (Phase 2A graceful
 * degrade) — button hiển thị "DOCX only" badge.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownActionTrigger,
  DropdownActionMenu,
} from "./dropdown-action";
import { Download, FileText, FileType2, Loader2 } from "lucide-react";
import {
  generateDocument,
  streamDownloadBlob,
  type GeneratedDocumentEntry,
} from "@/lib/contracts-api";

type DocType = GeneratedDocumentEntry["docType"];

const DOCTYPE_LABEL: Record<DocType, string> = {
  QUOTATION: "Báo giá",
  CONTRACT: "Hợp đồng",
  ACCEPTANCE_REPORT: "Biên bản nghiệm thu",
  PAYMENT_REQUEST: "Đề nghị thanh toán",
};

type Props = {
  contractId: string;
  docType: DocType;
  /** If provided, shown as button label suffix. */
  variant?: "primary" | "outline";
};

export function DocumentDownloadBtn({
  contractId,
  docType,
  variant = "outline",
}: Props) {
  const [busy, setBusy] = useState(false);

  async function trigger(format: "DOCX" | "PDF") {
    setBusy(true);
    try {
      const res = await generateDocument(contractId, docType);
      const key = format === "DOCX" ? res.docxKey : res.pdfKey;
      if (!key) {
        toast.error(
          format === "PDF"
            ? "Server không tạo được PDF (LibreOffice fail). Hãy tải DOCX."
            : "Lỗi server — không có DOCX key",
        );
        return;
      }
      const blob = await streamDownloadBlob(contractId, key);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${DOCTYPE_LABEL[docType]}-${contractId}.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Đã tải ${format}`);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownActionMenu
      label={
        <span className="inline-flex items-center gap-2">
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Xuất {DOCTYPE_LABEL[docType]}
        </span>
      }
      disabled={busy}
      variant={variant}
    >
      <DropdownActionTrigger onSelect={() => trigger("DOCX")}>
        <FileText className="size-4" /> DOCX
      </DropdownActionTrigger>
      <DropdownActionTrigger onSelect={() => trigger("PDF")}>
        <FileType2 className="size-4" /> PDF
      </DropdownActionTrigger>
    </DropdownActionMenu>
  );
}
