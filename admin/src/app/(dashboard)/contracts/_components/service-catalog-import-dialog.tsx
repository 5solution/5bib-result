"use client";

/**
 * FEATURE-031 — Service Catalog Excel Import Dialog.
 *
 * 2-step UX per PAUSE-31-03:
 *   Step 1 (upload):  file picker + "Tải template" link + "Xem trước" button
 *   Step 2 (preview): table với badge OK/Trùng/Lỗi + "Xác nhận thêm N dịch vụ" button
 *
 * State machine: 'upload' → 'preview' → 'done' (close).
 *
 * Per PAUSE-31-04 max 200 rows enforced server-side.
 * Per PAUSE-31-02 duplicate Skip + report (chỉ valid rows được insert).
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
import { Loader2, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  previewServiceCatalogImport,
  confirmServiceCatalogImport,
  getServiceCatalogTemplateUrl,
  type ServiceCatalogImportPreview,
} from "@/lib/contracts-api";

const CATEGORY_LABEL: Record<string, string> = {
  TIMING: "Tính giờ",
  RACEKIT: "Racekit",
  OPERATIONS: "Vận hành",
  GENERAL: "Chung",
};

function fmtVnd(n: number | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ServiceCatalogImportDialog({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ServiceCatalogImportPreview | null>(null);
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
      const data = await previewServiceCatalogImport(file);
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
      const result = await confirmServiceCatalogImport(preview.valid);
      let msg = `Đã thêm ${result.inserted} dịch vụ`;
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
    // Browser GET with auth cookies (LogtoStaffGuard handles auth)
    const url = getServiceCatalogTemplateUrl();
    const a = document.createElement("a");
    a.href = url;
    a.download = "service-catalog-template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="!max-w-5xl sm:!max-w-5xl !w-[min(95vw,1080px)] sm:!w-[min(95vw,1080px)] max-h-[90vh] overflow-hidden flex flex-col !p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            {step === "upload" ? "Import dịch vụ từ Excel" : "Xem trước Import"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col gap-4 px-6 py-4 overflow-y-auto">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium mb-2">Hướng dẫn import</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>File định dạng <code>.xlsx</code> (max 5MB, ≤200 dòng/lần).</li>
                <li>7 cột: <strong>Tên dịch vụ</strong> (bắt buộc), <strong>Nhóm</strong> (bắt buộc), ĐVT, Giá tham khảo, Giá vốn, Mô tả, Thứ tự.</li>
                <li>Nhóm chấp nhận: <em>Tính giờ / Racekit / Vận hành / Chung</em> (hoặc TIMING/RACEKIT/OPERATIONS/GENERAL).</li>
                <li>Dịch vụ <strong>trùng tên + nhóm</strong> sẽ bỏ qua (skip).</li>
                <li>Dòng lỗi (thiếu tên/nhóm sai) sẽ báo cáo, KHÔNG block các dòng khác.</li>
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
              <label htmlFor="catalog-import-file" className="text-sm font-medium">
                File Excel
              </label>
              <input
                id="catalog-import-file"
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  Đã chọn: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

          </div>
        )}

        {step === "upload" && (
          <DialogFooter className="px-6 py-4 border-t shrink-0">
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
        )}

        {step === "preview" && preview && (
          <div className="flex flex-col gap-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                <CheckCircle2 className="mr-1 size-3" />
                {preview.valid.length} hợp lệ
              </Badge>
              {preview.duplicate.length > 0 && (
                <Badge variant="default" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
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
              <span className="text-muted-foreground">Tổng: {preview.total} dòng</span>
            </div>

            {/* Valid rows preview */}
            {preview.valid.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="border-b bg-emerald-50/50 px-3 py-2 text-sm font-medium text-emerald-700">
                  ✅ {preview.valid.length} dòng sẽ được thêm vào danh mục
                </div>
                <div className="max-h-[40vh] overflow-auto">
                  <Table className="table-fixed w-full">
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="min-w-[240px]">Tên dịch vụ</TableHead>
                        <TableHead className="w-[110px]">Nhóm</TableHead>
                        <TableHead className="w-[80px]">ĐVT</TableHead>
                        <TableHead className="text-right w-[140px]">Giá tham khảo</TableHead>
                        <TableHead className="text-right w-[140px]">Giá vốn</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.valid.map((row) => (
                        <TableRow key={`v-${row.rowNum}`}>
                          <TableCell className="text-muted-foreground">{row.rowNum}</TableCell>
                          <TableCell className="font-medium truncate" title={row.name}>{row.name}</TableCell>
                          <TableCell className="truncate">{CATEGORY_LABEL[row.category] ?? row.category}</TableCell>
                          <TableCell className="truncate">{row.unit ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtVnd(row.referencePrice)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtVnd(row.referenceCost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Duplicate rows */}
            {preview.duplicate.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="border-b bg-amber-50/50 px-3 py-2 text-sm font-medium text-amber-700">
                  ⚠️ {preview.duplicate.length} dòng trùng (đã tồn tại trong danh mục) — sẽ bỏ qua
                </div>
                <div className="max-h-[30vh] overflow-auto">
                  <Table className="table-fixed w-full">
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="min-w-[280px]">Tên dịch vụ</TableHead>
                        <TableHead className="w-[140px]">Nhóm</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.duplicate.map((row) => (
                        <TableRow key={`d-${row.rowNum}`}>
                          <TableCell className="text-muted-foreground">{row.rowNum}</TableCell>
                          <TableCell className="truncate" title={row.name}>{row.name}</TableCell>
                          <TableCell className="truncate">{CATEGORY_LABEL[row.category] ?? row.category}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Invalid rows */}
            {preview.invalid.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="border-b bg-red-50/50 px-3 py-2 text-sm font-medium text-red-700">
                  ❌ {preview.invalid.length} dòng lỗi — sẽ bỏ qua. Sửa file Excel + thử lại.
                </div>
                <div className="max-h-[30vh] overflow-auto">
                  <Table className="table-fixed w-full">
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="w-[280px]">Tên (raw)</TableHead>
                        <TableHead>Lỗi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.invalid.map((row) => {
                        const rawName = String((row.raw as { name?: unknown }).name ?? "—");
                        const errsJoined = row.errors.join("; ");
                        return (
                          <TableRow key={`i-${row.rowNum}`}>
                            <TableCell className="text-muted-foreground">{row.rowNum}</TableCell>
                            <TableCell className="font-mono text-xs truncate" title={rawName}>{rawName}</TableCell>
                            <TableCell className="text-xs text-red-700" title={errsJoined}>
                              <div className="line-clamp-2">{errsJoined}</div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && preview && (
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="ghost" onClick={() => setStep("upload")} disabled={loading}>
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
              Xác nhận thêm {preview.valid.length} dịch vụ
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
