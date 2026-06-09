"use client";

/**
 * F-076 — Invoice Reconcile admin dashboard.
 *
 * Page-level RBAC gate `isAdmin || isFinance` (F-078 widen từ admin-only).
 * Backend cũng enforce via `LogtoFinanceGuard`. Pattern: Finance F-028.
 */
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { InvoiceReconcileClient } from "./_components/invoice-reconcile-client";

export default function InvoiceReconcilePageGate() {
  const { isAdmin, isFinance, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin && !isFinance) {
    return (
      <RestrictedAccess message="Module Đối soát hóa đơn MISA chỉ dành cho admin hoặc kế toán (role `finance`) — bạn không có quyền truy cập." />
    );
  }
  return <InvoiceReconcileClient />;
}
