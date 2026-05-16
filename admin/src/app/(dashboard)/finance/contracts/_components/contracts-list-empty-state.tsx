"use client";

/**
 * FEATURE-038 — Empty / filtered-empty / error states for contracts list.
 *
 * 3 variants based on `variant` prop:
 *   - 'empty' → 0 contracts in DB (no filter applied)
 *   - 'filtered-empty' → search/period filter returned 0 → CTA "Bỏ tìm kiếm"
 *   - 'error' → 5xx / network → toast covered by parent + retry button here
 */
import { Coins, SearchX, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EmptyStateVariant = "empty" | "filtered-empty" | "error";

export function ContractsListEmptyState({
  variant,
  searchKeyword,
  onResetFilter,
  onRetry,
}: {
  variant: EmptyStateVariant;
  searchKeyword?: string;
  onResetFilter?: () => void;
  onRetry?: () => void;
}) {
  if (variant === "error") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/50 py-12 text-center">
        <AlertTriangle
          className="mb-3 size-10 text-red-600"
          aria-hidden
        />
        <h3 className="text-base font-semibold text-stone-900">
          Lỗi tải danh sách
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          Có lỗi khi kết nối backend. Hãy thử lại sau.
        </p>
        {onRetry ? (
          <Button onClick={onRetry} className="mt-4" variant="default">
            Thử lại
          </Button>
        ) : null}
      </div>
    );
  }

  if (variant === "filtered-empty") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-stone-200 bg-white py-12 text-center">
        <SearchX className="mb-3 size-10 text-stone-400" aria-hidden />
        <h3 className="text-base font-semibold text-stone-900">
          {searchKeyword
            ? `Không tìm thấy HĐ khớp "${searchKeyword}"`
            : "Không có HĐ phù hợp filter"}
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          Thử bỏ filter hoặc đổi khoảng thời gian.
        </p>
        {onResetFilter ? (
          <Button
            onClick={onResetFilter}
            className="mt-4"
            variant="outline"
            size="sm"
          >
            Bỏ tìm kiếm
          </Button>
        ) : null}
      </div>
    );
  }

  // 'empty' (default)
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-stone-200 bg-white py-12 text-center">
      <Coins className="mb-3 size-10 text-stone-400" aria-hidden />
      <h3 className="text-base font-semibold text-stone-900">
        Chưa có hợp đồng ACTIVE/COMPLETED
      </h3>
      <p className="mt-1 text-sm text-stone-600">
        Tạo HĐ mới hoặc chuyển trạng thái HĐ Draft sang ACTIVE để xuất hiện ở
        đây.
      </p>
    </div>
  );
}
