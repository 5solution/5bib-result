/**
 * Race-Ops API helpers.
 *
 * Uses direct fetch via the /api proxy (same pattern as existing admin pages).
 * When backend SDK is regenerated (generate:api), these can be replaced by
 * generated functions. For now, manual fetch with typed responses.
 */

/* ═══════ Types ═══════ */

export interface OpsEvent {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  date: string;
  location: { name: string; geo?: { lat: number; lng: number } };
  courses: Array<{ name: string; distance_km: number; start_time: string }>;
  stations: Array<{
    station_id: string;
    name: string;
    description?: string;
    courses_served: string[];
    geo?: { lat: number; lng: number };
  }>;
  status: "DRAFT" | "LIVE" | "ENDED";
  created_at: string;
  updated_at: string;
}

export interface OpsTeam {
  id: string;
  event_id: string;
  name: string;
  code: string;
  leader_user_id: string | null;
  target_crew: number;
  target_tnv: number;
  station_ids: string[];
  order: number;
  color?: string;
  tags: string[];
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpsUser {
  id: string;
  phone: string;
  email?: string;
  full_name: string;
  dob?: string;
  role: string;
  event_id: string;
  team_id: string | null;
  status: string;
  rejected_reason?: string;
  approved_by: string | null;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OpsSupplyItem {
  id: string;
  event_id: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  category: string;
  default_price?: number;
  created_at: string;
  updated_at: string;
}

export interface OpsSupplyOrder {
  id: string;
  event_id: string;
  team_id: string;
  order_code: string;
  created_by: string;
  items: Array<{
    sku: string;
    name: string;
    unit: string;
    quantity: number;
    note?: string;
  }>;
  status: string;
  submitted_at?: string;
  approved_at?: string;
  approved_by: string | null;
  rejected_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface EventKpi {
  event_id: string;
  total_teams: number;
  total_volunteers: number;
  total_volunteers_approved: number;
  total_crew: number;
  total_checked_in: number;
  total_tasks_pending: number;
  total_tasks_done: number;
  total_incidents_open: number;
  total_supply_orders_submitted: number;
  total_supply_orders_approved: number;
}

export interface SupplyAggregateLine {
  sku: string;
  name: string;
  unit: string;
  category: string;
  total_approved: number;
  total_pending: number;
}

/* ═══════ Fetch helper ═══════ */

async function opsApiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`/api/race-ops/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ||
        `API error ${res.status}`
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/* ═══════ Events ═══════ */

export const opsEventsApi = {
  list: (token: string, status?: string) =>
    opsApiFetch<{ items: OpsEvent[]; total: number }>(
      `admin/events${status ? `?status=${status}` : ""}`,
      token
    ),
  get: (token: string, id: string) =>
    opsApiFetch<OpsEvent>(`admin/events/${id}`, token),
  kpi: (token: string, id: string) =>
    opsApiFetch<EventKpi>(`admin/events/${id}/kpi`, token),
  create: (token: string, data: Record<string, unknown>) =>
    opsApiFetch<OpsEvent>("admin/events", token, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (token: string, id: string, data: Record<string, unknown>) =>
    opsApiFetch<OpsEvent>(`admin/events/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  archive: (token: string, id: string) =>
    opsApiFetch<void>(`admin/events/${id}`, token, { method: "DELETE" }),
};

/* ═══════ Teams ═══════ */

export const opsTeamsApi = {
  list: (token: string, eventId: string) =>
    opsApiFetch<{ items: OpsTeam[]; total: number }>(
      `admin/events/${eventId}/teams`,
      token
    ),
  create: (token: string, eventId: string, data: Record<string, unknown>) =>
    opsApiFetch<OpsTeam>(`admin/events/${eventId}/teams`, token, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (
    token: string,
    eventId: string,
    teamId: string,
    data: Record<string, unknown>
  ) =>
    opsApiFetch<OpsTeam>(
      `admin/events/${eventId}/teams/${teamId}`,
      token,
      { method: "PATCH", body: JSON.stringify(data) }
    ),
  assignLeader: (
    token: string,
    eventId: string,
    teamId: string,
    leaderUserId: string | null
  ) =>
    opsApiFetch<OpsTeam>(
      `admin/events/${eventId}/teams/${teamId}/leader`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({ leader_user_id: leaderUserId }),
      }
    ),
  archive: (token: string, eventId: string, teamId: string) =>
    opsApiFetch<void>(
      `admin/events/${eventId}/teams/${teamId}`,
      token,
      { method: "DELETE" }
    ),
};

/* ═══════ Users / Applications ═══════ */

export const opsUsersApi = {
  list: (
    token: string,
    eventId: string,
    params?: { status?: string; role?: string; team_id?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.role) qs.set("role", params.role);
    if (params?.team_id) qs.set("team_id", params.team_id);
    const q = qs.toString();
    return opsApiFetch<{ items: OpsUser[]; total: number }>(
      `admin/events/${eventId}/users${q ? `?${q}` : ""}`,
      token
    );
  },
  create: (token: string, eventId: string, data: Record<string, unknown>) =>
    opsApiFetch<OpsUser>(`admin/events/${eventId}/users`, token, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approve: (
    token: string,
    eventId: string,
    userId: string,
    teamId?: string
  ) =>
    opsApiFetch<OpsUser>(
      `admin/events/${eventId}/users/${userId}/approve`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify(teamId ? { team_id: teamId } : {}),
      }
    ),
  reject: (
    token: string,
    eventId: string,
    userId: string,
    reason: string
  ) =>
    opsApiFetch<OpsUser>(
      `admin/events/${eventId}/users/${userId}/reject`,
      token,
      { method: "PATCH", body: JSON.stringify({ reason }) }
    ),
};

/* ═══════ Supply ═══════ */

export const opsSupplyApi = {
  listItems: (token: string, eventId: string, category?: string) =>
    opsApiFetch<{ items: OpsSupplyItem[]; total: number }>(
      `admin/events/${eventId}/supply-items${category ? `?category=${category}` : ""}`,
      token
    ),
  createItem: (
    token: string,
    eventId: string,
    data: Record<string, unknown>
  ) =>
    opsApiFetch<OpsSupplyItem>(
      `admin/events/${eventId}/supply-items`,
      token,
      { method: "POST", body: JSON.stringify(data) }
    ),
  listOrders: (
    token: string,
    eventId: string,
    params?: { status?: string; team_id?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.team_id) qs.set("team_id", params.team_id);
    const q = qs.toString();
    return opsApiFetch<{ items: OpsSupplyOrder[]; total: number }>(
      `admin/events/${eventId}/supply-orders${q ? `?${q}` : ""}`,
      token
    );
  },
  aggregate: (token: string, eventId: string) =>
    opsApiFetch<{ event_id: string; lines: SupplyAggregateLine[] }>(
      `admin/events/${eventId}/supply-orders/aggregate`,
      token
    ),
  approveOrder: (token: string, eventId: string, orderId: string) =>
    opsApiFetch<OpsSupplyOrder>(
      `admin/events/${eventId}/supply-orders/${orderId}/approve`,
      token,
      { method: "PATCH" }
    ),
  rejectOrder: (
    token: string,
    eventId: string,
    orderId: string,
    reason: string
  ) =>
    opsApiFetch<OpsSupplyOrder>(
      `admin/events/${eventId}/supply-orders/${orderId}/reject`,
      token,
      { method: "PATCH", body: JSON.stringify({ reason }) }
    ),
};
