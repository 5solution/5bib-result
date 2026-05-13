"use client";

/**
 * FEATURE-032 — Partner Excel Import Dialog.
 *
 * 2-step UX per PAUSE-32-03 (mirror F-031 ServiceCatalogImportDialog):
 *   Step 1 (upload):  file picker + "Tải template" link + "Xem trước" button
 *   Step 2 (preview): table với badge OK/Trùng/Lỗi + "Xác nhận thêm N đối tác" button
 *
 * State machine: 'upload' → 'preview' → 'done' (close).
 *
 * Per PAUSE-32-04 max 200 rows enforced server-side.
 * Per PAUSE-32-02 duplicate Skip + report (chỉ valid rows được insert).
 *   - Row có taxId → check by taxId (MST stable, sparse unique)
 *   - Row không taxId → fallback check by entityName exact
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  previewPartnerImport,
  confirmPartnerImport,
  getPartnerTemplateUrl,
  type PartnerImportPreview,
} from "@/lib/contracts-api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PartnerImportDialog({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PartnerImportPreview | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handlePreview() {
    if (!file) {
      toast.error("Chọn file Excel trước");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Chỉ chấp nhận file .xlsx");
      return;
    }
    setLoading(true);
    try {
      const data = await previewPartnerImport(file);
      setPreview(data);
      setStep("preview");
      if (data.total === 0) {
        toast.message("File rỗng — KHÔNG có dòng dữ liệu nào để import");
      }
    } catch (err) {
      toast.error(`Parse thất bại: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview || preview.valid.length === 0) return;
    setLoading(true);
    try {
      const result = await confirmPartnerImport(preview.valid);
      let msg = `Đã thêm ${result.inserted} đối tác`;
      if (result.skipped_duplicate > 0) {
        msg += ` (bỏ qua ${result.skipped_duplicate} trùng)`;
      }
      if (result.failed > 0) {
        msg += ` — ${result.failed} dòng lỗi`;
      }
      toast.success(msg);
      onSuccess();
      reset();
    } catch (err) {
      toast.error(`Import thất bại: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  function downloadTemplate() {
    const url = getPartnerTemplateUrl();
    const a = document.createElement("a");
    a.href = url;
    a.download = "partners-template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            {step === "upload"
              ? "Import đối tác từ Excel"
              : "Xem trước Import"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium mb-2">Hướng dẫn import</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>
                  File định dạng <code>.xlsx</code> (max 5MB, ≤200 dòng/lần).
                </li>
                <li>
                  11 cột: <strong>Tên đối tác</strong> (bắt buộc), Tên viết tắt,
                  Mã số thuế, Địa chỉ, Người đại diện, Chức vụ, Số tài khoản,
                  Ngân hàng, Điện thoại, Email, Ghi chú.
                </li>
                <li>
                  Đối tác <strong>trùng Mã số thuế</strong> (nếu có) hoặc{" "}
                  <strong>trùng Tên đối tác</strong> (nếu không có MST) sẽ bỏ
                  qua.
                </li>
                <li>
                  Email phải đúng format (vd: <code>a@b.com</code>) — dòng sai
                  format sẽ báo lỗi, KHÔNG block các dòng khác.
                </li>
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={downloadTemplate}
              >
                <Download className="mr-2 size-4" /> Tải file mẫu
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="partner-import-file"
                className="text-sm font-medium"
              >
                File Excel
              </label>
              <input
                id="partner-import-file"
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  Đã chọn: <strong>{file.name}</strong> (
                  {(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose} disabled={loading}>
                Hủy
              </Button>
              <Button onClick={handlePreview} disabled={!file || loading}>
                {loading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                Xem trước
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-3 text-sm">
              <Badge
                variant="default"
                className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
              >
                <CheckCircle2 className="mr-1 size-3" />
                {preview.valid.length} hợp lệ
              </Badge>
              {preview.duplicate.length > 0 && (
                <Badge
                  variant="default"
                  className="bg-amber-100 text-amber-700 hover:bg-amber-100"
                >
                  <AlertTriangle className="mr-1 size-3" />
                  {preview.duplicate.length} trùng (bỏ qua)
                </Badge>
              )}
              {preview.invalid.length > 0 && (
                <Badge variant="destructive">
                  <XCircle className="mr-1 size-3" />
                  {preview.invalid.length} lỗi
                </Badge>
              )}
              <span className="text-muted-foreground">
                Tổng: {preview.total} dòng
              </span>
            </div>

            {/* Valid rows preview */}
            {preview.valid.length > 0 && (
              <div className="rounded-lg border">
                <div className="border-b bg-emerald-50/50 px-3 py-2 text-sm font-medium text-emerald-700">
                  ✅ {preview.valid.length} dòng sẽ được thêm vào danh sách đối
                  tác
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Tên đối tác</TableHead>
                        <TableHead>MST</TableHead>
                        <TableHead>Đại diện</TableHead>
                        <TableHead>Điện thoại</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.valid.map((row) => (
                        <TableRow key={`v-${row.rowNum}`}>
                          <TableCell className="text-muted-foreground">
                            {row.rowNum}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.entityName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.taxId ?? "—"}
                          </TableCell>
                          <TableCell>{row.representative ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.phone ?? "—"}
                          </TableCell>
                          <TableCell>{row.email ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Duplicate rows */}
            {preview.duplicate.length > 0 && (
              <div className="rounded-lg border">
                <div className="border-b bg-amber-50/50 px-3 py-2 text-sm font-medium text-amber-700">
                  ⚠️ {preview.duplicate.length} dòng trùng (đã tồn tại) — sẽ
                  bỏ qua
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Tên đối tác</TableHead>
                        <TableHead>MST</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.duplicate.map((row) => (
                        <TableRow key={`d-${row.rowNum}`}>
                          <TableCell className="text-muted-foreground">
                            {row.rowNum}
                          </TableCell>
                          <TableCell>{row.entityName}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.taxId ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Invalid rows */}
            {preview.invalid.length > 0 && (
              <div className="rounded-lg border">
                <div className="border-b bg-red-50/50 px-3 py-2 text-sm font-medium text-red-700">
                  ❌ {preview.invalid.length} dòng lỗi — sẽ bỏ qua. Sửa file
                  Excel + thử lại.
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Tên (raw)</TableHead>
                        <TableHead>Lỗi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.invalid.map((row) => (
                        <TableRow key={`i-${row.rowNum}`}>
                          <TableCell className="text-muted-foreground">
                            {row.rowNum}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {String(
                              (row.raw as { entityName?: unknown })
                                .entityName ?? "—",
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-red-700">
                            {row.errors.join("; ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setStep("upload")}
                disabled={loading}
              >
                Quay lại
              </Button>
              <Button variant="ghost" onClick={handleClose} disabled={loading}>
                Hủy
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading || preview.valid.length === 0}
              >
                {loading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" />
                )}
                Xác nhận thêm {preview.valid.length} đối tác
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
