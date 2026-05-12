"use client";

/**
 * F-028 Phase 2 — Aggregated P&L Dashboard.
 *
 * Page-level RBAC gate `isAdmin` defense-in-depth (backend cũng enforce
 * via LogtoAdminGuard). Pattern clone từ Analytics F-026 `AnalyticsPageGate`.
 */
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { DashboardClient } from "./_components/dashboard-client";

export default function FinancePageGate() {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <RestrictedAccess message="Module Tài chính (P&L Dashboard) chỉ dành cho admin — bạn không có quyền truy cập." />
    );
  }
  return <DashboardClient />;
}
