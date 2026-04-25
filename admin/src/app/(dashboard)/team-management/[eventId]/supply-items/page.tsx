"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listSupplyItems,
  createSupplyItem,
  updateSupplyItem,
  deleteSupplyItem,
  listTeamRoles,
  downloadSupplyItemsTemplate,
  importSupplyItems,
  type CreateSupplyItemInput,
  type ImportSupplyItemsResult,
  type SupplyItem,
  type TeamRole,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package, Upload, Download } from "lucide-react";
import { toast } from "sonner";

export default function SupplyItemsPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [items, setItems] = useState<SupplyItem[] | null>(null);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SupplyItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [i, r] = await Promise.all([
        listSupplyItems(token, eventId),
        listTeamRoles(token, eventId),
      ]);
      setItems(i);
      setRoles(r);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const roleName = (roleId: number | null): string => {
    if (!roleId) return "Admin";
    const r = roles.find((rr) => rr.id === roleId);
    return r?.role_name ?? `Role #${roleId}`;
  };

  async function handleDelete(item: SupplyItem): Promise<void> {
    if (!token) return;
    if (!confirm(`Xóa vật tư "${item.item_name}"? Không thể hoàn tác.`))
      return;
    try {
      await deleteSupplyItem(token, item.id);
      toast.success("Đã xóa vật tư");
      await load();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes("conflict") || msg.includes("409")) {
        toast.error("Vật tư đang dùng — không thể xóa");
      } else {
        toast.error(msg);
      }
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-gradient flex items-center gap-2">
          <Package className="size-6 sm:size-7 text-blue-600" /> Vật Tư Sự Kiện
        </h1>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 size-4" /> Import XLSX/CSV
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" /> Thêm vật tư
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Vật tư dùng chung cho tất cả team. Admin hoặc Leader tự tạo khi cần.
      </p>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {items === null ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Package className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">
            Chưa có vật tư nào. Thêm vật tư đầu tiên.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" /> Thêm vật tư
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">STT</TableHead>
                  <TableHead>Tên vật tư</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Chủ quản</TableHead>
                  <TableHead className="w-20">Sort</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={it.id} className="result-row-hover">
                    <TableCell className="text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {it.item_name}
                    </TableCell>
                    <TableCell>{it.unit}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {roleName(it.created_by_role_id)}
                    </TableCell>
                    <TableCell>{it.sort_order}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditTarget(it)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDelete(it)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {items.map((it, idx) => (
              <div
                key={it.id}
                className="rounded-lg border bg-white p-3 flex items-start gap-3"
              >
                <span className="text-xs text-muted-foreground mt-1">
                  #{idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{it.item_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Đơn vị: <b>{it.unit}</b> · Chủ quản:{" "}
                    {roleName(it.created_by_role_id)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setEditTarget(it)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void handleDelete(it)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SupplyItemDialog
        open={createOpen || editTarget != null}
        target={editTarget}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        eventId={eventId}
        onSaved={() => {
          setCreateOpen(false);
          setEditTarget(null);
          void load();
        }}
      />

      <ImportSupplyItemsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        eventId={eventId}
        onDone={() => void load()}
      />
    </div>
  );
}

function SupplyItemDialog({
  open,
  target,
  onOpenChange,
  eventId,
  onSaved,
}: {
  open: boolean;
  target: SupplyItem | null;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  onSaved: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [form, setForm] = useState<CreateSupplyItemInput>({
    item_name: "",
    unit: "",
    sort_order: 0,
    created_by_role_id: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({
        item_name: target.item_name,
        unit: target.unit,
        sort_order: target.sort_order,
        created_by_role_id: target.created_by_role_id,
      });
    } else {
      setForm({
        item_name: "",
        unit: "",
        sort_order: 0,
        created_by_role_id: null,
      });
    }
  }, [open, target]);

  async function handleSubmit(): Promise<void> {
    if (!token) return;
    if (!form.item_name.trim() || !form.unit.trim()) {
      toast.error("Tên vật tư và đơn vị bắt buộc");
      return;
    }
    setSaving(true);
    try {
      if (target) {
        await updateSupplyItem(token, target.id, form);
        toast.success("Đã cập nhật vật tư");
      } else {
        await createSupplyItem(token, eventId, form);
        toast.success("Đã thêm vật tư");
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target ? `Sửa vật tư — ${target.item_name}` : "Thêm vật tư"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên vật tư *</Label>
            <Input
              placeholder="VD: Nước ly, Chuối, Gel"
              value={form.item_name}
              onChange={(e) => setForm({ ...form, item_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Đơn vị *</Label>
            <Input
              placeholder="VD: ly, quả, gói, chai"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
          <div>
            <Label>Thứ tự hiển thị</Label>
            <Input
              type="number"
              value={form.sort_order ?? 0}
              onChange={(e) =>
                setForm({ ...form, sort_order: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {saving ? "Đang lưu..." : target ? "Lưu" : "Thêm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Import dialog ────────────────────────────────────────────

function ImportSupplyItemsDialog({
  open,
  onOpenChange,
  eventId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  onDone: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSupplyItemsResult | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setResult(null);
    }
  }, [open]);

  async function handleDownloadTemplate(): Promise<void> {
    if (!token) return;
    try {
      const blob = await downloadSupplyItemsTemplate(token, eventId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supply-items-template-event${eventId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleImport(): Promise<void> {
    if (!token || !file) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await importSupplyItems(token, eventId, file);
      setResult(res);
      if (res.inserted > 0) {
        toast.success(
          `Import thành công: ${res.inserted} vật tư mới${res.skipped ? `, bỏ qua ${res.skipped}` : ""}`,
        );
        onDone();
      } else {
        toast.info(
          `Không có vật tư nào được thêm. Bỏ qua: ${res.skipped}, Lỗi: ${res.errors}`,
        );
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" /> Import vật tư từ file
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Step 1: Download template */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="font-medium text-gray-800">
              Bước 1 — Tải file mẫu
            </p>
            <p className="text-xs text-gray-500">
              File XLSX có 2 cột: <code className="bg-gray-100 px-1 rounded">item_name</code> và{" "}
              <code className="bg-gray-100 px-1 rounded">unit</code>. Điền vào rồi upload lại.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleDownloadTemplate()}
            >
              <Download className="mr-2 size-3.5" />
              Tải file mẫu (.xlsx)
            </Button>
          </div>

          {/* Step 2: Upload */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="font-medium text-gray-800">
              Bước 2 — Chọn file để import
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
            <p className="text-xs text-gray-400">
              Hỗ trợ .xlsx, .xls, .csv. Tối đa 500 dòng.
            </p>
          </div>

          {/* Result summary */}
          {result ? (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="font-medium text-gray-800">Kết quả import:</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div
                  className="rounded-lg p-2"
                  style={{ background: "#dcfce7" }}
                >
                  <p className="text-lg font-bold text-green-700">
                    {result.inserted}
                  </p>
                  <p className="text-xs text-green-600">Đã thêm</p>
                </div>
                <div
                  className="rounded-lg p-2"
                  style={{ background: "#fef9c3" }}
                >
                  <p className="text-lg font-bold text-yellow-700">
                    {result.skipped}
                  </p>
                  <p className="text-xs text-yellow-600">Bỏ qua</p>
                </div>
                <div
                  className="rounded-lg p-2"
                  style={{ background: "#fee2e2" }}
                >
                  <p className="text-lg font-bold text-red-700">
                    {result.errors}
                  </p>
                  <p className="text-xs text-red-600">Lỗi</p>
                </div>
              </div>
              {result.rows_errors.length > 0 ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-red-600 font-medium">
                    Chi tiết lỗi ({result.rows_errors.length})
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-gray-600">
                    {result.rows_errors.map((e) => (
                      <li key={e.row}>
                        Dòng {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {result.rows_skipped.length > 0 ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-yellow-600 font-medium">
                    Dòng bỏ qua ({result.rows_skipped.length})
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-gray-600">
                    {result.rows_skipped.map((s) => (
                      <li key={`${s.row}-${s.item_name}`}>
                        Dòng {s.row}: {s.item_name} — {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            disabled={!file || importing}
            onClick={() => void handleImport()}
          >
            {importing ? "Đang import..." : "Bắt đầu import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
