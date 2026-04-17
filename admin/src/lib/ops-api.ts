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

/* ─── Check-ins ─── */
export interface OpsCheckIn {
  id: string;
  event_id: string;
  user_id: string;
  team_id: string;
  shift_id: string | null;
  checked_in_at: string;
  checked_in_by: string;
  method: "QR" | "MANUAL";
  geo?: { lat: number; lng: number };
  created_at: string;
  updated_at: string;
  user_full_name?: string;
  user_phone?: string;
  user_role?: string;
}

export interface CheckInTeamSummary {
  team_id: string;
  team_name: string;
  team_code: string;
  total_check_ins: number;
  unique_users: number;
}

export interface CheckInSummary {
  event_id: string;
  total_check_ins: number;
  teams: CheckInTeamSummary[];
}

/* ─── Tasks ─── */
export type OpsTaskStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface OpsTask {
  id: string;
  event_id: string;
  team_id: string | null;
  title: string;
  description?: string;
  due_at: string;
  due_end_at?: string;
  status: OpsTaskStatus;
  assignee_user_ids: string[];
  blocker_reason?: string;
  completed_at?: string;
  completed_by: string | null;
  source_excel_row?: number;
  source_excel_sheet?: string;
  created_at: string;
  updated_at: string;
}

/* ─── Incidents ─── */
export type OpsIncidentPriority = "LOW" | "MEDIUM" | "HIGH";
export type OpsIncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface OpsIncident {
  id: string;
  event_id: string;
  reported_by: string;
  team_id: string | null;
  station_id?: string;
  priority: OpsIncidentPriority;
  description: string;
  photo_urls: string[];
  status: OpsIncidentStatus;
  acknowledged_by: string | null;
  acknowledged_at?: string;
  resolved_by: string | null;
  resolved_at?: string;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
}

/* ─── User QR badge ─── */
export interface UserQrBadge {
  user_id: string;
  full_name: string;
  phone: string;
  role: string;
  qr_token: string;
  team_name: string | null;
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
  get: (token: string, eventId: string, teamId: string) =>
    opsApiFetch<OpsTeam>(`admin/events/${eventId}/teams/${teamId}`, token),
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
  update: (
    token: string,
    eventId: string,
    userId: string,
    data: Record<string, unknown>
  ) =>
    opsApiFetch<OpsUser>(`admin/events/${eventId}/users/${userId}`, token, {
      method: "PATCH",
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
  issueQrBadge: (token: string, eventId: string, userId: string) =>
    opsApiFetch<UserQrBadge>(
      `admin/events/${eventId}/users/${userId}/qr-badge`,
      token,
      { method: "POST" }
    ),
  exportCsvUrl: (
    eventId: string,
    params?: { status?: string; role?: string; team_id?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.role) qs.set("role", params.role);
    if (params?.team_id) qs.set("team_id", params.team_id);
    const q = qs.toString();
    return `/api/race-ops/admin/events/${eventId}/users/export.csv${q ? `?${q}` : ""}`;
  },
  downloadCsv: async (
    token: string,
    eventId: string,
    params?: { status?: string; role?: string; team_id?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.role) qs.set("role", params.role);
    if (params?.team_id) qs.set("team_id", params.team_id);
    const q = qs.toString();
    const res = await fetch(
      `/api/race-ops/admin/events/${eventId}/users/export.csv${q ? `?${q}` : ""}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(body || `Export failed (${res.status})`);
    }
    return res.blob();
  },
};

/* ═══════ Check-ins ═══════ */

export const opsCheckInsApi = {
  list: (
    token: string,
    eventId: string,
    params?: {
      team_id?: string;
      user_id?: string;
      method?: string;
      since?: string;
    }
  ) => {
    const qs = new URLSearchParams();
    if (params?.team_id) qs.set("team_id", params.team_id);
    if (params?.user_id) qs.set("user_id", params.user_id);
    if (params?.method) qs.set("method", params.method);
    if (params?.since) qs.set("since", params.since);
    const q = qs.toString();
    return opsApiFetch<{ items: OpsCheckIn[]; total: number }>(
      `admin/events/${eventId}/check-ins${q ? `?${q}` : ""}`,
      token
    );
  },
  create: (token: string, eventId: string, data: Record<string, unknown>) =>
    opsApiFetch<OpsCheckIn>(`admin/events/${eventId}/check-ins`, token, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  summary: (token: string, eventId: string) =>
    opsApiFetch<CheckInSummary>(
      `admin/events/${eventId}/check-ins/summary`,
      token
    ),
  delete: (token: string, eventId: string, checkInId: string) =>
    opsApiFetch<void>(
      `admin/events/${eventId}/check-ins/${checkInId}`,
      token,
      { method: "DELETE" }
    ),
};

/* ═══════ Tasks ═══════ */

export const opsTasksApi = {
  list: (
    token: string,
    eventId: string,
    params?: { status?: string; team_id?: string; assignee_user_id?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.team_id) qs.set("team_id", params.team_id);
    if (params?.assignee_user_id)
      qs.set("assignee_user_id", params.assignee_user_id);
    const q = qs.toString();
    return opsApiFetch<{ items: OpsTask[]; total: number }>(
      `admin/events/${eventId}/tasks${q ? `?${q}` : ""}`,
      token
    );
  },
  create: (token: string, eventId: string, data: Record<string, unknown>) =>
    opsApiFetch<OpsTask>(`admin/events/${eventId}/tasks`, token, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (
    token: string,
    eventId: string,
    taskId: string,
    data: Record<string, unknown>
  ) =>
    opsApiFetch<OpsTask>(`admin/events/${eventId}/tasks/${taskId}`, token, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  updateStatus: (
    token: string,
    eventId: string,
    taskId: string,
    status: OpsTaskStatus,
    blockerReason?: string
  ) =>
    opsApiFetch<OpsTask>(
      `admin/events/${eventId}/tasks/${taskId}/status`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(blockerReason ? { blocker_reason: blockerReason } : {}),
        }),
      }
    ),
  archive: (token: string, eventId: string, taskId: string) =>
    opsApiFetch<void>(`admin/events/${eventId}/tasks/${taskId}`, token, {
      method: "DELETE",
    }),
  importExcel: (
    token: string,
    eventId: string,
    rows: Array<Record<string, unknown>>,
    replaceBySheet?: boolean
  ) =>
    opsApiFetch<{
      created: number;
      replaced: number;
      skipped: number;
      errors: string[];
    }>(`admin/events/${eventId}/tasks/import`, token, {
      method: "POST",
      body: JSON.stringify({ rows, replace_by_sheet: replaceBySheet ?? false }),
    }),
};

/* ═══════ Incidents ═══════ */

export const opsIncidentsApi = {
  list: (
    token: string,
    eventId: string,
    params?: { status?: string; priority?: string; team_id?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.priority) qs.set("priority", params.priority);
    if (params?.team_id) qs.set("team_id", params.team_id);
    const q = qs.toString();
    return opsApiFetch<{ items: OpsIncident[]; total: number }>(
      `admin/events/${eventId}/incidents${q ? `?${q}` : ""}`,
      token
    );
  },
  create: (token: string, eventId: string, data: Record<string, unknown>) =>
    opsApiFetch<OpsIncident>(`admin/events/${eventId}/incidents`, token, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  acknowledge: (
    token: string,
    eventId: string,
    incidentId: string,
    note?: string
  ) =>
    opsApiFetch<OpsIncident>(
      `admin/events/${eventId}/incidents/${incidentId}/acknowledge`,
      token,
      { method: "PATCH", body: JSON.stringify(note ? { note } : {}) }
    ),
  resolve: (
    token: string,
    eventId: string,
    incidentId: string,
    resolutionNote: string
  ) =>
    opsApiFetch<OpsIncident>(
      `admin/events/${eventId}/incidents/${incidentId}/resolve`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({ resolution_note: resolutionNote }),
      }
    ),
  archive: (token: string, eventId: string, incidentId: string) =>
    opsApiFetch<void>(
      `admin/events/${eventId}/incidents/${incidentId}`,
      token,
      { method: "DELETE" }
    ),
};

/* ═══════ Supply ═══════ */

export const opsSupplyApi = {
  /* ── Master SKU (supply-items) ── */
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
  updateItem: (
    token: string,
    eventId: string,
    itemId: string,
    data: Record<string, unknown>
  ) =>
    opsApiFetch<OpsSupplyItem>(
      `admin/events/${eventId}/supply-items/${itemId}`,
      token,
      { method: "PATCH", body: JSON.stringify(data) }
    ),
  deleteItem: (token: string, eventId: string, itemId: string) =>
    opsApiFetch<void>(
      `admin/events/${eventId}/supply-items/${itemId}`,
      token,
      { method: "DELETE" }
    ),

  /* ── Orders ── */
  createOrder: (
    token: string,
    eventId: string,
    data: Record<string, unknown>
  ) =>
    opsApiFetch<OpsSupplyOrder>(
      `admin/events/${eventId}/supply-orders`,
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
  getOrder: (token: string, eventId: string, orderId: string) =>
    opsApiFetch<OpsSupplyOrder>(
      `admin/events/${eventId}/supply-orders/${orderId}`,
      token
    ),
  updateOrderItems: (
    token: string,
    eventId: string,
    orderId: string,
    items: Array<{ sku: string; quantity: number; note?: string }>
  ) =>
    opsApiFetch<OpsSupplyOrder>(
      `admin/events/${eventId}/supply-orders/${orderId}/items`,
      token,
      { method: "PATCH", body: JSON.stringify({ items }) }
    ),
  submitOrder: (token: string, eventId: string, orderId: string) =>
    opsApiFetch<OpsSupplyOrder>(
      `admin/events/${eventId}/supply-orders/${orderId}/submit`,
      token,
      { method: "PATCH" }
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
  dispatchOrder: (token: string, eventId: string, orderId: string) =>
    opsApiFetch<OpsSupplyOrder>(
      `admin/events/${eventId}/supply-orders/${orderId}/dispatch`,
      token,
      { method: "PATCH" }
    ),
  receiveOrder: (token: string, eventId: string, orderId: string) =>
    opsApiFetch<OpsSupplyOrder>(
      `admin/events/${eventId}/supply-orders/${orderId}/receive`,
      token,
      { method: "PATCH" }
    ),

  /* ── Aggregate (planning view) ── */
  aggregate: (token: string, eventId: string) =>
    opsApiFetch<{ event_id: string; lines: SupplyAggregateLine[] }>(
      `admin/events/${eventId}/supply-orders/aggregate`,
      token
    ),
};
