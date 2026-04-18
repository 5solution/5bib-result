"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  confirmRoleImport,
  downloadRoleTemplate,
  previewRoleImport,
  type ParsedRoleRow,
  type ParsedRoleRowError,
  type PreviewRoleImportResponse,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Download, FileUp } from "lucide-react";
import { toast } from "sonner";

type Step = "upload" | "previewing" | "preview" | "confirming" | "done" | "error";

interface Props {
  eventId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function RoleImportDialog({
  eventId,
  open,
  onOpenChange,
  onImported,
}: Props): React.ReactElement {
  const { token } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [preview, setPreview] = useState<PreviewRoleImportResponse | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setErrorMsg("");
    setPreview(null);
    setResult(null);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  function handleClose(next: boolean): void {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFile(file: File): Promise<void> {
    if (!token) return;
    if (file.size > 1024 * 1024) {
      setStep("error");
      setErrorMsg("File quá lớn (tối đa 1MB)");
      return;
    }
    setStep("previewing");
    setErrorMsg("");
    try {
      const res = await previewRoleImport(token, eventId, file);
      setPreview(res);
      setStep("preview");
    } catch (err) {
      setStep("error");
      setErrorMsg((err as Error).message);
    }
  }

  async function handleDownloadTemplate(): Promise<void> {
    if (!token) return;
    try {
      await downloadRoleTemplate(token);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!token || !preview || preview.valid_rows.length === 0) return;
    setStep("confirming");
    try {
      const res = await confirmRoleImport(token, eventId, preview.valid_rows);
      setResult({ created: res.created, skipped: res.skipped });
      setStep("done");
      toast.success(`Đã tạo ${res.created} vai trò`);
      onImported();
    } catch (err) {
      setStep("error");
      setErrorMsg((err as Error).message);
    }
  }

  const validCount = preview?.valid_rows.length ?? 0;
  const invalidCount = preview?.invalid_rows.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {step === "preview" || step === "confirming"
              ? `Xem trước — ${preview?.total_rows ?? 0} vai trò`
              : step === "done"
                ? "Import hoàn tất"
                : "Import vai trò từ file"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" || step === "error" ? (
          <UploadStep
            onFile={handleFile}
            onDownloadTemplate={handleDownloadTemplate}
            dragOver={dragOver}
            setDragOver={setDragOver}
            fileInputRef={fileInputRef}
            errorMsg={step === "error" ? errorMsg : ""}
          />
        ) : null}

        {step === "previewing" || step === "confirming" ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {step === "previewing"
              ? "Đang phân tích file..."
              : "Đang tạo vai trò..."}
          </div>
        ) : null}

        {step === "preview" && preview ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default">
                <CheckCircle2 className="mr-1 size-3" /> {validCount} hợp lệ
              </Badge>
              {invalidCount > 0 ? (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 size-3" /> {invalidCount} lỗi
                </Badge>
              ) : null}
            </div>
            <div className="max-h-[50vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead className="w-20">Slots</TableHead>
                    <TableHead className="w-32">Thù lao/ngày</TableHead>
                    <TableHead className="w-24">Ngày</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.valid_rows.map((r) => (
                    <TableRow key={`v-${r._row}`}>
                      <TableCell className="text-muted-foreground">
                        {r._row}
                      </TableCell>
                      <TableCell className="font-medium">{r.role_name}</TableCell>
                      <TableCell>
                        {r.max_slots ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.daily_rate.toLocaleString("vi-VN")} ₫
                      </TableCell>
                      <TableCell>{r.working_days}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-green-600">
                          <CheckCircle2 className="mr-1 size-4" /> OK
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {preview.invalid_rows.map((r: ParsedRoleRowError) => (
                    <TableRow
                      key={`i-${r._row}`}
                      className="bg-red-500/10 hover:bg-red-500/15"
                    >
                      <TableCell className="text-muted-foreground">
                        {r._row}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.role_name || (
                          <span className="text-muted-foreground">
                            (trống)
                          </span>
                        )}
                      </TableCell>
                      <TableCell colSpan={3} className="text-xs text-red-500">
                        {r.errors.join("; ")}
                      </TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center text-red-600"
                          title={r.errors.join("\n")}
                        >
                          <AlertCircle className="mr-1 size-4" /> Lỗi
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        {step === "done" && result ? (
          <div className="py-10 text-center space-y-4">
            <CheckCircle2 className="mx-auto size-16 text-green-500" />
            <div>
              <p className="text-lg font-medium">
                Đã tạo thành công {result.created} vai trò
              </p>
              {result.skipped > 0 ? (
                <p className="text-sm text-muted-foreground mt-1">
                  {result.skipped} dòng bị bỏ qua (trùng tên đã tồn tại)
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {step === "preview" ? (
            <>
              <Button variant="ghost" onClick={reset}>
                ← Tải lại file
              </Button>
              <Button
                disabled={validCount === 0}
                onClick={() => {
                  void handleConfirm();
                }}
              >
                {invalidCount > 0
                  ? `Bỏ qua lỗi, import ${validCount} dòng`
                  : `Import ${validCount} vai trò`}
              </Button>
            </>
          ) : step === "done" ? (
            <Button onClick={() => handleClose(false)}>
              Xem danh sách vai trò
            </Button>
          ) : step === "upload" || step === "error" ? (
            <Button variant="ghost" onClick={() => handleClose(false)}>
              Hủy
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadStep({
  onFile,
  onDownloadTemplate,
  dragOver,
  setDragOver,
  fileInputRef,
  errorMsg,
}: {
  onFile: (f: File) => void;
  onDownloadTemplate: () => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  errorMsg: string;
}): React.ReactElement {
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`rounded-lg border-2 border-dashed p-10 text-center transition ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25"
        }`}
      >
        <FileUp className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-3 text-sm">
          Kéo thả file vào đây, hoặc{" "}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => fileInputRef.current?.click()}
          >
            chọn file
          </button>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Hỗ trợ: .csv, .xlsx — Tối đa 200 dòng, 1MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>
      {errorMsg ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {errorMsg}
        </div>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={onDownloadTemplate}
        type="button"
      >
        <Download className="mr-2 size-4" /> Tải file mẫu
      </Button>
    </div>
  );
}

// unused helper kept for type re-export hygiene
export type { ParsedRoleRow };
