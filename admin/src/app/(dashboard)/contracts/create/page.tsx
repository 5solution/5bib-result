/**
 * F-024 Create contract — wizard 6-step.
 *
 * Page is server-rendered shell; wizard itself is client-side.
 */
import { ContractWizard } from "../_components/contract-wizard";

export const dynamic = "force-dynamic";

export default function CreateContractPage() {
  return (
    <div className="p-6">
      <ContractWizard />
    </div>
  );
}
