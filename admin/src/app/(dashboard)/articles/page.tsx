"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import "@/lib/api";
import {
  articlesAdminControllerList,
  articlesAdminControllerStats,
  articlesAdminControllerCreate,
  articlesAdminControllerRemove,
} from "@/lib/api-generated";
import type {
  ArticleAdminDto,
  ArticleStatsDto,
  PaginatedAdminArticlesDto,
} from "@/lib/api-generated";
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
  FileText,
  TrendingUp,
} from "lucide-react";

type StatusFilter = "draft" | "published" | "all";
type TypeFilter = "news" | "help" | "all";

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ArticlesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [stats, setStats] = useState<ArticleStatsDto | null>(null);
  const [data, setData] = useState<PaginatedAdminArticlesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);

  const [filterType, setFilterType] = useState<TypeFilter>("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounced(searchInput, 300);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await articlesAdminControllerList({
        query: {
          type: filterType === "all" ? undefined : filterType,
          status: filterStatus,
          product: filterProduct === "all" ? undefined : (filterProduct as "5bib" | "5sport" | "5ticket" | "5pix" | "all"),
          q: debouncedSearch.trim() || undefined,
          page,
          limit: PAGE_SIZE,
        },
      });
      setData(res.data as PaginatedAdminArticlesDto);
    } catch (err) {
      toast.error("Không tải được bài viết: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, filterProduct, debouncedSearch, page]);

  const loadStats = useCallback(async () => {
    try {
      const res = await articlesAdminControllerStats();
      setStats(res.data as ArticleStatsDto);
    } catch {
      /* silent — stats are optional */
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [filterType, filterStatus, filterProduct, debouncedSearch]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await articlesAdminControllerCreate({
        body: {
          title: "Bài viết mới",
          type: "help",
          products: ["5bib"],
        },
      });
      const created = res.data as ArticleAdminDto;
      router.push(`/articles/${created.id}/edit`);
    } catch (err) {
      const e = err as { body?: { message?: string }; message?: string };
      toast.error("Tạo nháp thất bại: " + (e.body?.message ?? e.message));
      setCreating(false);
    }
  };

  const handleDelete = async (article: ArticleAdminDto) => {
    const ok = await confirm({
      title: "Xóa bài viết?",
      description: `"${article.title}" sẽ bị xóa mềm. Có thể restore lại sau.`,
      confirmText: "Xóa",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await articlesAdminControllerRemove({ path: { id: article.id } });
      toast.success("Đã xóa bài viết");
      await Promise.all([loadList(), loadStats()]);
    } catch (err) {
      toast.error("Xóa thất bại: " + (err as Error).message);
    }
  };

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const statsCards = useMemo(
    () => [
      {
        label: "Tổng số bài",
        value: stats?.total ?? "—",
        sub: "Toàn hệ thống",
        accent: "text-foreground",
      },
      {
        label: "Đã đăng",
        value: stats?.published ?? "—",
        sub: "Public visible",
        accent: "text-emerald-700",
      },
      {
        label: "Bản nháp",
        value: stats?.draft ?? "—",
        sub: "Chưa publish",
        accent: "text-muted-foreground",
      },
      {
        label: "Đã xóa",
        value: stats?.deleted ?? "—",
        sub: "Soft delete",
        accent: "text-destructive",
      },
    ],
    [stats],
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Nội dung</span>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-foreground">Bài viết</span>
          </div>
          <h1 className="font-[var(--font-heading)] text-3xl font-black tracking-tight">
            <span className="mr-2">📝</span>
            Bài viết
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Quản lý tin tức cho news.5bib.com và hướng dẫn cho hotro.5bib.com.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => Promise.all([loadList(), loadStats()])}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            Làm mới
          </Button>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            <Plus className="size-4" />
            {creating ? "Đang tạo..." : "Tạo bài mới"}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-card p-4 shadow-xs"
          >
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
            <div
              className={`mt-2 font-mono text-3xl font-bold leading-none tracking-tight ${s.accent}`}
            >
              {s.value}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">{s.sub}</div>
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
            placeholder="Tìm theo tiêu đề bài viết…"
            className="h-9 pl-9"
          />
        </div>
        <Select
          value={filterType}
          onValueChange={(v) => setFilterType(v as TypeFilter)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Loại" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            <SelectItem value="help">📖 Hướng dẫn</SelectItem>
            <SelectItem value="news">📰 Tin tức</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as StatusFilter)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="published">🟢 Published</SelectItem>
            <SelectItem value="draft">⬜ Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProduct} onValueChange={(v) => setFilterProduct(v ?? "all")}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Sản phẩm" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả sản phẩm</SelectItem>
            <SelectItem value="5bib">5BIB</SelectItem>
            <SelectItem value="5sport">5Sport</SelectItem>
            <SelectItem value="5ticket">5Ticket</SelectItem>
            <SelectItem value="5pix">5Pix</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          Hiển thị <b className="text-foreground">{items.length}</b> / {total} bài
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] uppercase tracking-wider">Tiêu đề</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Loại</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Sản phẩm</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Trạng thái</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Ngày đăng</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Tác giả</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : items.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <FileText className="mx-auto mb-2 size-8 opacity-30" />
                      <div className="text-sm font-medium">Chưa có bài viết nào</div>
                      <div className="text-xs">Tạo bài đầu tiên!</div>
                    </TableCell>
                  </TableRow>
                )
                : items.map((a) => (
                    <ArticleRow
                      key={a.id}
                      article={a}
                      onEdit={() => router.push(`/articles/${a.id}/edit`)}
                      onDelete={() => handleDelete(a)}
                    />
                  ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              Trang {page} / {totalPages} · Tổng {total} bài
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

function ArticleRow({
  article,
  onEdit,
  onDelete,
}: {
  article: ArticleAdminDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const publishedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

  return (
    <TableRow className="group">
      <TableCell className="max-w-[400px]">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-3 text-left hover:opacity-80"
        >
          <div
            className="size-12 shrink-0 rounded-md bg-cover bg-center bg-muted"
            style={{
              backgroundImage: article.coverImageUrl
                ? `url(${article.coverImageUrl})`
                : undefined,
            }}
          />
          <div className="min-w-0">
            <div className="truncate font-semibold">{article.title}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              /{article.slug}
            </div>
          </div>
        </button>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            article.type === "news"
              ? "border-orange-200 bg-orange-50 text-orange-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }
        >
          {article.type === "news" ? "📰 Tin" : "📖 HD"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {article.products.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            article.products.map((p) => (
              <Badge key={p} variant="secondary" className="font-mono uppercase">
                {p}
              </Badge>
            ))
          )}
        </div>
      </TableCell>
      <TableCell>
        {article.status === "published" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <span className="size-2 rounded-full bg-emerald-700" /> Published
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground" /> Draft
          </span>
        )}
        {article.featured && (
          <Badge variant="outline" className="ml-1.5 border-amber-200 bg-amber-50 text-amber-800">
            ⭐ Hero
          </Badge>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {publishedDate}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {article.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.authorAvatar}
              alt=""
              className="size-6 rounded-full bg-muted"
            />
          ) : (
            <div className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-bold">
              {article.authorName?.[0] ?? "?"}
            </div>
          )}
          <span className="text-sm">{article.authorName || "—"}</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Sửa">
            <Pencil className="size-3.5" />
          </Button>
          {article.status === "published" && (
            <a
              href={`https://${article.type === "news" ? "news" : "hotro"}.5bib.com/${article.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-grid size-8 place-items-center rounded-md text-foreground/70 hover:bg-accent hover:text-foreground"
              aria-label="Xem"
            >
              <Eye className="size-3.5" />
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="Xóa"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
