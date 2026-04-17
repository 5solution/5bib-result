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
  daily_rate: number;
  working_days: number;
  form_fields: FormFieldConfig[];
  sort_order: number;
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
    key: "avatar_photo",
    label: "Ảnh đại diện",
    type: "photo",
    required: true,
    hint: "Ảnh chân dung rõ mặt",
  },
  {
    key: "cccd_photo",
    label: "Ảnh CCCD/CMND",
    type: "photo",
    required: true,
    hint: "Chụp rõ mặt CCCD",
  },
  {
    key: "experience",
    label: "Kinh nghiệm tình nguyện",
    type: "textarea",
    required: false,
  },
];
