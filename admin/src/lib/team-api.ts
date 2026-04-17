// Interim typed fetch wrapper for team-management endpoints.
// TODO: once backend boots locally, run `pnpm run generate:api` and replace
// these calls with generated SDK functions from @/lib/api-generated.

export interface TeamEvent {
  id: number;
  race_id: string | null;
  event_name: string;
  description: string | null;
  location: string | null;
  location_lat: string | null;
  location_lng: string | null;
  checkin_radius_m: number;
  event_start_date: string;
  event_end_date: string;
  registration_open: string;
  registration_close: string;
  status: "draft" | "open" | "closed" | "completed";
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamRole {
  id: number;
  event_id: number;
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
}

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
}

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

export async function updateTeamEvent(
  token: string,
  id: number,
  patch: Partial<CreateEventInput & { status: "draft" | "open" | "closed" | "completed" }>,
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

export interface ContractTemplate {
  id: number;
  template_name: string;
  content_html: string;
  variables: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
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
}

export interface RegistrationDetail extends RegistrationListRow {
  cccd_photo_url: string | null;
  event_name: string;
  checkin_method: string | null;
  contract_signed_at: string | null;
  contract_pdf_url: string | null;
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
): Promise<{ data: RegistrationListRow[]; total: number }> {
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

export async function bulkUpdateRegistrations(
  token: string,
  payload: { ids: number[]; status: string; notes?: string },
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

export async function sendContracts(
  token: string,
  roleId: number,
  dryRun = false,
): Promise<{ queued: number; already_sent: number; skipped: number }> {
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
];
