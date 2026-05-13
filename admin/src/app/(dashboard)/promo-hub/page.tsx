"use client";

/**
 * FEATURE-027 — Promo Hub list page.
 *
 * RBAC: page-level Tier 2 `isAdmin` gate (F-029 pattern). Sidebar nav
 * cũng filter (requireRole: "admin") nên user staff không thấy menu.
 * Đây là defense-in-depth — backend `LogtoAdminGuard` mới là final say.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import "@/lib/api";
import {
  promoHubControllerList,
  promoHubControllerCreate,
  promoHubControllerDelete,
} from "@/lib/api-generated";
import type {
  PromoHubListItemDto,
  PromoHubListResponseDto,
} from "@/lib/api-generated";
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/confirm-dialog";
import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

type StatusFilter = "draft" | "published" | "archived" | "all";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<PromoHubListItemDto["status"], string> = {
  draft: "Nháp",
  published: "Đã đăng",
  archived: "Lưu trữ",
};

const STATUS_TONE: Record<PromoHubListItemDto["status"], string> = {
  draft: "text-muted-foreground",
  published: "text-emerald-700",
  archived: "text-amber-700",
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function PromoHubListPage() {
  // RBAC gate — Tier 2 admin-only (F-029 pattern, top of component BEFORE hooks state)
  const { isAdmin, isLoading: authLoading } = useAuth();

  const router = useRouter();
  const confirm = useConfirm();
  const [data, setData] = useState<PromoHubListResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounced(searchInput, 300);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await promoHubControllerList({
        query: {
          status: filterStatus,
          pageNo: page,
          pageSize: PAGE_SIZE,
          q: debouncedSearch.trim() || undefined,
        },
      });
      setData(res.data as PromoHubListResponseDto);
    } catch (err) {
      toast.error("Không tải được danh sách: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, page, debouncedSearch]);

  useEffect(() => {
    if (isAdmin) loadList();
  }, [loadList, isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, debouncedSearch]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const slug = `hub-${Date.now()}`;
      const res = await promoHubControllerCreate({
        body: {
          slug,
          title: "Trang quảng bá mới",
          status: "draft",
        },
      });
      const created = res.data as { id: string };
      router.push(`/promo-hub/${created.id}`);
    } catch (err) {
      const e = err as { body?: { message?: string }; message?: string };
      toast.error("Tạo trang thất bại: " + (e.body?.message ?? e.message));
      setCreating(false);
    }
  };

  const handleDelete = async (hub: PromoHubListItemDto) => {
    const ok = await confirm({
      title: "Xóa trang quảng bá?",
      description: `"${hub.title}" sẽ bị xóa. Hành động này không thể hoàn tác.`,
      confirmText: "Xóa",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await promoHubControllerDelete({ path: { id: hub.id } });
      // Cross-app revalidate — remove from sitemap + bust hub cache
      fetch("/api/revalidate-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: hub.slug }),
      }).catch(() => {
        /* silent */
      });
      toast.success("Đã xóa");
      await loadList();
    } catch (err) {
      toast.error("Xóa thất bại: " + (err as Error).message);
    }
  };

  const items = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const statsCards = useMemo(() => {
    const byStatus = items.reduce<Record<string, number>>((acc, h) => {
      acc[h.status] = (acc[h.status] ?? 0) + 1;
      return acc;
    }, {});
    return [
      { label: "Tổng số trang", value: total, accent: "text-foreground" },
      { label: "Đã đăng", value: byStatus.published ?? 0, accent: "text-emerald-700" },
      { label: "Nháp", value: byStatus.draft ?? 0, accent: "text-muted-foreground" },
      { label: "Lưu trữ", value: byStatus.archived ?? 0, accent: "text-amber-700" },
    ];
  }, [items, total]);

  if (authLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <RestrictedAccess message="Trang quảng bá chỉ dành cho quản trị viên (admin). Liên hệ team Marketing nếu cần truy cập." />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Nội dung</span>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-foreground">Trang quảng bá</span>
          </div>
          <h1 className="font-[var(--font-heading)] text-3xl font-black tracking-tight">
            <Sparkles className="mr-2 inline-block size-7 align-middle text-[var(--admin-blue)]" />
            Trang quảng bá
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tạo landing page tiếp thị tại <code className="font-mono text-xs">5bib.com/hub/&lt;slug&gt;</code> — drag-and-drop section, không cần dev.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => loadList()}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            Làm mới
          </Button>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            <Plus className="size-4" />
            {creating ? "Đang tạo..." : "Tạo trang mới"}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 shadow-xs">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
            <div className={`mt-2 font-mono text-3xl font-bold leading-none tracking-tight ${s.accent}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tiêu đề hoặc slug…"
            className="h-9 pl-9"
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(v) => v && setFilterStatus(v as StatusFilter)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="published">🟢 Đã đăng</SelectItem>
            <SelectItem value="draft">⬜ Nháp</SelectItem>
            <SelectItem value="archived">📦 Lưu trữ</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          Hiển thị <b className="text-foreground">{items.length}</b> / {total} trang
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] uppercase tracking-wider">Tiêu đề / Slug</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Trạng thái</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Sections</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Views 7d</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Cập nhật</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-12 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  <Sparkles className="mx-auto mb-2 size-8 opacity-30" />
                  <div className="text-sm font-medium">Chưa có trang quảng bá nào</div>
                  <div className="text-xs">Bấm "Tạo trang mới" để bắt đầu.</div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((h) => (
                <TableRow key={h.id} className="group">
                  <TableCell className="max-w-[400px]">
                    <button
                      type="button"
                      onClick={() => router.push(`/promo-hub/${h.id}`)}
                      className="block w-full text-left hover:opacity-80"
                    >
                      <div className="truncate font-semibold">{h.title}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        /hub/{h.slug}
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${STATUS_TONE[h.status]}`}>
                      <span className="size-2 rounded-full bg-current" />
                      {STATUS_LABEL[h.status]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {h.sectionCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {h.views7d.toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(h.updatedAt).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/promo-hub/${h.id}`)}
                        aria-label="Sửa"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {h.status === "published" && (
                        <a
                          href={`https://5bib.com/hub/${h.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-grid size-8 place-items-center rounded-md text-foreground/70 hover:bg-accent hover:text-foreground"
                          aria-label="Xem trang public"
                        >
                          <Eye className="size-3.5" />
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(h)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Xóa"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              Trang {page} / {totalPages} · Tổng {total} trang
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Trang trước"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Trang sau"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
