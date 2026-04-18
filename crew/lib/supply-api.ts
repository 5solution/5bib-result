/**
 * v1.6 Supply crew + leader public endpoints.
 *
 * Dual-mode fetch:
 *  - Server component: prefix BACKEND_URL (set at runtime in Docker).
 *  - Browser: use relative `/api/...` path; Next.js proxy forwards.
 */

const isServer = typeof window === "undefined";
const BACKEND_URL = isServer
  ? process.env.BACKEND_URL || "http://localhost:8081"
  : "";

function apiUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (body.message) {
      return Array.isArray(body.message) ? body.message.join("; ") : body.message;
    }
  } catch {
    // fall through
  }
  return `HTTP ${res.status}`;
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  throw new Error(await parseError(res));
}

// ---- Types (kept in sync with backend DTOs) ----

export interface CrewAllocationRow {
  id: number;
  station_id: number;
  item_id: number;
  item_name: string;
  unit: string;
  allocated_qty: number;
  confirmed_qty: number | null;
  shortage_qty: number | null;
  is_locked: boolean;
  confirmed_at: string | null;
  confirmation_note: string | null;
  confirmed_by: { name: string | null; phone: string | null } | null;
  updated_at: string;
}

export interface CrewSupplementRow {
  id: number;
  allocation_id: number;
  round_number: number;
  qty: number;
  note: string | null;
  confirmed_qty: number | null;
  shortage_qty: number | null;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  confirmed_by_phone: string | null;
  confirmation_note: string | null;
  created_at: string;
}

export interface ConfirmSupplyInput {
  receipts: Array<{ item_id: number; confirmed_qty: number }>;
  note?: string | null;
}

export interface ConfirmSupplementInput {
  supplement_id: number;
  confirmed_qty: number;
  note?: string | null;
}

export interface LeaderSupplyPlanRow {
  plan_id: number | null;
  item_id: number;
  item_name: string;
  unit: string;
  requested_qty: number;
  request_note: string | null;
  fulfilled_qty: number | null;
  fulfill_note: string | null;
  gap_qty: number | null;
  updated_at: string | null;
}

export interface LeaderSupplyView {
  event_id: number;
  // v1.6 Option B2: first-managed (backward compat). Prefer managed_role_ids + managed_role_names.
  role_id: number;
  role_name: string;
  // v1.6 Option B2: nested — leader may manage multiple roles (and
  // descendants). UI renders joined header "Vật tư — A + B + …".
  managed_role_ids: number[];
  managed_role_names: string[];
  items: Array<{
    item_id: number;
    item_name: string;
    unit: string;
    requested_qty: number;
    fulfilled_qty: number | null;
    gap_qty: number | null;
    request_note: string | null;
    fulfill_note: string | null;
    stations: Array<{
      allocation_id: number;
      station_id: number;
      station_name: string;
      allocated_qty: number;
      confirmed_qty: number | null;
      shortage_qty: number | null;
      is_locked: boolean;
      confirmed_at: string | null;
      confirmation_note: string | null;
      confirmed_by: { name: string | null; phone: string | null } | null;
      supplements: CrewSupplementRow[];
    }>;
  }>;
}

export interface UpsertSupplyRequestInput {
  items: Array<{
    item_id: number;
    requested_qty: number;
    request_note?: string | null;
  }>;
}

export interface UpsertStationAllocationsInput {
  allocations: Array<{ item_id: number; allocated_qty: number }>;
  optimistic_updated_at?: string;
}

// ---- CREW endpoints ----

export async function confirmSupply(
  token: string,
  input: ConfirmSupplyInput,
): Promise<CrewAllocationRow[]> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(token)}/station/confirm-supply`,
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json() as Promise<CrewAllocationRow[]>;
}

export async function confirmSupplement(
  token: string,
  input: ConfirmSupplementInput,
): Promise<CrewSupplementRow> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(token)}/station/confirm-supplement`,
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json() as Promise<CrewSupplementRow>;
}

// ---- LEADER endpoints ----

export async function getLeaderSupplyView(
  token: string,
): Promise<LeaderSupplyView> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(token)}/supply-plan`,
    ),
    { cache: "no-store" },
  );
  await assertOk(res);
  return res.json() as Promise<LeaderSupplyView>;
}

export async function leaderUpsertSupplyRequest(
  token: string,
  input: UpsertSupplyRequestInput,
): Promise<LeaderSupplyPlanRow[]> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(token)}/supply-plan/request`,
    ),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json() as Promise<LeaderSupplyPlanRow[]>;
}

export async function leaderUpsertStationAllocations(
  token: string,
  stationId: number,
  input: UpsertStationAllocationsInput,
): Promise<CrewAllocationRow[]> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(
        token,
      )}/stations/${stationId}/allocations`,
    ),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json() as Promise<CrewAllocationRow[]>;
}

export async function leaderCreateSupplement(
  token: string,
  allocationId: number,
  qty: number,
  note?: string | null,
): Promise<CrewSupplementRow> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(
        token,
      )}/supply-allocations/${allocationId}/supplements`,
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allocation_id: allocationId,
        qty,
        note: note ?? null,
      }),
    },
  );
  await assertOk(res);
  return res.json() as Promise<CrewSupplementRow>;
}
