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
