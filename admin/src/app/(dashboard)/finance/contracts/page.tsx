"use client";

/**
 * F-028 Phase 1 — placeholder cho /finance/contracts (sidebar entry "P&L theo HĐ").
 *
 * Phase 2 sẽ thay bằng list/dashboard aggregated. Tạm thời hiển thị hướng dẫn
 * "vào contract detail rồi click vào section Lãi/Lỗ" để tránh 404.
 */
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { Coins, FileSignature } from "lucide-react";

export default function FinanceContractsListGate() {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <RestrictedAccess message="Module Tài chính chỉ dành cho admin — bạn không có quyền truy cập." />
    );
  }
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Coins className="size-6 text-blue-700" aria-hidden />
        <h1 className="text-xl font-bold text-stone-900">P&amp;L theo Hợp đồng</h1>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          Phase 1
        </span>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900">
          Cách sử dụng (Phase 1)
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-stone-700">
          <li>
            Vào{" "}
            <Link
              href="/contracts"
              className="font-semibold text-blue-700 hover:underline"
            >
              Hợp đồng
            </Link>{" "}
            chọn 1 hợp đồng cần xem P&amp;L.
          </li>
          <li>
            Trong trang chi tiết HĐ kéo xuống section{" "}
            <strong>💰 Lãi/Lỗ Deal</strong> → click <em>"Xem chi tiết P&amp;L"</em>.
          </li>
          <li>
            Tại trang chi tiết P&amp;L: thêm/sửa chi phí, xem profit/margin,
            xuất Excel.
          </li>
        </ol>
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <FileSignature
            className="mr-1 inline size-4"
            aria-hidden
          />
          Phase 2 sẽ thêm dashboard tổng hợp (Top profit / Loss-making / theo
          thời gian) — đang trong roadmap.
        </div>
      </div>
    </div>
  );
}
