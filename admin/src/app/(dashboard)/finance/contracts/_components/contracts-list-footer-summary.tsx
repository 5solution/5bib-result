"use client";

/**
 * FEATURE-038 — Footer summary + pagination cho contracts list.
 *
 * Top row: aggregate totals across ALL filtered contracts (NOT just current
 * page) per BR-38-08 — "Tổng N HĐ — DT X — CP Y — Lãi/Lỗ Z (margin avg M%)"
 *
 * Bottom row: pagination Prev / page numbers / Next + page size selector
 * Default page sizes 20/50/100 per BR-38-06.
 */
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatVnd,
  formatMargin,
  CONTRACTS_LIST_PAGE_SIZES,
  type ContractsListPageSize,
  type DashboardTotals,
} from "@/lib/finance-api";

export function ContractsListFooterSummary({
  totals,
  page,
  totalPages,
  limit,
  onPageChange,
  onLimitChange,
}: {
  totals: DashboardTotals;
  page: number;
  totalPages: number;
  limit: ContractsListPageSize;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: ContractsListPageSize) => void;
}) {
  const isFirst = page <= 1;
  const isLast = page >= totalPages || totalPages === 0;

  // Compact page numbers: show current ± 2
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  const profitTone =
    totals.totalProfit > 0
      ? "text-emerald-700"
      : totals.totalProfit < 0
        ? "text-red-700"
        : "text-stone-700";

  return (
    <div className="space-y-3">
      {/* Aggregate summary row */}
      <div className="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <span className="text-stone-500">Tổng: </span>
            <span className="font-semibold tabular-nums">
              {totals.contractCount} HĐ
            </span>
          </div>
          <div>
            <span className="text-stone-500">Doanh thu: </span>
            <span className="font-semibold tabular-nums">
              {formatVnd(totals.totalRevenue)}
            </span>
          </div>
          <div>
            <span className="text-stone-500">Chi phí: </span>
            <span className="font-semibold tabular-nums">
              {formatVnd(totals.totalCost)}
            </span>
          </div>
          <div>
            <span className="text-stone-500">Lãi/Lỗ: </span>
            <span
              className={`font-semibold tabular-nums ${profitTone}`}
            >
              {formatVnd(totals.totalProfit)}
            </span>
          </div>
          <div>
            <span className="text-stone-500">Margin TB: </span>
            <span className="font-semibold tabular-nums">
              {formatMargin(totals.avgMargin)}
            </span>
          </div>
        </div>
      </div>

      {/* Pagination row */}
      {totalPages > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <span>Số dòng/trang:</span>
            <Select
              value={String(limit)}
              onValueChange={(v) =>
                onLimitChange(Number(v) as ContractsListPageSize)
              }
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue>{limit}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTRACTS_LIST_PAGE_SIZES.map((sz) => (
                  <SelectItem key={sz} value={String(sz)}>
                    {sz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={isFirst}
              onClick={() => onPageChange(page - 1)}
              aria-label="Trang trước"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {start > 1 ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(1)}
                >
                  1
                </Button>
                {start > 2 ? (
                  <span className="px-1 text-stone-400">…</span>
                ) : null}
              </>
            ) : null}
            {pages.map((p) => (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </Button>
            ))}
            {end < totalPages ? (
              <>
                {end < totalPages - 1 ? (
                  <span className="px-1 text-stone-400">…</span>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(totalPages)}
                >
                  {totalPages}
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={isLast}
              onClick={() => onPageChange(page + 1)}
              aria-label="Trang sau"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
