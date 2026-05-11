"use client";

/**
 * F-024 UX-39 v3 Task 2 — Upload DOCX template + history modal.
 *
 * Workflow:
 *   1. Admin edit header/footer/Bên A/B/signature ở Word desktop
 *   2. Upload .docx file (max 10MB)
 *   3. Backend validate qua docxtemplater dry-run + backup file cũ
 *   4. Cache invalidate → Audit Viewer reload tự động via refreshKey
 *
 * History modal: list backup versions với "Khôi phục" per version.
 */
import { useRef, useState, useEffect } from "react";
import { Upload, History, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import {
  uploadContractTemplateDocx,
  listContractTemplateVersions,
  restoreContractTemplateVersion,
  type ContractType,
  type TemplateVersion,
} from "@/lib/contracts-api";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  type: ContractType;
  onUploaded?: () => void;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export function TemplateUploadBtn({
  type,
  onUploaded,
}: Props): React.ReactElement {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!historyOpen) return;
    setVersionsLoading(true);
    listContractTemplateVersions(type)
      .then((r) => setVersions(r.versions))
      .catch((err: Error) =>
        toast.error(`Lỗi tải lịch sử: ${err.message}`),
      )
      .finally(() => setVersionsLoading(false));
  }, [historyOpen, type]);

  async function handleFile(file: File): Promise<void> {
    if (file.type !== DOCX_MIME && !file.name.toLowerCase().endsWith(".docx")) {
      toast.error("Chỉ chấp nhận file .docx (Word document)");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(
        `File quá lớn (${fmtBytes(file.size)}). Giới hạn: 10MB`,
      );
      return;
    }
    const ok = await confirm({
      title: "Tải lên mẫu mới?",
      description: `File: ${file.name} (${fmtBytes(
        file.size,
      )}). Mẫu DOCX hiện tại sẽ được backup tự động, sau đó thay thế. Không ảnh hưởng HĐ đã tạo, chỉ ảnh hưởng HĐ mới.`,
      confirmText: "Tải lên + thay thế",
    });
    if (!ok) return;

    setUploading(true);
    try {
      const result = await uploadContractTemplateDocx(type, file);
      const backupMsg = result.backup
        ? ` (backup: ${result.backup.filename})`
        : "";
      toast.success(`Đã tải lên ${result.newFilename}${backupMsg}`);
      onUploaded?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleRestore(version: TemplateVersion): Promise<void> {
    const ok = await confirm({
      title: "Khôi phục bản sao này?",
      description: `Mẫu hiện tại sẽ được backup, sau đó thay thế bằng ${version.filename} (${fmtBytes(version.size)}, ${fmtDate(version.createdAt)}). Không ảnh hưởng HĐ đã tạo.`,
      confirmText: "Khôi phục",
    });
    if (!ok) return;

    setRestoringFile(version.filename);
    try {
      await restoreContractTemplateVersion(type, version.filename);
      toast.success(`Đã khôi phục từ ${version.filename}`);
      setHistoryOpen(false);
      onUploaded?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRestoringFile(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInput}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button
        size="sm"
        variant="default"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            Đang tải lên...
          </>
        ) : (
          <>
            <Upload className="mr-1.5 size-3.5" />
            Tải lên mẫu mới
          </>
        )}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setHistoryOpen(true)}
      >
        <History className="mr-1.5 size-3.5" />
        Xem lịch sử bản sao
      </Button>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lịch sử bản sao — {type}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {versionsLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Đang tải...</p>
            ) : versions.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Chưa có bản backup. Backup sẽ tự động tạo khi tải lên mẫu mới.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-[#F3F0EB] text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted,#78716C)]">
                  <tr>
                    <th className="px-3 py-2 text-left">Tên file backup</th>
                    <th className="px-3 py-2 text-right w-24">Dung lượng</th>
                    <th className="px-3 py-2 text-left w-44">Thời gian tạo</th>
                    <th className="px-3 py-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr
                      key={v.filename}
                      className="border-t border-[var(--border,#E7E2D9)] hover:bg-[#FAF8F5]"
                    >
                      <td className="px-3 py-2 font-mono text-[12px]">
                        {v.filename}
                      </td>
                      <td className="px-3 py-2 text-right text-[12px]">
                        {fmtBytes(v.size)}
                      </td>
                      <td className="px-3 py-2 text-[12px]">
                        {fmtDate(v.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRestore(v)}
                          disabled={restoringFile === v.filename}
                        >
                          {restoringFile === v.filename ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1 size-3" />
                          )}
                          Khôi phục
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TemplateUploadBtn;
