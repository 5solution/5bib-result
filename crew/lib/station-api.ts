/**
 * v1.6 THAY ĐỔI 3 — Public "my station" portal endpoint.
 *
 * Dual-mode fetch wrapper mirroring directory-api.ts:
 *  - Server (SSR/RSC): talk to BACKEND_URL directly.
 *  - Browser: use the Next.js proxy at /api/public/...
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

export type StationStatus = "setup" | "active" | "closed";
// v1.8 — assignment_role enum REMOVED. supervisor/worker derives from role.
export type AssignmentRole = "crew" | "volunteer";

export interface AssignmentMemberBrief {
  assignment_id: number;
  registration_id: number;
  full_name: string;
  phone: string;
  status: string;
  // v1.8 — derived from role.is_leader_role
  is_supervisor: boolean;
  role_id: number | null;
  role_name: string | null;
  duty: string | null;
  note: string | null;
}

export interface MyStationDetail {
  id: number;
  station_name: string;
  // v1.8 — Team (category) metadata surfaced to crew UI.
  category_id: number;
  category_name: string | null;
  category_color: string | null;
  location_description: string | null;
  gps_lat: string | null;
  gps_lng: string | null;
  google_maps_url: string | null;
  status: StationStatus;
}

export interface MyStationView {
  station: MyStationDetail | null;
  // v1.8 — replaces `my_assignment_role`. TRUE when my own role.is_leader_role.
  my_is_supervisor: boolean | null;
  supervisor_list: AssignmentMemberBrief[];
  teammate_list: AssignmentMemberBrief[];
}

export async function getMyStation(token: string): Promise<MyStationView> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(token)}/station`,
    ),
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<MyStationView>;
}

// ─────────────────────────────────────────────────────────────
//  Leader station management (token-auth, no JWT)
//  Matches StationWithAssignmentSummaryDto + AssignableMemberDto
// ─────────────────────────────────────────────────────────────

export interface StationAssignment {
  assignment_id: number;
  registration_id: number;
  full_name: string;
  phone: string;
  status: string;
  is_supervisor: boolean;
  role_id: number | null;
  role_name: string | null;
  duty: string | null;
  note: string | null;
}

export interface StationWithAssignments {
  id: number;
  event_id: number;
  station_name: string;
  location_description: string | null;
  gps_lat: string | null;
  gps_lng: string | null;
  status: StationStatus;
  sort_order: number;
  is_active: boolean;
  category_id: number;
  category_name: string | null;
  category_color: string | null;
  supervisors: StationAssignment[];
  workers: StationAssignment[];
  supervisor_count: number;
  worker_count: number;
  has_supervisor: boolean;
}

export interface AssignableMember {
  registration_id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  role_id: number;
  role_name: string;
  is_leader_role: boolean;
  avatar_url: string | null;
}

export interface CreateStationInput {
  station_name: string;
  location_description?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  sort_order?: number;
}

async function leaderFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res;
}

export async function leaderListStations(
  token: string,
): Promise<StationWithAssignments[]> {
  const res = await leaderFetch(
    `/api/public/team-leader/${encodeURIComponent(token)}/stations`,
    { cache: "no-store" } as RequestInit,
  );
  return res.json() as Promise<StationWithAssignments[]>;
}

export async function leaderCreateStation(
  token: string,
  categoryId: number,
  data: CreateStationInput,
): Promise<StationWithAssignments> {
  const res = await leaderFetch(
    `/api/public/team-leader/${encodeURIComponent(token)}/categories/${categoryId}/stations`,
    { method: "POST", body: JSON.stringify(data) },
  );
  return res.json() as Promise<StationWithAssignments>;
}

export async function leaderUpdateStation(
  token: string,
  stationId: number,
  data: Partial<CreateStationInput>,
): Promise<StationWithAssignments> {
  const res = await leaderFetch(
    `/api/public/team-leader/${encodeURIComponent(token)}/stations/${stationId}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
  return res.json() as Promise<StationWithAssignments>;
}

export async function leaderUpdateStationStatus(
  token: string,
  stationId: number,
  status: StationStatus,
): Promise<StationWithAssignments> {
  const res = await leaderFetch(
    `/api/public/team-leader/${encodeURIComponent(token)}/stations/${stationId}/status`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
  return res.json() as Promise<StationWithAssignments>;
}

export async function leaderDeleteStation(
  token: string,
  stationId: number,
): Promise<void> {
  await leaderFetch(
    `/api/public/team-leader/${encodeURIComponent(token)}/stations/${stationId}`,
    { method: "DELETE" },
  );
}

export async function leaderListAssignableMembers(
  token: string,
  stationId: number,
): Promise<AssignableMember[]> {
  const res = await leaderFetch(
    `/api/public/team-leader/${encodeURIComponent(token)}/stations/${stationId}/assignable-members`,
    { cache: "no-store" } as RequestInit,
  );
  return res.json() as Promise<AssignableMember[]>;
}

export async function leaderCreateAssignment(
  token: string,
  stationId: number,
  registrationId: number,
  duty?: string | null,
  note?: string | null,
): Promise<StationAssignment> {
  const res = await leaderFetch(
    `/api/public/team-leader/${encodeURIComponent(token)}/stations/${stationId}/assignments`,
    {
      method: "POST",
      body: JSON.stringify({ registration_id: registrationId, duty, note }),
    },
  );
  return res.json() as Promise<StationAssignment>;
}

export async function leaderRemoveAssignment(
  token: string,
  assignmentId: number,
): Promise<void> {
  await leaderFetch(
    `/api/public/team-leader/${encodeURIComponent(token)}/station-assignments/${assignmentId}`,
    { method: "DELETE" },
  );
}
