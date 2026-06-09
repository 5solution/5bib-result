"use client";

/**
 * F-024 Create contract — wizard 6-step.
 *
 * F-029 BR-HD-30 — Page-level RBAC gate `isStaff || isFinance` defense-in-depth
 * (F-078 widen). Client Component shell; wizard itself is client-side.
 */
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { ContractWizard } from "../_components/contract-wizard";

export default function CreateContractPage() {
  const { isStaff, isFinance, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isStaff && !isFinance) return <RestrictedAccess />;
  return (
    <div className="p-6">
      <ContractWizard />
    </div>
  );
}
