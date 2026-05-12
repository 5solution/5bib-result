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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { SearchInput } from "./search-input";
import { EmptyState } from "./empty-state";
import { useConfirm } from "@/components/confirm-dialog";
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
  referenceCost: 0,
  description: "",
  sortOrder: 0,
};

export function ServiceCatalogTable() {
  const confirm = useConfirm();
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
    const ok = await confirm({
      title: "Xoá dịch vụ?",
      description: `Xoá "${it.name}" khỏi danh mục? Các hợp đồng đã reference vẫn giữ snapshot, không bị ảnh hưởng.`,
      confirmText: "Xoá",
      variant: "destructive",
    });
    if (!ok) return;
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
        <div className="min-w-64 flex-1 sm:max-w-sm">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm tên dịch vụ"
            ariaLabel="Tìm dịch vụ"
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
              <TableHead className="text-right">Giá vốn</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <EmptyState
                    icon={Package}
                    title="Chưa có dịch vụ nào"
                    description={
                      q || category !== "ALL"
                        ? "Không khớp filter — thử bỏ filter / từ khoá."
                        : 'Thêm dịch vụ đầu tiên để dùng làm reference khi tạo HĐ.'
                    }
                  />
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
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {it.referenceCost == null
                      ? "—"
                      : formatVND(it.referenceCost)}
                  </TableCell>
                  <TableCell
                    className="max-w-md truncate"
                    title={it.description || undefined}
                  >
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
  const confirm = useConfirm();
  const [form, setForm] = useState<CreateServiceCatalogInput>(
    initial
      ? {
          name: initial.name,
          category: initial.category,
          unit: initial.unit ?? "",
          referencePrice: initial.referencePrice ?? 0,
          referenceCost: initial.referenceCost ?? 0,
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
    // UX-26: warning nếu price = 0 → admin phải gõ tay khi pick từ catalog.
    if (!form.referencePrice || form.referencePrice === 0) {
      const ok = await confirm({
        title: "Lưu với giá tham khảo = 0?",
        description:
          "Admin sẽ phải gõ giá tay mỗi lần pick item này từ catalog vào HĐ. Bạn có chắc?",
        confirmText: "Lưu",
      });
      if (!ok) return;
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-price">Giá tham khảo (VND)</Label>
          <MoneyInput
            id="sc-price"
            value={(form.referencePrice as number | undefined) ?? 0}
            onChange={(v) => set("referencePrice", v)}
            placeholder="Nhập số (vd 15000000)"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Giá BÁN — auto-fill khi pick item vào HĐ
          </p>
        </div>
        <div>
          <Label htmlFor="sc-cost">Giá vốn (VND)</Label>
          <MoneyInput
            id="sc-cost"
            value={(form.referenceCost as number | undefined) ?? 0}
            onChange={(v) => set("referenceCost", v)}
            placeholder="Nhập số (vd 6000000)"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Giá VỐN — pre-fill P&L cost item (có thể override khi tạo HĐ)
          </p>
        </div>
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
