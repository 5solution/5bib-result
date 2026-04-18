/**
 * v1.5 — Fetch wrappers for the public directory + emergency-contact
 * endpoints. All reads are magic-token authenticated via URL path.
 *
 * Dual-mode pattern:
 *  - Server (SSR, RSC): fetch BACKEND_URL directly so we don't bounce through
 *    our own Next.js proxy on every request.
 *  - Browser: hit `/api/public/...` so the Next.js catch-all proxy forwards.
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

// ---------- Directory ----------

export interface DirectoryMember {
  id: number;
  full_name: string;
  phone: string;
  role_name: string;
  is_leader: boolean;
  status: string;
  avatar_url: string | null;
}

export interface LeaderContact {
  id: number;
  full_name: string;
  phone: string;
  role_name: string;
  status: string;
  // True if this contact's role has is_leader_role=TRUE. For leader-viewer
  // the /directory response also includes non-leader cross-team members,
  // so the UI must check this flag before rendering the 👑 badge.
  is_leader: boolean;
}

export interface MyTeam {
  role_name: string;
  members: DirectoryMember[];
}

export interface TeamDirectoryResponse {
  my_team: MyTeam;
  team_leaders: LeaderContact[];
}

export async function getDirectory(
  token: string,
): Promise<TeamDirectoryResponse> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(token)}/directory`,
    ),
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<TeamDirectoryResponse>;
}

// ---------- Emergency contacts ----------

export type ContactType = "btc" | "medical" | "rescue" | "police" | "other";

export interface EventContact {
  id: number;
  event_id: number;
  contact_type: ContactType;
  contact_name: string;
  phone: string;
  phone2: string | null;
  note: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventContactsGroup {
  medical: EventContact[];
  rescue: EventContact[];
  police: EventContact[];
  btc: EventContact[];
  other: EventContact[];
}

export interface PublicEventContactsResponse {
  contacts: EventContactsGroup;
}

export async function getContacts(
  token: string,
): Promise<PublicEventContactsResponse> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-registration/${encodeURIComponent(token)}/contacts`,
    ),
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<PublicEventContactsResponse>;
}
