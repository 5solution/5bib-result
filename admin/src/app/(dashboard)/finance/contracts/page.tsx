"use client";

/**
 * FEATURE-038 — `/finance/contracts` (Admin) — Contracts List with P&L per row.
 *
 * Thay placeholder F-028 Phase 1 bằng list table thực sự với KPI inline:
 * STT / Số HĐ / Đối tác / Giải / Loại / Doanh thu / Chi phí / Lãi-Lỗ /
 * Margin badge / Status. Row click → detail page F-028 Phase 1.
 *
 * Page-level gate `isAdmin || isFinance` defense-in-depth (F-078 widen từ
 * admin-only). Backend `LogtoFinanceGuard` đã enforce auth — page gate trả
 * `<RestrictedAccess />` để UX explain thay vì backend 403 silently.
 */
import { Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractsListClient } from "./_components/contracts-list-client";

function ContractsListLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export default function FinanceContractsListPage() {
  const { isAdmin, isFinance, isLoading } = useAuth();
  if (isLoading) return <ContractsListLoading />;
  if (!isAdmin && !isFinance) {
    return (
      <RestrictedAccess message="Module Tài chính chỉ dành cho admin hoặc kế toán (role `finance`) — bạn không có quyền truy cập." />
    );
  }
  return (
    <Suspense fallback={<ContractsListLoading />}>
      <ContractsListClient />
    </Suspense>
  );
}
