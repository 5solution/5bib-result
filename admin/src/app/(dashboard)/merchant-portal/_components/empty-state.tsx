"use client";

/**
 * F-069 M3 — Empty state cho danh sách quyền BTC.
 * Phân biệt 2 case: chưa có config nào (CTA tạo) vs filter rỗng (gợi ý clear).
 */
import { ShieldCheck, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  filtered: boolean;
  onCreate: () => void;
  onClearFilter: () => void;
};

export function MerchantPortalEmptyState({
  filtered,
  onCreate,
  onClearFilter,
}: Props) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <SearchX className="size-10 text-[var(--text-muted,#78716C)]" />
        <div>
          <h3 className="text-sm font-semibold">Không có kết quả khớp bộ lọc</h3>
          <p className="mt-1 text-sm text-[var(--text-muted,#78716C)]">
            Thử đổi từ khóa hoặc xóa bộ lọc để xem toàn bộ.
          </p>
        </div>
        <Button variant="outline" onClick={onClearFilter}>
          Xóa bộ lọc
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <ShieldCheck className="size-10 text-[var(--text-muted,#78716C)]" />
      <div>
        <h3 className="text-sm font-semibold">Chưa gán quyền cho BTC nào</h3>
        <p className="mt-1 text-sm text-[var(--text-muted,#78716C)]">
          Tạo cấu hình quyền để BTC đăng nhập merchant portal xem báo cáo vé/doanh thu.
        </p>
      </div>
      <Button onClick={onCreate}>Gán quyền mới</Button>
    </div>
  );
}
