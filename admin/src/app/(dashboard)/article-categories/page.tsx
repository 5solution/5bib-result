"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import "@/lib/api";
import {
  articleCategoriesAdminControllerList,
  articleCategoriesAdminControllerCreate,
  articleCategoriesAdminControllerUpdate,
  articleCategoriesAdminControllerRemove,
  articleCategoriesAdminControllerReorder,
} from "@/lib/api-generated";
import type {
  ArticleCategoryResponseDto,
  CreateArticleCategoryDto,
  UpdateArticleCategoryDto,
} from "@/lib/api-generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/confirm-dialog";
import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  Tags,
  ChevronRight,
} from "lucide-react";

type CategoryType = "help" | "news" | "both";

interface FormState {
  id: string | null;
  name: string;
  slug: string;
  type: CategoryType;
  icon: string;
  tint: string;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  slug: "",
  type: "both",
  icon: "📁",
  tint: "#1D49FF",
  description: "",
  isActive: true,
};

const TYPE_LABEL: Record<CategoryType, string> = {
  help: "📖 Hướng dẫn",
  news: "📰 Tin tức",
  both: "🌐 Cả hai",
};

export default function ArticleCategoriesPage() {
  const [items, setItems] = useState<ArticleCategoryResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await articleCategoriesAdminControllerList();
      const list = (res.data ?? []) as ArticleCategoryResponseDto[];
      setItems(list);
    } catch (err) {
      toast.error("Không tải được danh mục: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (cat: ArticleCategoryResponseDto) => {
    setForm({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      type: cat.type,
      icon: cat.icon,
      tint: cat.tint,
      description: cat.description,
      isActive: cat.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Tên danh mục không được trống");
      return;
    }
    setSubmitting(true);
    try {
      if (form.id) {
        const body: UpdateArticleCategoryDto = {
          name: form.name,
          slug: form.slug || undefined,
          type: form.type,
          icon: form.icon,
          tint: form.tint,
          description: form.description,
          isActive: form.isActive,
        };
        await articleCategoriesAdminControllerUpdate({
          path: { id: form.id },
          body,
        });
        toast.success("Đã cập nhật danh mục");
      } else {
        const body: CreateArticleCategoryDto = {
          name: form.name,
          slug: form.slug || undefined,
          type: form.type,
          icon: form.icon,
          tint: form.tint,
          description: form.description,
          isActive: form.isActive,
        };
        await articleCategoriesAdminControllerCreate({ body });
        toast.success("Đã tạo danh mục mới");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      const e = err as { body?: { message?: string }; message?: string };
      toast.error(e.body?.message ?? e.message ?? "Lưu thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat: ArticleCategoryResponseDto) => {
    const ok = await confirm({
      title: "Xóa danh mục?",
      description: `"${cat.name}" sẽ bị xóa vĩnh viễn. Nếu còn bài viết dùng category này, thao tác sẽ bị chặn.`,
      confirmText: "Xóa",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await articleCategoriesAdminControllerRemove({ path: { id: cat.id } });
      toast.success("Đã xóa danh mục");
      await load();
    } catch (err) {
      const e = err as { body?: { message?: string }; status?: number };
      if (e.status === 409 || e.body?.message?.includes("đang được sử dụng")) {
        toast.error(e.body?.message ?? "Danh mục đang được dùng bởi bài viết — reassign trước");
      } else {
        toast.error("Xóa thất bại: " + (e.body?.message ?? "lỗi không xác định"));
      }
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    // Optimistic
    setItems(next);
    try {
      await articleCategoriesAdminControllerReorder({
        body: {
          items: next.map((c, i) => ({ id: c.id, order: i })),
        },
      });
    } catch (err) {
      toast.error("Đổi thứ tự thất bại: " + (err as Error).message);
      await load(); // restore from server
    }
  };

  const renderRows = () => {
    if (loading) {
      return Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell colSpan={7}>
            <Skeleton className="h-10 w-full" />
          </TableCell>
        </TableRow>
      ));
    }
    if (items.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
            <Tags className="mx-auto mb-2 size-8 opacity-30" />
            <div className="text-sm font-medium">Chưa có danh mục nào</div>
            <div className="text-xs">Tạo danh mục đầu tiên để gán cho bài viết</div>
          </TableCell>
        </TableRow>
      );
    }
    return items.map((cat, idx) => (
      <TableRow key={cat.id} className="group">
        <TableCell className="w-[80px]">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-20"
              aria-label="Move up"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={idx === items.length - 1}
              className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-20"
              aria-label="Move down"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <div
              className="grid size-10 shrink-0 place-items-center rounded-lg text-lg text-white"
              style={{ background: cat.tint }}
            >
              {cat.icon}
            </div>
            <div className="min-w-0">
              <div className="font-semibold">{cat.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">/{cat.slug}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="font-medium">
            {TYPE_LABEL[cat.type]}
          </Badge>
        </TableCell>
        <TableCell className="max-w-[280px] text-sm text-muted-foreground">
          <div className="truncate">{cat.description || "—"}</div>
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5 font-mono font-bold tabular-nums">
            {cat.articleCount}
          </span>
        </TableCell>
        <TableCell>
          {cat.isActive ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-700" /> Hoạt động
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground" /> Ẩn
            </span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="inline-flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(cat)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Nội dung</span>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-foreground">Danh mục bài viết</span>
          </div>
          <h1 className="font-[var(--font-heading)] text-3xl font-black tracking-tight">
            <span className="mr-2">📂</span>
            Danh mục bài viết
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Quản lý danh mục dùng cho hero grid trên hotro.5bib.com / news.5bib.com.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          Tạo danh mục
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[80px] text-[11px] uppercase tracking-wider">
                Order
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Danh mục</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Loại</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Mô tả</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Bài viết</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Trạng thái</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{form.id ? "Sửa danh mục" : "Tạo danh mục mới"}</DialogTitle>
              <DialogDescription>
                Danh mục dùng cho hero grid trên trang public và dropdown trong editor.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cat-name">Tên *</Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Đăng ký giải"
                  required
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cat-slug">
                  Slug{" "}
                  <span className="font-normal text-muted-foreground">
                    (auto từ tên nếu để trống)
                  </span>
                </Label>
                <Input
                  id="cat-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="dang-ky-giai"
                  pattern="^[a-z0-9-]+$"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Loại hiển thị</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as CategoryType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="help">📖 Hướng dẫn (hotro)</SelectItem>
                    <SelectItem value="news">📰 Tin tức (news)</SelectItem>
                    <SelectItem value="both">🌐 Cả hai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-icon">Icon (emoji)</Label>
                <Input
                  id="cat-icon"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="📖"
                  maxLength={4}
                  className="text-center text-lg"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cat-tint">Màu (hex)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={form.tint}
                    onChange={(e) => setForm((f) => ({ ...f, tint: e.target.value }))}
                    className="size-10 shrink-0 cursor-pointer p-1"
                  />
                  <Input
                    id="cat-tint"
                    value={form.tint}
                    onChange={(e) => setForm((f) => ({ ...f, tint: e.target.value }))}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    placeholder="#1D49FF"
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cat-desc">
                  Mô tả ngắn{" "}
                  <span className="font-normal text-muted-foreground">
                    ({form.description.length}/160)
                  </span>
                </Label>
                <Textarea
                  id="cat-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value.slice(0, 160) }))
                  }
                  placeholder="Hướng dẫn đăng ký giải chạy"
                  rows={2}
                />
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                <Label htmlFor="cat-active" className="cursor-pointer">
                  Hoạt động (hiển thị trên public site)
                </Label>
                <Switch
                  id="cat-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Đang lưu..." : form.id ? "Cập nhật" : "Tạo mới"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
