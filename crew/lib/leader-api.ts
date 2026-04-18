/**
 * Typed fetch wrappers for the leader-portal public endpoints.
 * All calls use the magic token in the URL path — there's no bearer
 * auth. Backend validates role.is_leader_role + event expiry on every hit.
 *
 * On the server we call the backend directly; in the browser we rely on
 * the Next.js `/api/[...proxy]/` catch-all to forward to BACKEND_URL.
 */

const isServer = typeof window === "undefined";
const BACKEND_URL = isServer
  ? process.env.BACKEND_URL || "http://localhost:8081"
  : "";

function apiUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

export interface LeaderMemberView {
  id: number;
  full_name: string;
  phone: string;
  role_name: string;
  status: string;
  checked_in_at: string | null;
  avatar_url: string | null;
  id_card_url: string | null;
  suspicious_checkin: boolean;
}

export type ChatPlatform = "zalo" | "telegram" | "whatsapp" | "other";

export interface LeaderPortalResponse {
  leader: {
    id: number;
    full_name: string;
    role_name: string;
    event_id: number;
    event_name: string;
    is_leader: true;
    expires_at: string;
    // v1.5 — unconditionally populated for leaders (they're the ones running
    // the chat group; no contract gate applies).
    chat_platform: ChatPlatform | null;
    chat_group_url: string | null;
  };
  members: LeaderMemberView[];
}

export interface LeaderBulkSummary {
  confirmed: number;
  skipped: number;
  failed_ids: number[];
  suspicious_count: number;
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

export async function getLeaderTeam(
  token: string,
): Promise<LeaderPortalResponse> {
  const res = await fetch(
    apiUrl(`/api/public/team-leader/${encodeURIComponent(token)}/team`),
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<LeaderPortalResponse>;
}

/**
 * Probe — returns true if the token belongs to a leader-role registration.
 * Swallows 401/403/404 into `false` so the caller can decide whether to
 * render the tab without showing an ugly error.
 */
export async function probeIsLeader(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      apiUrl(`/api/public/team-leader/${encodeURIComponent(token)}/team`),
      { cache: "no-store" },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function leaderCheckin(
  token: string,
  memberId: number,
  method: "qr_scan" | "manual",
  qrCode?: string,
): Promise<{ success: true; member: LeaderMemberView }> {
  const res = await fetch(
    apiUrl(`/api/public/team-leader/${encodeURIComponent(token)}/checkin`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_registration_id: memberId,
        method,
        ...(qrCode ? { qr_code: qrCode } : {}),
      }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ success: true; member: LeaderMemberView }>;
}

export async function leaderConfirmCompletion(
  token: string,
  memberId: number,
  note?: string,
): Promise<{ success: true; suspicious: boolean; member_id: number }> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-leader/${encodeURIComponent(token)}/confirm-completion`,
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_registration_id: memberId,
        ...(note ? { note } : {}),
      }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    success: true;
    suspicious: boolean;
    member_id: number;
  }>;
}

export async function leaderConfirmCompletionBulk(
  token: string,
  memberIds: number[],
  note?: string,
): Promise<LeaderBulkSummary> {
  const res = await fetch(
    apiUrl(
      `/api/public/team-leader/${encodeURIComponent(
        token,
      )}/confirm-completion-bulk`,
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_registration_ids: memberIds,
        ...(note ? { note } : {}),
      }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<LeaderBulkSummary>;
}
