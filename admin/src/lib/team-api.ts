// Interim typed fetch wrapper for team-management endpoints.
// TODO: once backend boots locally, run `pnpm run generate:api` and replace
// these calls with generated SDK functions from @/lib/api-generated.

import { VN_BANKS } from "./banks";

export interface TeamEvent {
  id: number;
  race_id: string | null;
  event_name: string;
  description: string | null;
  location: string | null;
  location_lat: string | number | null;
  location_lng: string | number | null;
  checkin_radius_m: number;
  event_start_date: string;
  event_end_date: string;
  registration_open: string;
  registration_close: string;
  status: "draft" | "open" | "closed" | "completed";
  contact_email: string | null;
  contact_phone: string | null;
  // Extra config fields — present on all event responses but not always
  // required by list callers. Event settings page consumes the full shape.
  benefits_image_url?: string | null;
  terms_conditions?: string | null;
  // TypeORM DECIMAL column returns as string from the driver.
  min_work_hours_for_completion?: string | number | null;
  // v1.9: feature toggles
  feature_mode?: "full" | "lite";
  feature_nghiem_thu?: boolean;
  created_at: string;
  updated_at: string;
}

// v1.9: Feature config response type
export interface EventFeaturesConfig {
  event_id: number;
  feature_mode: "full" | "lite";
  feature_nghiem_thu: boolean;
}

// v1.8 — Team (category) layer. Roles belong to a Team; Team owns stations +
// supply plan. See backend/src/modules/team-management/dto/team-category.dto.ts
export interface TeamCategory {
  id: number;
  event_id: number;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
  description: string | null;
  role_count: number;
  station_count: number;
  supply_plan_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTeamCategoryInput {
  name: string;
  slug?: string;
  color?: string;
  sort_order?: number;
  description?: string | null;
}

export type UpdateTeamCategoryInput = Partial<CreateTeamCategoryInput>;

export async function listTeamCategories(
  token: string,
  eventId: number,
): Promise<TeamCategory[]> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/team-categories`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function createTeamCategory(
  token: string,
  eventId: number,
  dto: CreateTeamCategoryInput,
): Promise<TeamCategory> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/team-categories`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(dto),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function getTeamCategory(
  token: string,
  id: number,
): Promise<TeamCategory> {
  const res = await fetch(`/api/team-management/team-categories/${id}`, {
    headers: authedHeaders(token),
    cache: "no-store",
  });
  await assertOk(res);
  return res.json();
}

export async function updateTeamCategory(
  token: string,
  id: number,
  dto: UpdateTeamCategoryInput,
): Promise<TeamCategory> {
  const res = await fetch(`/api/team-management/team-categories/${id}`, {
    method: "PATCH",
    headers: authedHeaders(token),
    body: JSON.stringify(dto),
  });
  await assertOk(res);
  return res.json();
}

export async function deleteTeamCategory(
  token: string,
  id: number,
): Promise<void> {
  const res = await fetch(`/api/team-management/team-categories/${id}`, {
    method: "DELETE",
    headers: authedHeaders(token),
  });
  await assertOk(res);
}

export interface TeamRole {
  id: number;
  event_id: number;
  // v1.8 — optional Team (category) the role belongs to. null = unassigned.
  category_id?: number | null;
  role_name: string;
  description: string | null;
  max_slots: number;
  filled_slots: number;
  waitlist_enabled: boolean;
  daily_rate: string;
  working_days: number;
  total_compensation: string;
  form_fields: FormFieldConfig[];
  contract_template_id: number | null;
  sort_order: number;
  // v1.5: per-role group chat. Nullable — admin may not have configured.
  chat_platform?: ChatPlatform | null;
  chat_group_url?: string | null;
  // v1.4/v1.6 Option B2 — leader-role flag + list of directly managed
  // roles (N:M junction). Backend resolves nested descendants at runtime
  // via BFS; this field only exposes direct edges for admin UI display.
  is_leader_role?: boolean;
  managed_role_ids?: number[];
  managed_roles?: Array<{ id: number; role_name: string }>;
}

export type ChatPlatform = "zalo" | "telegram" | "whatsapp" | "other";

export interface FormFieldConfig {
  key: string;
  label: string;
  type:
    | "text"
    | "tel"
    | "email"
    | "select"
    | "textarea"
    | "date"
    | "photo"
    | "shirt_size";
  required: boolean;
  options?: string[];
  hint?: string;
  note?: string;
}

export interface CreateEventInput {
  event_name: string;
  description?: string;
  location: string;
  location_lat?: number;
  location_lng?: number;
  checkin_radius_m: number;
  event_start_date: string;
  event_end_date: string;
  registration_open: string;
  registration_close: string;
  contact_email?: string;
  contact_phone?: string;
  benefits_image_url?: string;
  terms_conditions?: string;
}

// Uploads a benefits/avatar/cccd image via the existing public endpoint
// and returns the stored URL. Admins reuse this for event benefit banners.
export async function uploadTeamPhoto(
  file: File,
  photoType: "avatar" | "cccd" | "benefits",
): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("photo_type", photoType);
  const res = await fetch("/api/public/team-upload-photo", {
    method: "POST",
    body: fd,
  });
  await assertOk(res);
  return res.json();
}

export interface CreateRoleInput {
  role_name: string;
  description?: string;
  max_slots: number;
  waitlist_enabled: boolean;
  auto_approve?: boolean;
  daily_rate: number;
  working_days: number;
  form_fields: FormFieldConfig[];
  sort_order: number;
  contract_template_id?: number;
  // v1.5 group chat fields — optional. Null explicitly clears on update.
  chat_platform?: ChatPlatform | null;
  chat_group_url?: string | null;
  // v1.4/v1.6 Option B2 — leader role + multi-select managed roles.
  is_leader_role?: boolean;
  manages_role_ids?: number[];
  // v1.8 — optional Team (category) assignment. null clears explicitly.
  category_id?: number | null;
}

export type UpdateRoleInput = Partial<CreateRoleInput>;

export interface ManualRegisterInput {
  role_id: number;
  full_name: string;
  email: string;
  phone: string;
  form_data: Record<string, unknown>;
  auto_approve?: boolean;
  notes?: string;
}

export async function adminManualRegister(
  token: string,
  eventId: number,
  input: ManualRegisterInput,
): Promise<{ id: number; status: string; message: string; magic_link: string }> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/registrations/manual`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json();
}

function authedHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  let message = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (body.message)
      message = Array.isArray(body.message) ? body.message.join("; ") : body.message;
  } catch {
    // ignore
  }
  throw new Error(message);
}

export async function listTeamEvents(
  token: string,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<{ data: TeamEvent[]; total: number; page: number }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`/api/team-management/events?${qs.toString()}`, {
    headers: authedHeaders(token),
    cache: "no-store",
  });
  await assertOk(res);
  return res.json();
}

export async function createTeamEvent(
  token: string,
  input: CreateEventInput,
): Promise<TeamEvent> {
  const res = await fetch("/api/team-management/events", {
    method: "POST",
    headers: authedHeaders(token),
    body: JSON.stringify(input),
  });
  await assertOk(res);
  return res.json();
}

export async function deleteTeamEvent(token: string, id: number): Promise<void> {
  const res = await fetch(`/api/team-management/events/${id}`, {
    method: "DELETE",
    headers: authedHeaders(token),
  });
  await assertOk(res);
}

// Fetches a single event for the settings page. We intentionally don't hit
// the public /team-events/:id endpoint because that one 404s when the
// registration window is closed — admins need to edit exactly those cases.
export async function getTeamEvent(
  token: string,
  id: number,
): Promise<TeamEvent> {
  const res = await fetch(`/api/team-management/events/${id}`, {
    headers: authedHeaders(token),
    cache: "no-store",
  });
  await assertOk(res);
  return res.json();
}

// v1.8 QC fix: update payload permits `null` on optional fields so the
// settings page can explicitly wipe stored values (empty-string → null).
// Backend DTO accepts null via ValidateIf; MySQL columns are nullable.
export type UpdateTeamEventInput = Partial<{
  event_name: string;
  description: string | null;
  location: string;
  location_lat: number | null;
  location_lng: number | null;
  checkin_radius_m: number;
  event_start_date: string;
  event_end_date: string;
  registration_open: string;
  registration_close: string;
  contact_email: string | null;
  contact_phone: string | null;
  benefits_image_url: string | null;
  terms_conditions: string | null;
  status: "draft" | "open" | "closed" | "completed";
}>;

export async function updateTeamEvent(
  token: string,
  id: number,
  patch: UpdateTeamEventInput,
): Promise<TeamEvent> {
  const res = await fetch(`/api/team-management/events/${id}`, {
    method: "PUT",
    headers: authedHeaders(token),
    body: JSON.stringify(patch),
  });
  await assertOk(res);
  return res.json();
}

export async function listTeamRoles(
  token: string,
  eventId: number,
): Promise<TeamRole[]> {
  const res = await fetch(`/api/team-management/events/${eventId}/roles`, {
    headers: authedHeaders(token),
    cache: "no-store",
  });
  await assertOk(res);
  return res.json();
}

export async function createTeamRole(
  token: string,
  eventId: number,
  input: CreateRoleInput,
): Promise<TeamRole> {
  const res = await fetch(`/api/team-management/events/${eventId}/roles`, {
    method: "POST",
    headers: authedHeaders(token),
    body: JSON.stringify(input),
  });
  await assertOk(res);
  return res.json();
}

export async function deleteTeamRole(token: string, id: number): Promise<void> {
  const res = await fetch(`/api/team-management/roles/${id}`, {
    method: "DELETE",
    headers: authedHeaders(token),
  });
  await assertOk(res);
}

// v1.8: Party A (company) config embedded in contract and acceptance templates
export interface PartyAConfig {
  party_a_company_name: string | null;
  party_a_address: string | null;
  party_a_tax_code: string | null;
  party_a_representative: string | null;
  party_a_position: string | null;
}

export interface ContractTemplate {
  id: number;
  template_name: string;
  content_html: string;
  variables: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // v1.8: Party A fields
  party_a_company_name?: string | null;
  party_a_address?: string | null;
  party_a_tax_code?: string | null;
  party_a_representative?: string | null;
  party_a_position?: string | null;
}

export async function listContractTemplates(token: string): Promise<ContractTemplate[]> {
  const res = await fetch("/api/team-management/contract-templates", {
    headers: authedHeaders(token),
    cache: "no-store",
  });
  await assertOk(res);
  return res.json();
}

export async function createContractTemplate(
  token: string,
  input: {
    template_name: string;
    content_html: string;
    variables: string[];
    is_active?: boolean;
  },
): Promise<ContractTemplate> {
  const res = await fetch("/api/team-management/contract-templates", {
    method: "POST",
    headers: authedHeaders(token),
    body: JSON.stringify(input),
  });
  await assertOk(res);
  return res.json();
}

export async function updateContractTemplate(
  token: string,
  id: number,
  input: Partial<{
    template_name: string;
    content_html: string;
    variables: string[];
    is_active: boolean;
  }>,
): Promise<ContractTemplate> {
  const res = await fetch(`/api/team-management/contract-templates/${id}`, {
    method: "PUT",
    headers: authedHeaders(token),
    body: JSON.stringify(input),
  });
  await assertOk(res);
  return res.json();
}

export async function deleteContractTemplate(token: string, id: number): Promise<void> {
  const res = await fetch(`/api/team-management/contract-templates/${id}`, {
    method: "DELETE",
    headers: authedHeaders(token),
  });
  await assertOk(res);
}

export async function duplicateContractTemplate(
  token: string,
  id: number,
): Promise<ContractTemplate> {
  const res = await fetch(
    `/api/team-management/contract-templates/${id}/duplicate`,
    { method: "POST", headers: authedHeaders(token) },
  );
  await assertOk(res);
  return res.json();
}

export async function validateContractTemplate(
  token: string,
  contentHtml: string,
): Promise<{ valid: boolean; unknownVars: string[] }> {
  const res = await fetch(
    "/api/team-management/contract-templates/validate",
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify({ content_html: contentHtml }),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function getContractTemplate(
  token: string,
  id: number,
): Promise<ContractTemplate> {
  const res = await fetch(`/api/team-management/contract-templates/${id}`, {
    headers: authedHeaders(token),
    cache: "no-store",
  });
  await assertOk(res);
  return res.json();
}

export async function importDocxToHtml(
  token: string,
  file: File,
): Promise<{ content_html: string; warnings: string[] }> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/team-management/contract-templates/import-docx", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  await assertOk(res);
  return res.json();
}

export interface ShirtStockRow {
  id: number;
  event_id: number;
  size: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";
  quantity_planned: number;
  quantity_ordered: number;
  quantity_received: number;
  notes: string | null;
}

export interface ShirtAggregateRow {
  size: string;
  registered: number;
  planned: number;
  ordered: number;
  received: number;
  surplus: number;
  notes: string | null;
}

export interface ShirtAggregate {
  by_size: ShirtAggregateRow[];
  total_registered: number;
  total_planned: number;
  total_ordered: number;
  total_received: number;
  last_updated: string;
}

export interface DashboardPerson {
  id: number;
  full_name: string;
  role_id: number;
  role_name: string;
  shirt_size: string | null;
  contract_status: string;
  checked_in_at: string | null;
  payment_status: string;
  avatar_photo_url: string | null;
}

export interface DashboardResponse {
  event_id: number;
  event_name: string;
  last_updated: string;
  total_roles: number;
  // v1.4 per-status counts (default 0 if missing from older responses)
  total?: number;
  pending_approval?: number;
  approved?: number;
  contract_sent?: number;
  contract_signed?: number;
  qr_sent?: number;
  checked_in?: number;
  completed?: number;
  waitlisted?: number;
  rejected?: number;
  cancelled?: number;
  total_suspicious?: number;
  // Legacy aggregate KPIs (retained for transition)
  total_approved: number;
  total_checked_in: number;
  checkin_rate: number;
  total_contract_signed: number;
  total_contract_unsigned: number;
  total_paid: number;
  by_role: Array<{
    role_id: number;
    role_name: string;
    headcount: number;
    checked_in: number;
    contract_signed: number;
    paid: number;
  }>;
  shirt_sizes: Array<{ size: string | null; count: number }>;
  total_shirt_registered: number;
  shirt_stock: Array<{
    size: string;
    registered: number;
    planned: number;
    ordered: number;
    received: number;
  }>;
  people: DashboardPerson[];
  people_total: number;
}

export interface RegistrationListRow {
  id: number;
  role_id: number;
  role_name: string | null;
  event_id: number;
  full_name: string;
  email: string;
  phone: string;
  shirt_size: string | null;
  avatar_photo_url: string | null;
  status: string;
  waitlist_position: number | null;
  contract_status: string;
  checked_in_at: string | null;
  payment_status: string;
  actual_working_days: number | null;
  actual_compensation: string | null;
  form_data: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  // v1.4 fields — optional so older responses still parse.
  rejection_reason?: string | null;
  suspicious_checkin?: boolean;
  completion_confirmed_at?: string | null;
  completion_confirmed_by?: "leader" | "admin" | null;
  completion_confirmed_id?: number | null;
  // v1.4.1 profile-edit indicator
  has_pending_changes?: boolean;
  // v2.0 — acceptance gate surfacing on list rows
  acceptance_status?: AcceptanceStatus;
  acceptance_sent_at?: string | null;
  acceptance_signed_at?: string | null;
  acceptance_value?: number | null;
  contract_number?: string | null;
}

export type AcceptanceStatus =
  | "not_ready"
  | "pending_sign"
  | "signed"
  | "disputed";

export interface RegistrationDetail extends RegistrationListRow {
  cccd_photo_url: string | null;
  cccd_back_photo_url: string | null;
  expertise: string | null;
  event_name: string;
  checkin_method: string | null;
  contract_signed_at: string | null;
  contract_pdf_url: string | null;
  has_signature: boolean;
  role_daily_rate?: string;
  role_working_days?: number;
  // v1.4.1
  has_pending_changes: boolean;
  pending_changes: Record<string, unknown> | null;
  pending_changes_submitted_at: string | null;
  // Magic-link recovery (admin-only) — full crew-portal URL + raw token + expiry
  magic_link: string;
  magic_token: string;
  magic_token_expires: string;
  // v2.0 — Acceptance (Biên bản nghiệm thu) + contract_number
  contract_number: string | null;
  acceptance_status: AcceptanceStatus;
  acceptance_value: number | null;
  acceptance_sent_at: string | null;
  acceptance_signed_at: string | null;
  acceptance_pdf_url: string | null;
  acceptance_notes: string | null;
  birth_date: string | null;
  cccd_issue_date: string | null;
  cccd_issue_place: string | null;
  payment_forced_reason: string | null;
  payment_forced_at: string | null;
  payment_forced_by: string | null;
}

export async function approveProfileChanges(
  token: string,
  id: number,
): Promise<RegistrationListRow> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/approve-changes`,
    { method: "PATCH", headers: authedHeaders(token) },
  );
  await assertOk(res);
  return res.json();
}

export async function rejectProfileChanges(
  token: string,
  id: number,
  reason: string,
): Promise<RegistrationListRow> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/reject-changes`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify({ reason }),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function getSignatureUrl(
  token: string,
  registrationId: number,
): Promise<{ url: string; expires_in: number }> {
  const res = await fetch(
    `/api/team-management/registrations/${registrationId}/signature-url`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function getSignedContractUrl(
  token: string,
  registrationId: number,
): Promise<{ url: string; expires_in: number }> {
  const res = await fetch(
    `/api/team-management/registrations/${registrationId}/contract-pdf-url`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function updateTeamRole(
  token: string,
  id: number,
  patch: Partial<CreateRoleInput>,
): Promise<TeamRole> {
  const res = await fetch(`/api/team-management/roles/${id}`, {
    method: "PUT",
    headers: authedHeaders(token),
    body: JSON.stringify(patch),
  });
  await assertOk(res);
  return res.json();
}

export async function getDashboard(
  token: string,
  eventId: number,
  page = 1,
  limit = 100,
): Promise<DashboardResponse> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/dashboard?page=${page}&limit=${limit}`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function getShirtAggregate(
  token: string,
  eventId: number,
): Promise<ShirtAggregate> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/shirt-aggregate`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function upsertShirtStock(
  token: string,
  eventId: number,
  sizes: Array<{
    size: string;
    quantity_planned: number;
    quantity_ordered: number;
    quantity_received: number;
    notes?: string;
  }>,
): Promise<{ updated: number }> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/shirt-stock`,
    {
      method: "PUT",
      headers: authedHeaders(token),
      body: JSON.stringify({ sizes }),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function listRegistrations(
  token: string,
  eventId: number,
  params: {
    status?: string;
    role_id?: number;
    search?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{
  data: RegistrationListRow[];
  total: number;
  by_status: Record<string, number>;
}> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.role_id) qs.set("role_id", String(params.role_id));
  if (params.search) qs.set("search", params.search);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(
    `/api/team-management/events/${eventId}/registrations?${qs.toString()}`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function getRegistrationDetail(
  token: string,
  id: number,
): Promise<RegistrationDetail> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/detail`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function patchRegistration(
  token: string,
  id: number,
  patch: {
    status?: string;
    notes?: string;
    payment_status?: string;
    actual_working_days?: number;
    // Profile / backfill fields
    full_name?: string;
    phone?: string;
    email?: string;
    shirt_size?: string | null;
    birth_date?: string | null;
    cccd?: string | null;
    cccd_issue_date?: string | null;
    cccd_issue_place?: string | null;
    bank_account_number?: string | null;
    bank_holder_name?: string | null;
    bank_name?: string | null;
    bank_branch?: string | null;
    address?: string | null;
  },
): Promise<RegistrationListRow> {
  const res = await fetch(`/api/team-management/registrations/${id}`, {
    method: "PATCH",
    headers: authedHeaders(token),
    body: JSON.stringify(patch),
  });
  await assertOk(res);
  return res.json();
}

export type BulkAction = "approve" | "reject" | "cancel";

export async function bulkUpdateRegistrations(
  token: string,
  payload: { ids: number[]; action: BulkAction; reason?: string },
): Promise<{ updated: number; skipped: number; failed_ids: number[] }> {
  const res = await fetch(
    "/api/team-management/registrations/bulk-update",
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(payload),
    },
  );
  await assertOk(res);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────
// v1.4 state-machine per-registration actions
// ─────────────────────────────────────────────────────────────────────

export async function approveRegistration(
  token: string,
  id: number,
): Promise<RegistrationListRow> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/approve`,
    { method: "PATCH", headers: authedHeaders(token) },
  );
  await assertOk(res);
  return res.json();
}

export async function rejectRegistration(
  token: string,
  id: number,
  rejection_reason: string,
): Promise<RegistrationListRow> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/reject`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify({ rejection_reason }),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function cancelRegistration(
  token: string,
  id: number,
  reason?: string,
): Promise<RegistrationListRow> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/cancel`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function confirmCompletion(
  token: string,
  id: number,
  note?: string,
): Promise<RegistrationListRow> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/confirm-completion`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify(note ? { note } : {}),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function clearSuspicious(
  token: string,
  id: number,
  admin_note: string,
): Promise<RegistrationListRow> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/clear-suspicious`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify({ admin_note }),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function exportPaymentReport(
  token: string,
  eventId: number,
): Promise<{ download_url: string; row_count: number }> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/export`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function exportPersonnel(
  token: string,
  eventId: number,
  params: { status?: string; role_id?: number; search?: string } = {},
): Promise<{
  url: string;
  filename: string;
  expires_in: number;
  row_count: number;
}> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.role_id) qs.set("role_id", String(params.role_id));
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  const res = await fetch(
    `/api/team-management/events/${eventId}/export-personnel${
      query ? `?${query}` : ""
    }`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export interface StaffCheckinScanResponse {
  success: true;
  full_name: string;
  role_name: string;
  checked_in_at: string;
  method: "qr_scan" | "gps_verify";
}

export async function staffCheckinScan(
  token: string,
  scannedToken: string,
  eventId?: number,
): Promise<StaffCheckinScanResponse> {
  const res = await fetch("/api/team-management/checkin/scan", {
    method: "POST",
    headers: authedHeaders(token),
    body: JSON.stringify({
      qr_code: scannedToken,
      ...(eventId != null ? { event_id: eventId } : {}),
    }),
  });
  await assertOk(res);
  return res.json();
}

export interface CheckinLookupResult {
  id: number;
  full_name: string;
  role_name: string;
  cccd_last4: string;
  phone_masked: string;
  avatar_photo_url: string | null;
  status: string;
  checked_in_at: string | null;
  qr_code: string;
}

/**
 * Fallback when a QR scan isn't possible — search approved regs by
 * name / phone / CCCD. Min 2 chars, ≤ 8 rows, unchecked-in first.
 */
export async function lookupRegistrations(
  token: string,
  q: string,
  eventId: number,
): Promise<CheckinLookupResult[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  const qs = new URLSearchParams({ q: trimmed, event_id: String(eventId) });
  const res = await fetch(
    `/api/team-management/checkin/lookup?${qs.toString()}`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  const body = (await res.json()) as { data: CheckinLookupResult[] };
  return body.data;
}

// -------- Role import (bulk CSV/XLSX) --------

export interface ParsedRoleRow {
  _row: number;
  role_name: string;
  description: string | null;
  max_slots: number | null;
  daily_rate: number;
  working_days: number;
  waitlist_enabled: boolean;
  sort_order: number;
}

export interface ParsedRoleRowError {
  _row: number;
  role_name: string;
  errors: string[];
}

export interface PreviewRoleImportResponse {
  total_rows: number;
  valid_rows: ParsedRoleRow[];
  invalid_rows: ParsedRoleRowError[];
}

export interface ConfirmRoleImportResponse {
  created: number;
  skipped: number;
  roles: TeamRole[];
}

export async function downloadRoleTemplate(token: string): Promise<void> {
  // Endpoint is JWT-guarded, so we fetch with Bearer, then trigger a
  // blob-based download. Filename comes from server's Content-Disposition
  // header; fall back to "roles_template.csv".
  const res = await fetch("/api/team-management/roles/import-template", {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roles_template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function previewRoleImport(
  token: string,
  eventId: number,
  file: File,
): Promise<PreviewRoleImportResponse> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(
    `/api/team-management/events/${eventId}/roles/import/preview`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    },
  );
  await assertOk(res);
  return res.json();
}

export async function confirmRoleImport(
  token: string,
  eventId: number,
  rows: ParsedRoleRow[],
): Promise<ConfirmRoleImportResponse> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/roles/import/confirm`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify({ rows }),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function sendContracts(
  token: string,
  roleId: number,
  dryRun = false,
): Promise<{ queued: number; already_sent: number; skipped: number; skip_reasons?: string[] }> {
  const res = await fetch(
    `/api/team-management/roles/${roleId}/send-contracts`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify({ dry_run: dryRun }),
    },
  );
  await assertOk(res);
  return res.json();
}

// -------- v1.4 Schedule Email (per-role blast) --------

export interface ScheduleEmailConfig {
  id: number;
  event_id: number;
  role_id: number;
  role_name: string;
  member_count_eligible: number;
  subject: string;
  body_html: string;
  reporting_time: string | null;
  gathering_point: string | null;
  team_contact_phone: string | null;
  special_note: string | null;
  last_sent_at: string | null;
  last_sent_count: number;
  total_sent_count: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduleEmailRoleSummary {
  role_id: number;
  role_name: string;
  member_count_eligible: number;
  config: ScheduleEmailConfig | null;
}

export interface UpsertScheduleEmailInput {
  subject: string;
  body_html: string;
  reporting_time?: string | null;
  gathering_point?: string | null;
  team_contact_phone?: string | null;
  special_note?: string | null;
}

export async function listScheduleEmails(
  token: string,
  eventId: number,
): Promise<ScheduleEmailRoleSummary[]> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/schedule-emails`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function getScheduleEmail(
  token: string,
  eventId: number,
  roleId: number,
): Promise<ScheduleEmailConfig | null> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/schedule-emails/${roleId}`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  if (res.status === 404) return null;
  await assertOk(res);
  return res.json();
}

export async function upsertScheduleEmail(
  token: string,
  eventId: number,
  roleId: number,
  input: UpsertScheduleEmailInput,
): Promise<ScheduleEmailConfig> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/schedule-emails/${roleId}`,
    {
      method: "PUT",
      headers: authedHeaders(token),
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function sendTestScheduleEmail(
  token: string,
  eventId: number,
  roleId: number,
  testEmail?: string,
): Promise<{ sent: boolean; delivered_to: string }> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/schedule-emails/${roleId}/send-test`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(testEmail ? { test_email: testEmail } : {}),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function sendBulkScheduleEmail(
  token: string,
  eventId: number,
  roleId: number,
): Promise<{ queued: number; skipped: number }> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/schedule-emails/${roleId}/send-bulk`,
    { method: "POST", headers: authedHeaders(token) },
  );
  await assertOk(res);
  return res.json();
}

export const DEFAULT_FORM_FIELDS: FormFieldConfig[] = [
  { key: "cccd", label: "Số CCCD/CMND", type: "text", required: true },
  { key: "dob", label: "Ngày sinh", type: "date", required: true },
  {
    key: "shirt_size",
    label: "Size áo vận hành",
    type: "shirt_size",
    required: true,
    options: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  },
  {
    key: "cccd_photo",
    label: "Ảnh CCCD/CMND",
    type: "photo",
    required: true,
    hint: "Chụp rõ mặt CCCD — bắt buộc để lập hợp đồng",
  },
  {
    key: "avatar_photo",
    label: "Ảnh chân dung (tùy chọn)",
    type: "photo",
    required: false,
    hint: "Không bắt buộc. Nếu có sẽ dùng làm avatar.",
  },
  {
    key: "experience",
    label: "Kinh nghiệm tình nguyện",
    type: "textarea",
    required: false,
  },
  // Bank / payout info — required so accountant can transfer payout.
  // Rendered as a grouped "Thông tin thanh toán" section in the detail view.
  {
    key: "bank_account_number",
    label: "Số tài khoản ngân hàng",
    type: "text",
    required: true,
    hint: "Chỉ số, 6–20 chữ số",
  },
  {
    key: "bank_holder_name",
    label: "Tên chủ tài khoản",
    type: "text",
    required: true,
    hint: "Phải khớp với họ tên ở trên (viết hoa không dấu)",
  },
  {
    key: "bank_name",
    label: "Ngân hàng",
    type: "select",
    required: true,
    options: [...VN_BANKS],
  },
  {
    key: "bank_branch",
    label: "Chi nhánh",
    type: "text",
    required: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Registration bulk import (v1.4.2)
// ─────────────────────────────────────────────────────────────────────────

export interface ImportRegistrationsPreviewRow {
  row_num: number;
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  valid: boolean;
  duplicate_kind: "none" | "in_file" | "in_db" | null;
  resolved_role_id?: number | null;
}

export interface ImportRegistrationsPreviewResponse {
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  duplicate_in_file: number;
  duplicate_in_db: number;
  rows: ImportRegistrationsPreviewRow[];
  import_token: string;
}

export interface ConfirmImportRegistrationsResponse {
  inserted: number;
  skipped: number;
  inserted_ids: number[];
  errors: string[];
}

/** Trigger a browser download of the XLSX template for this event. */
export async function downloadRegistrationTemplate(
  token: string,
  eventId: number,
): Promise<void> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/registrations/import/template`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const b = (await res.json()) as { message?: string };
      if (b.message) msg = b.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `registration-import-template-event-${eventId}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function previewRegistrationImport(
  token: string,
  eventId: number,
  file: File,
): Promise<ImportRegistrationsPreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `/api/team-management/events/${eventId}/registrations/import/preview`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  await assertOk(res);
  return res.json();
}

export async function confirmRegistrationImport(
  token: string,
  eventId: number,
  importToken: string,
  opts: { auto_approve?: boolean; skip_invalid?: boolean } = {},
): Promise<ConfirmImportRegistrationsResponse> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/registrations/import/confirm`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify({
        import_token: importToken,
        auto_approve: opts.auto_approve === true,
        skip_invalid: opts.skip_invalid !== false,
      }),
    },
  );
  await assertOk(res);
  return res.json();
}

// ============================================================
// v1.5 — Emergency contacts (per event)
// ============================================================

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

export interface CreateEventContactInput {
  contact_type: ContactType;
  contact_name: string;
  phone: string;
  phone2?: string | null;
  note?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export type UpdateEventContactInput = Partial<CreateEventContactInput>;

export async function listEventContacts(
  token: string,
  eventId: number,
): Promise<EventContact[]> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/contacts`,
    { headers: authedHeaders(token) },
  );
  await assertOk(res);
  return res.json();
}

export async function createEventContact(
  token: string,
  eventId: number,
  input: CreateEventContactInput,
): Promise<EventContact> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/contacts`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function updateEventContact(
  token: string,
  id: number,
  patch: UpdateEventContactInput,
): Promise<EventContact> {
  const res = await fetch(`/api/team-management/contacts/${id}`, {
    method: "PATCH",
    headers: authedHeaders(token),
    body: JSON.stringify(patch),
  });
  await assertOk(res);
  return res.json();
}

export async function toggleEventContactActive(
  token: string,
  id: number,
): Promise<EventContact> {
  const res = await fetch(
    `/api/team-management/contacts/${id}/toggle-active`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function deleteEventContact(
  token: string,
  id: number,
): Promise<void> {
  const res = await fetch(`/api/team-management/contacts/${id}`, {
    method: "DELETE",
    headers: authedHeaders(token),
  });
  await assertOk(res);
}

// ──────────────────────────────────────────────────────────────────────
// v1.6 THAY ĐỔI 1+2 — Stations + assignments
// ──────────────────────────────────────────────────────────────────────

export type StationStatus = "setup" | "active" | "closed";
// v1.8 — assignment_role enum DEPRECATED. supervisor/worker distinction is now
// DERIVED from registration.role.is_leader_role at read-time. Kept only as a
// typedef placeholder for old code paths; new code uses is_supervisor boolean.
export type AssignmentRole = "crew" | "volunteer";

export interface AssignmentMember {
  assignment_id: number;
  registration_id: number;
  full_name: string;
  phone: string;
  status: string;
  // v1.8 — derived from role.is_leader_role
  is_supervisor: boolean;
  role_id: number | null;
  role_name: string | null;
  // v1.7 — chuyên môn cụ thể tại trạm
  duty: string | null;
  note: string | null;
}

export interface Station {
  id: number;
  station_name: string;
  location_description: string | null;
  gps_lat: string | null;
  gps_lng: string | null;
  status: StationStatus;
  sort_order: number;
  is_active: boolean;
  event_id: number;
  // v1.8 — station now belongs to Team (category), not role.
  category_id: number;
  category_name: string | null;
  category_color: string | null;
  supervisors: AssignmentMember[];
  workers: AssignmentMember[];
  supervisor_count: number;
  worker_count: number;
  has_supervisor: boolean;
}

/**
 * v1.6 flat event-wide station list (no role picker) — each row carries
 * role_id + role_name so UI can group/filter client-side.
 */
export async function listAllStationsInEvent(
  token: string,
  eventId: number,
): Promise<Station[]> {
  const res = await fetch(`/api/team-management/events/${eventId}/stations`, {
    headers: authedHeaders(token),
    cache: "no-store",
  });
  await assertOk(res);
  return res.json();
}

export interface AssignableMember {
  registration_id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  avatar_url: string | null;
  // v1.8 — caller knows whether this member is from a leader-role (rendered
  // as 👑 in the modal, assigned as supervisor automatically).
  role_id: number;
  role_name: string;
  is_leader_role: boolean;
}

export interface CreateStationInput {
  station_name: string;
  location_description?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  sort_order?: number;
}

export type UpdateStationInput = Partial<CreateStationInput>;

export interface CreateAssignmentInput {
  registration_id: number;
  // v1.8 — assignment_role REMOVED. supervisor/worker derives from role.is_leader_role
  duty?: string | null;
  note?: string | null;
}

export async function listStationsByCategory(
  token: string,
  categoryId: number,
): Promise<Station[]> {
  const res = await fetch(
    `/api/team-management/team-categories/${categoryId}/stations`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function createStation(
  token: string,
  categoryId: number,
  dto: CreateStationInput,
): Promise<Station> {
  const res = await fetch(
    `/api/team-management/team-categories/${categoryId}/stations`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(dto),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function updateStation(
  token: string,
  id: number,
  patch: UpdateStationInput,
): Promise<Station> {
  const res = await fetch(`/api/team-management/stations/${id}`, {
    method: "PATCH",
    headers: authedHeaders(token),
    body: JSON.stringify(patch),
  });
  await assertOk(res);
  return res.json();
}

export async function deleteStation(token: string, id: number): Promise<void> {
  const res = await fetch(`/api/team-management/stations/${id}`, {
    method: "DELETE",
    headers: authedHeaders(token),
  });
  await assertOk(res);
}

export async function updateStationStatus(
  token: string,
  id: number,
  status: StationStatus,
): Promise<Station> {
  const res = await fetch(`/api/team-management/stations/${id}/status`, {
    method: "PATCH",
    headers: authedHeaders(token),
    body: JSON.stringify({ status }),
  });
  await assertOk(res);
  return res.json();
}

export async function listAssignableMembers(
  token: string,
  stationId: number,
): Promise<AssignableMember[]> {
  const res = await fetch(
    `/api/team-management/stations/${stationId}/assignable-members`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function createAssignment(
  token: string,
  stationId: number,
  dto: CreateAssignmentInput,
): Promise<AssignmentMember> {
  const res = await fetch(
    `/api/team-management/stations/${stationId}/assignments`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(dto),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function removeAssignment(
  token: string,
  assignmentId: number,
): Promise<void> {
  const res = await fetch(
    `/api/team-management/station-assignments/${assignmentId}`,
    { method: "DELETE", headers: authedHeaders(token) },
  );
  await assertOk(res);
}

// =============================================================
// v1.6 Supply module — types + admin SDK helpers
// =============================================================

export interface SupplyItem {
  id: number;
  event_id: number;
  item_name: string;
  unit: string;
  created_by_role_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplyItemInput {
  item_name: string;
  unit: string;
  sort_order?: number;
  created_by_role_id?: number | null;
}

export type UpdateSupplyItemInput = Partial<CreateSupplyItemInput>;

export interface SupplyPlanRow {
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

export interface UpsertSupplyPlanRequestInput {
  items: Array<{
    item_id: number;
    requested_qty: number;
    request_note?: string | null;
  }>;
}

export interface UpsertSupplyPlanFulfillInput {
  items: Array<{
    item_id: number;
    fulfilled_qty: number;
    fulfill_note?: string | null;
  }>;
}

export interface SupplyOverviewCell {
  role_id: number;
  requested_qty: number;
  fulfilled_qty: number | null;
  gap_qty: number | null;
  allocated_qty: number;
  confirmed_qty: number;
}

export interface SupplyOverviewItemRow {
  item_id: number;
  item_name: string;
  unit: string;
  cells: SupplyOverviewCell[];
}

export interface EventSupplyOverview {
  roles: Array<{ role_id: number; role_name: string }>;
  items: SupplyOverviewItemRow[];
}

export interface AllocationRow {
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

export interface UpsertAllocationInput {
  allocations: Array<{ item_id: number; allocated_qty: number }>;
  optimistic_updated_at?: string;
}

export interface SupplementRow {
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

export interface LeaderSupplyView {
  event_id: number;
  role_id: number;
  role_name: string;
  // v1.6 Option A: explicit alias so crew UI can show "Vật tư — {managed}".
  managed_role_name: string;
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
      supplements: SupplementRow[];
    }>;
  }>;
}

// ---- items ----

export async function listSupplyItems(
  token: string,
  eventId: number,
): Promise<SupplyItem[]> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/supply-items`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function createSupplyItem(
  token: string,
  eventId: number,
  input: CreateSupplyItemInput,
): Promise<SupplyItem> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/supply-items`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function updateSupplyItem(
  token: string,
  id: number,
  patch: UpdateSupplyItemInput,
): Promise<SupplyItem> {
  const res = await fetch(`/api/team-management/supply-items/${id}`, {
    method: "PATCH",
    headers: authedHeaders(token),
    body: JSON.stringify(patch),
  });
  await assertOk(res);
  return res.json();
}

export async function deleteSupplyItem(
  token: string,
  id: number,
): Promise<void> {
  const res = await fetch(`/api/team-management/supply-items/${id}`, {
    method: "DELETE",
    headers: authedHeaders(token),
  });
  await assertOk(res);
}

// ---- supply items bulk import ----

export interface ImportSupplyItemsResult {
  inserted: number;
  skipped: number;
  errors: number;
  rows_inserted: Array<{ row: number; item_name: string; unit: string }>;
  rows_skipped: Array<{ row: number; item_name: string; reason: string }>;
  rows_errors: Array<{ row: number; message: string }>;
}

/**
 * Download the XLSX template for bulk supply item import.
 * Returns a Blob so the caller can trigger a browser download.
 */
export async function downloadSupplyItemsTemplate(
  token: string,
  eventId: number,
): Promise<Blob> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/supply-items/import-template`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  await assertOk(res);
  return res.blob();
}

/**
 * POST an XLSX or CSV file to bulk-import supply items for the event.
 */
export async function importSupplyItems(
  token: string,
  eventId: number,
  file: File,
): Promise<ImportSupplyItemsResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(
    `/api/team-management/events/${eventId}/supply-items/import`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body },
  );
  await assertOk(res);
  return res.json();
}

// ---- plan ----

export async function getSupplyPlan(
  token: string,
  eventId: number,
  categoryId: number,
): Promise<SupplyPlanRow[]> {
  // v1.8: routes moved from role-scoped to team-category-scoped.
  const res = await fetch(
    `/api/team-management/events/${eventId}/team-categories/${categoryId}/supply-plan`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

// v1.8 — Team (category) level supply view. Backend supply-overview returns
// cells keyed by "role_id" which semantically carries the category id in v1.8.
// We filter down to this category's cells and flatten into SupplyPlanRow-ish
// rows for the /teams/:teamId/supply tab.
export async function getSupplyPlanByCategory(
  token: string,
  eventId: number,
  categoryId: number,
): Promise<
  Array<{
    item_id: number;
    item_name: string;
    unit: string;
    requested_qty: number;
    fulfilled_qty: number | null;
    gap_qty: number | null;
    allocated_qty: number;
    confirmed_qty: number;
  }>
> {
  const overview = await getSupplyOverview(token, eventId);
  const out: Array<{
    item_id: number;
    item_name: string;
    unit: string;
    requested_qty: number;
    fulfilled_qty: number | null;
    gap_qty: number | null;
    allocated_qty: number;
    confirmed_qty: number;
  }> = [];
  for (const row of overview.items) {
    const cell = row.cells.find((c) => c.role_id === categoryId);
    if (!cell) continue;
    if (cell.requested_qty === 0 && cell.fulfilled_qty == null) continue;
    out.push({
      item_id: row.item_id,
      item_name: row.item_name,
      unit: row.unit,
      requested_qty: cell.requested_qty,
      fulfilled_qty: cell.fulfilled_qty,
      gap_qty: cell.gap_qty,
      allocated_qty: cell.allocated_qty,
      confirmed_qty: cell.confirmed_qty,
    });
  }
  return out;
}

export async function upsertSupplyPlanRequest(
  token: string,
  eventId: number,
  categoryId: number,
  input: UpsertSupplyPlanRequestInput,
): Promise<SupplyPlanRow[]> {
  // v1.8: team-category-scoped route.
  const res = await fetch(
    `/api/team-management/events/${eventId}/team-categories/${categoryId}/supply-plan/request`,
    {
      method: "PUT",
      headers: authedHeaders(token),
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function upsertSupplyPlanFulfill(
  token: string,
  eventId: number,
  categoryId: number,
  input: UpsertSupplyPlanFulfillInput,
): Promise<SupplyPlanRow[]> {
  // v1.8: team-category-scoped route.
  const res = await fetch(
    `/api/team-management/events/${eventId}/team-categories/${categoryId}/supply-plan/fulfill`,
    {
      method: "PUT",
      headers: authedHeaders(token),
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function getSupplyOverview(
  token: string,
  eventId: number,
): Promise<EventSupplyOverview> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/supply-overview`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

// ---- station bulk import (v1.9) ----

export interface ImportStationsResult {
  total_rows: number;
  inserted: Array<{ row: number; id: number; station_name: string }>;
  skipped: Array<{ row: number; station_name: string; reason: string }>;
  errors: Array<{ row: number; errors: string[] }>;
}

/**
 * Download XLSX template for bulk station import for a team (category).
 */
export async function downloadStationsTemplate(
  token: string,
  categoryId: number,
): Promise<Blob> {
  const res = await fetch(
    `/api/team-management/team-categories/${categoryId}/stations/import/template`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  await assertOk(res);
  return res.blob();
}

/**
 * POST XLSX/CSV to bulk-import stations into a team (category).
 */
export async function importStations(
  token: string,
  categoryId: number,
  file: File,
): Promise<ImportStationsResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(
    `/api/team-management/team-categories/${categoryId}/stations/import`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body },
  );
  await assertOk(res);
  return res.json();
}

// ---- allocations ----

export async function getStationAllocations(
  token: string,
  stationId: number,
): Promise<AllocationRow[]> {
  const res = await fetch(
    `/api/team-management/stations/${stationId}/allocations`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function upsertStationAllocations(
  token: string,
  stationId: number,
  input: UpsertAllocationInput,
): Promise<AllocationRow[]> {
  const res = await fetch(
    `/api/team-management/stations/${stationId}/allocations`,
    {
      method: "PUT",
      headers: authedHeaders(token),
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function unlockAllocation(
  token: string,
  allocationId: number,
  adminNote: string,
): Promise<AllocationRow> {
  const res = await fetch(
    `/api/team-management/supply-allocations/${allocationId}/unlock`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify({ admin_note: adminNote }),
    },
  );
  await assertOk(res);
  return res.json();
}

// ---- supplements ----

export async function listSupplements(
  token: string,
  allocationId: number,
): Promise<SupplementRow[]> {
  const res = await fetch(
    `/api/team-management/supply-allocations/${allocationId}/supplements`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function createSupplement(
  token: string,
  allocationId: number,
  qty: number,
  note?: string | null,
): Promise<SupplementRow> {
  const res = await fetch(
    `/api/team-management/supply-allocations/${allocationId}/supplements`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify({
        allocation_id: allocationId,
        qty,
        note: note ?? null,
      }),
    },
  );
  await assertOk(res);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────
// v2.0 — Payment (mark-paid, force-paid, revert)
// ─────────────────────────────────────────────────────────────────────

export interface MarkPaidResponse {
  id: number;
  payment_status: "paid";
  actual_compensation: string | null;
  was_forced: boolean;
  paid_at: string;
}

export async function markPaid(
  token: string,
  id: number,
): Promise<MarkPaidResponse> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/payment/mark-paid`,
    { method: "POST", headers: authedHeaders(token) },
  );
  await assertOk(res);
  return res.json();
}

export async function forcePaid(
  token: string,
  id: number,
  force_reason: string,
): Promise<MarkPaidResponse> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/payment/force-paid`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify({ force_reason }),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function revertPaid(
  token: string,
  id: number,
): Promise<{ id: number; payment_status: "pending" }> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/payment/revert`,
    { method: "POST", headers: authedHeaders(token) },
  );
  await assertOk(res);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────
// v2.0 — Acceptance (Biên bản nghiệm thu) — admin
// ─────────────────────────────────────────────────────────────────────

export interface SendAcceptanceBatchInput {
  registration_ids: number[];
  acceptance_value?: number;
  template_id?: number;
}

export interface SendAcceptanceBatchResponse {
  queued: number;
  skipped: number[];
  skip_reasons: string[];
}

export async function sendAcceptanceBatch(
  token: string,
  eventId: number,
  body: SendAcceptanceBatchInput,
): Promise<SendAcceptanceBatchResponse> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/acceptance/send-batch`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(body),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function sendAcceptanceOne(
  token: string,
  id: number,
  body: { acceptance_value?: number; template_id?: number } = {},
): Promise<{ registration_id: number; acceptance_status: "pending_sign" }> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/acceptance/send`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(body),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function disputeAcceptance(
  token: string,
  id: number,
  reason: string,
): Promise<{ registration_id: number; acceptance_status: "disputed" }> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/acceptance/dispute`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify({ reason }),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function getSignedAcceptanceUrl(
  token: string,
  magicToken: string,
): Promise<{ url: string; expires_in: number }> {
  // Uses the public-by-token endpoint. No admin JWT needed — acceptance
  // PDF access is gated by the magic token the crew holds. Admin pulls
  // the token via the registration detail response and can open the
  // PDF using the same route.
  const res = await fetch(
    `/api/public/team-acceptance-pdf/${encodeURIComponent(magicToken)}`,
    { cache: "no-store" },
  );
  // Suppress unused token param (keep signature consistent with
  // getSignedContractUrl for ergonomics).
  void token;
  await assertOk(res);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────
// v2.0 — Backfill Bên B (admin)
// ─────────────────────────────────────────────────────────────────────

export interface BackfillBenBInput {
  birth_date?: string | null;
  cccd_issue_date?: string | null;
  cccd_issue_place?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
  address?: string | null;
}

export async function backfillBenB(
  token: string,
  id: number,
  body: BackfillBenBInput,
): Promise<RegistrationListRow> {
  const res = await fetch(
    `/api/team-management/registrations/${id}/backfill-ben-b`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify(body),
    },
  );
  await assertOk(res);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────
// v2.0 — Acceptance templates (admin CRUD)
// ─────────────────────────────────────────────────────────────────────

export interface AcceptanceTemplate {
  id: number;
  event_id: number | null;
  template_name: string;
  content_html: string;
  variables: string[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // v1.8: Party A fields
  party_a_company_name?: string | null;
  party_a_address?: string | null;
  party_a_tax_code?: string | null;
  party_a_representative?: string | null;
  party_a_position?: string | null;
}

export interface AcceptanceTemplateInput {
  event_id?: number | null;
  template_name: string;
  content_html: string;
  variables?: string[];
  is_default?: boolean;
  is_active?: boolean;
  party_a_company_name?: string | null;
  party_a_address?: string | null;
  party_a_tax_code?: string | null;
  party_a_representative?: string | null;
  party_a_position?: string | null;
}

export async function listAcceptanceTemplates(
  token: string,
  params?: { event_id?: number | null },
): Promise<AcceptanceTemplate[]> {
  const qs = new URLSearchParams();
  if (params?.event_id != null) qs.set("event_id", String(params.event_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(
    `/api/team-management/acceptance-templates${suffix}`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function getAcceptanceTemplate(
  token: string,
  id: number,
): Promise<AcceptanceTemplate> {
  const res = await fetch(
    `/api/team-management/acceptance-templates/${id}`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function createAcceptanceTemplate(
  token: string,
  body: AcceptanceTemplateInput,
): Promise<AcceptanceTemplate> {
  const res = await fetch(`/api/team-management/acceptance-templates`, {
    method: "POST",
    headers: authedHeaders(token),
    body: JSON.stringify(body),
  });
  await assertOk(res);
  return res.json();
}

export async function updateAcceptanceTemplate(
  token: string,
  id: number,
  body: Partial<AcceptanceTemplateInput>,
): Promise<AcceptanceTemplate> {
  const res = await fetch(
    `/api/team-management/acceptance-templates/${id}`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify(body),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function deleteAcceptanceTemplate(
  token: string,
  id: number,
): Promise<void> {
  const res = await fetch(
    `/api/team-management/acceptance-templates/${id}`,
    { method: "DELETE", headers: authedHeaders(token) },
  );
  await assertOk(res);
}

export async function sendContractForRegistration(
  token: string,
  registrationId: number,
): Promise<void> {
  const res = await fetch(
    `/api/team-management/registrations/${registrationId}/send-contract`,
    { method: "POST", headers: authedHeaders(token) },
  );
  await assertOk(res);
}

// ─────────────────────────────────────────────────────────────────────
// v1.9: Feature mode config
// ─────────────────────────────────────────────────────────────────────

export async function getEventFeaturesConfig(
  token: string,
  eventId: number,
): Promise<EventFeaturesConfig> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/config`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  return res.json();
}

export async function updateEventFeatures(
  token: string,
  eventId: number,
  dto: { feature_mode: "full" | "lite"; feature_nghiem_thu: boolean },
): Promise<EventFeaturesConfig> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/features`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify(dto),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function confirmNghiemThu(
  token: string,
  registrationId: number,
  note?: string,
): Promise<{ id: number; status: string; completed_at: string }> {
  const res = await fetch(
    `/api/team-management/registrations/${registrationId}/nghiem-thu`,
    {
      method: "PATCH",
      headers: authedHeaders(token),
      body: JSON.stringify(note ? { note } : {}),
    },
  );
  await assertOk(res);
  return res.json();
}
