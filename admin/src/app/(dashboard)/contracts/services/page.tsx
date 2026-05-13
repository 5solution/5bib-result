"use client";

/**
 * F-024 Service Catalog page (BR-CM-16).
 *
 * F-029 BR-HD-30 — Page-level RBAC gate `isStaff` defense-in-depth.
 * Client Component shell — delegate CRUD vào ServiceCatalogTable.
 */
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { ServiceCatalogTable } from "../_components/service-catalog-table";

export default function ServiceCatalogPage() {
  const { isStaff, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isStaff) return <RestrictedAccess />;
  return (
    <div className="p-6">
      <ServiceCatalogTable />
    </div>
  );
}
