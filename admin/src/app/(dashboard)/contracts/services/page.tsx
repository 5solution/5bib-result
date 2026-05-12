/**
 * F-024 Service Catalog page (BR-CM-16).
 *
 * Server Component shell — delegate CRUD vào ServiceCatalogTable.
 */
import { ServiceCatalogTable } from "../_components/service-catalog-table";

export const dynamic = "force-dynamic";

export default function ServiceCatalogPage() {
  return (
    <div className="p-6">
      <ServiceCatalogTable />
    </div>
  );
}
