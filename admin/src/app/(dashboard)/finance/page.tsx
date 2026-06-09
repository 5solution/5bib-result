"use client";

/**
 * F-028 Phase 2 — Aggregated P&L Dashboard.
 *
 * Page-level RBAC gate `isAdmin || isFinance` defense-in-depth (backend cũng
 * enforce via LogtoFinanceGuard). F-078: widen từ admin-only sang finance/admin.
 */
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { DashboardClient } from "./_components/dashboard-client";

export default function FinancePageGate() {
  const { isAdmin, isFinance, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin && !isFinance) {
    return (
      <RestrictedAccess message="Module Tài chính (P&L Dashboard) chỉ dành cho admin hoặc kế toán (role `finance`) — bạn không có quyền truy cập." />
    );
  }
  return <DashboardClient />;
}
