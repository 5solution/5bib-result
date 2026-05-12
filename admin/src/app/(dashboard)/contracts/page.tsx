/**
 * F-024 Contracts list page.
 *
 * Server Component shell — boundary delegates state + data loading vào
 * ContractListTable (Client Component).
 */
import { ContractListTable } from "./_components/contract-list-table";

export const dynamic = "force-dynamic";

export default function ContractsPage() {
  return (
    <div className="p-6">
      <ContractListTable />
    </div>
  );
}
