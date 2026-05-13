"use client";

/**
 * F-024 Create contract — wizard 6-step.
 *
 * F-029 BR-HD-30 — Page-level RBAC gate `isStaff` defense-in-depth.
 * Client Component shell; wizard itself is client-side.
 */
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { ContractWizard } from "../_components/contract-wizard";

export default function CreateContractPage() {
  const { isStaff, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isStaff) return <RestrictedAccess />;
  return (
    <div className="p-6">
      <ContractWizard />
    </div>
  );
}
