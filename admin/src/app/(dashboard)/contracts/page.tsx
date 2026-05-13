"use client";

/**
 * F-024 Contracts list page.
 *
 * F-029 BR-HD-30 — Page-level RBAC gate `isStaff` defense-in-depth.
 * Backend cũng enforce via LogtoStaffGuard.
 *
 * Client Component shell — boundary delegates state + data loading vào
 * ContractListTable (Client Component).
 */
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { ContractListTable } from "./_components/contract-list-table";

export default function ContractsPage() {
  const { isStaff, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isStaff) return <RestrictedAccess />;
  return (
    <div className="p-6">
      <ContractListTable />
    </div>
  );
}
