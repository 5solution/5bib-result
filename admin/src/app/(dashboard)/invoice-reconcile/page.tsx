"use client";

/**
 * F-076 — Invoice Reconcile admin dashboard.
 *
 * Page-level RBAC gate `isAdmin` (defense-in-depth — backend cũng enforce
 * via `LogtoAdminGuard`). Pattern clone từ Finance F-028 `FinancePageGate`.
 */
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { InvoiceReconcileClient } from "./_components/invoice-reconcile-client";

export default function InvoiceReconcilePageGate() {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <RestrictedAccess message="Module Đối soát hóa đơn MISA chỉ dành cho admin — bạn không có quyền truy cập." />
    );
  }
  return <InvoiceReconcileClient />;
}
