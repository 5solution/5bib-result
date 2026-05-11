"use client";

/**
 * F-024 Service Catalog Table — CRUD table for danh mục dịch vụ (BR-CM-16).
 *
 * Soft delete server-side — items đã reference trong contract vẫn snapshot
 * line items, không ảnh hưởng.
 */
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  createServiceCatalogItem,
  deleteServiceCatalogItem,
  formatVND,
  listServiceCatalog,
  updateServiceCatalogItem,
  type CreateServiceCatalogInput,
  type ServiceCatalogItem,
  type ServiceCategory,
} from "@/lib/contracts-api";
import { MoneyInput } from "./money-input";

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  TIMING: "Tính giờ",
  RACEKIT: "Racekit",
  OPERATIONS: "Vận hành",
  GENERAL: "Chung",
};

const BLANK: CreateServiceCatalogInput = {
  name: "",
  category: "GENERAL",
  unit: "",
  referencePrice: 0,
  description: "",
  sortOrder: 0,
};

export function ServiceCatalogTable() {
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ServiceCategory | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCatalogItem | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await listServiceCatalog({
        category: category === "ALL" ? undefined : category,
        q: q.trim() || undefined,
      });
      setItems(res);
    } catch (err) {
      toast.error(`Không tải được: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, q]);

  async function handleDelete(it: ServiceCatalogItem) {
    if (!confirm(`Xoá "${it.name}"?`)) return;
    try {
      await deleteServiceCatalogItem(it._id);
      toast.success("Đã xoá");
      load();
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Danh mục dịch vụ</h1>
        <Dialog
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger
            render={<Button onClick={() => setEditing(null)} />}
          >
            <Plus className="size-4" /> Thêm dịch vụ
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Sửa dịch vụ" : "Thêm dịch vụ"}
              </DialogTitle>
            </DialogHeader>
            <CatalogForm
              initial={editing}
              onSaved={() => {
                setEditOpen(false);
                setEditing(null);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên dịch vụ"
            className="pl-8"
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as ServiceCategory | "ALL")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả nhóm</SelectItem>
            <SelectItem value="TIMING">Tính giờ</SelectItem>
            <SelectItem value="RACEKIT">Racekit</SelectItem>
            <SelectItem value="OPERATIONS">Vận hành</SelectItem>
            <SelectItem value="GENERAL">Chung</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên dịch vụ</TableHead>
              <TableHead>Nhóm</TableHead>
              <TableHead>ĐVT</TableHead>
              <TableHead className="text-right">Giá tham khảo</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-[var(--text-muted,#78716C)]"
                >
                  Chưa có dịch vụ nào trong danh mục
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((it) => (
                <TableRow key={it._id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CATEGORY_LABEL[it.category]}
                    </Badge>
                  </TableCell>
                  <TableCell>{it.unit || "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatVND(it.referencePrice ?? 0)}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {it.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(it);
                        setEditOpen(true);
                      }}
                      aria-label={`Sửa ${it.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(it)}
                      aria-label={`Xoá ${it.name}`}
                    >
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CatalogForm({
  initial,
  onSaved,
}: {
  initial: ServiceCatalogItem | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateServiceCatalogInput>(
    initial
      ? {
          name: initial.name,
          category: initial.category,
          unit: initial.unit ?? "",
          referencePrice: initial.referencePrice ?? 0,
          description: initial.description ?? "",
          sortOrder: initial.sortOrder ?? 0,
        }
      : BLANK,
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CreateServiceCatalogInput>(
    k: K,
    v: CreateServiceCatalogInput[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Tên dịch vụ bắt buộc");
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await updateServiceCatalogItem(initial._id, form);
        toast.success("Đã cập nhật");
      } else {
        await createServiceCatalogItem(form);
        toast.success("Đã tạo");
      }
      onSaved();
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="sc-name">Tên dịch vụ *</Label>
        <Input
          id="sc-name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sc-cat">Nhóm</Label>
          <Select
            value={form.category}
            onValueChange={(v) => set("category", v as ServiceCategory)}
          >
            <SelectTrigger id="sc-cat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TIMING">Tính giờ</SelectItem>
              <SelectItem value="RACEKIT">Racekit</SelectItem>
              <SelectItem value="OPERATIONS">Vận hành</SelectItem>
              <SelectItem value="GENERAL">Chung</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="sc-unit">ĐVT</Label>
          <Input
            id="sc-unit"
            value={form.unit ?? ""}
            onChange={(e) => set("unit", e.target.value)}
            placeholder="VĐV / Bộ / Cái..."
          />
        </div>
      </div>
      <div>
        <Label htmlFor="sc-price">Giá tham khảo (VND)</Label>
        <MoneyInput
          id="sc-price"
          value={(form.referencePrice as number | undefined) ?? 0}
          onChange={(v) => set("referencePrice", v)}
          placeholder="vd: 15.000.000"
        />
      </div>
      <div>
        <Label htmlFor="sc-desc">Mô tả</Label>
        <Textarea
          id="sc-desc"
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving || !form.name.trim()}>
          {saving ? "Đang lưu..." : initial ? "Cập nhật" : "Tạo"}
        </Button>
      </DialogFooter>
    </div>
  );
}
