"use client";

/**
 * Client-side pagination (render-layer only).
 *
 * Dùng cùng với hook `usePagedList(items, pageSize)`:
 *   const { paged, page, setPage, pageCount } = usePagedList(items, 20);
 *   ...
 *   <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={items.length} />
 *
 * Hook tự reset page về 1 khi `items.length` thay đổi (ví dụ khi filter).
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export function usePagedList<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset page khi dataset co lại (filter/search)
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { paged, page, setPage, pageCount, pageSize };
}

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize?: number;
  onPageChange: (next: number) => void;
  /** Nếu chỉ 1 page, không render gì (để UI gọn) */
  hideWhenSinglePage?: boolean;
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  hideWhenSinglePage = true,
}: PaginationProps) {
  if (hideWhenSinglePage && pageCount <= 1) return null;

  const first = (page - 1) * (pageSize ?? 0) + 1;
  const last = Math.min(page * (pageSize ?? 0), total);

  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
      <div>
        {pageSize ? (
          <>
            Hiển thị <strong className="text-foreground">{first}–{last}</strong> / {total}
          </>
        ) : (
          <>Trang {page}/{pageCount}</>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          title="Trang đầu"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          title="Trước"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-xs tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          title="Sau"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(pageCount)}
          disabled={page >= pageCount}
          title="Trang cuối"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
