"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileUp,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  downloadRegistrationTemplate,
  previewRegistrationImport,
  confirmRegistrationImport,
  type ImportRegistrationsPreviewResponse,
  type ImportRegistrationsPreviewRow,
} from "@/lib/team-api";

type Stage = "upload" | "preview" | "submitting";
type FilterTab = "all" | "valid" | "errors" | "duplicate";

interface RegistrationImportDialogProps {
  eventId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

export function RegistrationImportDialog({
  eventId,
  open,
  onOpenChange,
  onDone,
}: RegistrationImportDialogProps): React.ReactElement {
  const { token } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportRegistrationsPreviewResponse | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");

  const reset = useCallback(() => {
    setStage("upload");
    setFile(null);
    setPreview(null);
    setUploading(false);
    setConfirming(false);
    setAutoApprove(false);
    setFilter("all");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  function handleOpenChange(next: boolean): void {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleTemplate(): Promise<void> {
    if (!token) return;
    try {
      await downloadRegistrationTemplate(token, eventId);
      toast.success("Đã tải template");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleUpload(): Promise<void> {
    if (!token || !file) return;
    setUploading(true);
    try {
      const res = await previewRegistrationImport(token, eventId, file);
      setPreview(res);
      setStage("preview");
      if (res.valid_count === 0) {
        toast.warning(
          `Tất cả ${res.total_rows} dòng đều không hợp lệ — xem chi tiết bên dưới`,
        );
      } else {
        toast.success(
          `Đọc được ${res.total_rows} dòng — ${res.valid_count} hợp lệ`,
        );
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!token || !preview) return;
    if (preview.valid_count === 0) {
      toast.error("Không có dòng hợp lệ để import");
      return;
    }
    setConfirming(true);
    try {
      const res = await confirmRegistrationImport(
        token,
        eventId,
        preview.import_token,
        { auto_approve: autoApprove, skip_invalid: true },
      );
      const msgParts = [
        `Đã import ${res.inserted} nhân sự`,
        res.skipped > 0 ? `bỏ qua ${res.skipped}` : null,
        res.errors.length > 0 ? `${res.errors.length} lỗi` : null,
      ].filter(Boolean);
      toast.success(msgParts.join(" · "));
      if (res.errors.length > 0) {
        // Log first few for debugging — full list shown in console.
        // eslint-disable-next-line no-console
        console.warn("Import errors:", res.errors);
      }
      onDone();
      reset();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    if (filter === "all") return preview.rows;
    if (filter === "valid") return preview.rows.filter((r) => r.valid);
    if (filter === "errors")
      return preview.rows.filter((r) => r.errors.length > 0);
    if (filter === "duplicate")
      return preview.rows.filter(
        (r) => r.duplicate_kind === "in_file" || r.duplicate_kind === "in_db",
      );
    return preview.rows;
  }, [preview, filter]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-5xl overflow-y-auto p-0"
      >
        <div className="p-4 pb-2">
          <SheetHeader>
            <SheetTitle>Import nhân sự từ Excel</SheetTitle>
            <SheetDescription>
              Tải template, điền thông tin đăng ký + vai trò, rồi upload để
              hệ thống kiểm tra trước khi chèn vào database.
            </SheetDescription>
          </SheetHeader>
        </div>

        {stage === "upload" ? (
          <div className="space-y-4 p-4 pt-0">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <h3 className="font-medium text-sm">Bước 1 — Tải template</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  File XLSX có sẵn các cột đăng ký, dropdown role_id / shirt_size /
                  bank_name và 2 sheet phụ Roles + Banks để tra cứu.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void handleTemplate();
                }}
              >
                <Download className="mr-2 size-4" /> Tải template
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <h3 className="font-medium text-sm">Bước 2 — Upload file</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Chấp nhận .xlsx hoặc .csv, tối đa 500 dòng / 2MB.
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                }}
                className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-xs hover:file:bg-primary/90"
              />
              {file ? (
                <p className="text-xs text-muted-foreground">
                  Đã chọn: <span className="font-medium">{file.name}</span> (
                  {(file.size / 1024).toFixed(1)} KB)
                </p>
              ) : null}
              <Button
                size="sm"
                onClick={() => {
                  void handleUpload();
                }}
                disabled={!file || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Đang kiểm tra…
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 size-4" /> Tải và kiểm tra
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {stage === "preview" && preview ? (
          <div className="space-y-3 p-4 pt-0">
            {/* Summary */}
            <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <SummaryBadge label="Tổng" value={preview.total_rows} />
              <SummaryBadge
                label="Hợp lệ"
                value={preview.valid_count}
                tone="green"
              />
              <SummaryBadge
                label="Lỗi"
                value={preview.invalid_count}
                tone={preview.invalid_count > 0 ? "red" : "neutral"}
              />
              <SummaryBadge
                label="Trùng trong file"
                value={preview.duplicate_in_file}
                tone={preview.duplicate_in_file > 0 ? "amber" : "neutral"}
              />
              <SummaryBadge
                label="Trùng DB"
                value={preview.duplicate_in_db}
                tone={preview.duplicate_in_db > 0 ? "amber" : "neutral"}
              />
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {(
                [
                  { k: "all", label: `Tất cả (${preview.total_rows})` },
                  { k: "valid", label: `Hợp lệ (${preview.valid_count})` },
                  {
                    k: "errors",
                    label: `Lỗi (${preview.rows.filter((r) => r.errors.length > 0).length})`,
                  },
                  {
                    k: "duplicate",
                    label: `Trùng (${preview.duplicate_in_file + preview.duplicate_in_db})`,
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.k}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.k}
                  onClick={() => setFilter(t.k as FilterTab)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filter === t.k
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Preview table */}
            <div className="rounded-lg border max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Dòng</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-6"
                      >
                        Không có dòng nào khớp bộ lọc
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => <PreviewRow key={r.row_num} row={r} />)
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Options + action */}
            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <Label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={autoApprove}
                    onCheckedChange={setAutoApprove}
                  />
                  <span>
                    Tự động duyệt (auto_approve) — gửi email hợp đồng ngay
                  </span>
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1 ml-10">
                  TẮT: các dòng vào trạng thái <em>pending_approval</em>. BẬT:
                  <em> approved</em> + contract email ngay.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={confirming}
                >
                  Huỷ
                </Button>
                <Button
                  onClick={() => {
                    void handleConfirm();
                  }}
                  disabled={confirming || preview.valid_count === 0}
                >
                  {confirming ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Đang import…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 size-4" />
                      Import {preview.valid_count} dòng hợp lệ
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PreviewRow({
  row,
}: {
  row: ImportRegistrationsPreviewRow;
}): React.ReactElement {
  const dupLabel =
    row.duplicate_kind === "in_file"
      ? "Trùng trong file"
      : row.duplicate_kind === "in_db"
        ? "Trùng trong DB"
        : null;
  const style: React.CSSProperties | undefined = !row.valid
    ? row.errors.length > 0
      ? { background: "#fef2f2" }
      : { background: "#fffbeb" }
    : undefined;

  return (
    <TableRow style={style} data-valid={row.valid}>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {row.row_num}
      </TableCell>
      <TableCell className="font-medium">
        {String(row.data.full_name ?? "—")}
      </TableCell>
      <TableCell className="text-xs">
        {String(row.data.email ?? "—")}
      </TableCell>
      <TableCell className="text-xs font-mono">
        {String(row.data.phone ?? "—")}
      </TableCell>
      <TableCell className="text-xs">
        {row.resolved_role_id ? (
          <>
            #{row.resolved_role_id}
            {row.data.role_name ? ` · ${String(row.data.role_name)}` : null}
          </>
        ) : (
          <span className="text-red-600">—</span>
        )}
      </TableCell>
      <TableCell>
        {row.valid ? (
          <span className="inline-flex items-center gap-1 text-green-700 text-xs">
            <CheckCircle2 className="size-3.5" /> Hợp lệ
          </span>
        ) : dupLabel ? (
          <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
            <AlertTriangle className="size-3.5" /> {dupLabel}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-red-700 text-xs">
            <X className="size-3.5" /> Lỗi
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          {row.errors.map((e, i) => (
            <span
              key={`e-${i}`}
              className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800 w-fit"
            >
              {e}
            </span>
          ))}
          {row.warnings.map((w, i) => (
            <span
              key={`w-${i}`}
              className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 w-fit"
            >
              {w}
            </span>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function SummaryBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "red" | "amber" | "neutral";
}): React.ReactElement {
  const palette: Record<string, { bg: string; text: string }> = {
    green: { bg: "#dcfce7", text: "#14532d" },
    red: { bg: "#fee2e2", text: "#7f1d1d" },
    amber: { bg: "#fef3c7", text: "#78350f" },
    neutral: { bg: "#f3f4f6", text: "#111827" },
  };
  const p = palette[tone ?? "neutral"];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: p.bg, color: p.text }}
    >
      <span className="text-[10px] uppercase tracking-wide opacity-70">
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}

