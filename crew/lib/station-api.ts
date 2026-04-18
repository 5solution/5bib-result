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
export type AssignmentRole = "crew" | "volunteer";

export interface AssignmentMemberBrief {
  assignment_id: number;
  registration_id: number;
  full_name: string;
  phone: string;
  status: string;
  assignment_role: AssignmentRole;
  note: string | null;
}

export interface MyStationDetail {
  id: number;
  station_name: string;
  location_description: string | null;
  gps_lat: string | null;
  gps_lng: string | null;
  google_maps_url: string | null;
  status: StationStatus;
}

export interface MyStationView {
  station: MyStationDetail | null;
  my_assignment_role: AssignmentRole | null;
  crew_list: AssignmentMemberBrief[];
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
