const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export interface PublicRoleSummary {
  id: number;
  role_name: string;
  description?: string;
  max_slots: number;
  filled_slots: number;
  is_full: boolean;
  waitlist_enabled: boolean;
  daily_rate: number;
  working_days: number;
  form_fields: FormFieldConfig[];
}

export interface PublicEvent {
  id: number;
  event_name: string;
  description: string | null;
  location: string | null;
  event_start_date: string;
  event_end_date: string;
  registration_open: string;
  registration_close: string;
  benefits_image_url?: string | null;
  terms_conditions?: string | null;
  roles: PublicRoleSummary[];
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

export interface StatusResponse {
  full_name: string;
  role_name: string;
  event_name: string;
  status: string;
  waitlist_position: number | null;
  contract_status: string;
  checked_in_at: string | null;
  qr_code: string | null;
  // v1.4.1 — profile-edit fields (optional so older backends don't break).
  email?: string;
  phone?: string;
  avatar_photo_url?: string | null;
  // v037+ — surfaced so crew portal can compute "missing profile" banner.
  cccd_photo_url?: string | null;
  cccd_back_photo_url?: string | null;
  birth_date?: string | null;
  cccd_issue_date?: string | null;
  cccd_issue_place?: string | null;
  form_data?: Record<string, unknown>;
  form_fields?: FormFieldConfig[];
  has_pending_changes?: boolean;
  pending_changes_submitted_at?: string | null;
  pending_changes?: Record<string, unknown> | null;
  // v1.5 — group chat hint. `chat_platform` always exposed (may be null
  // if admin hasn't picked a platform). `chat_group_url` is gated backend-side:
  // only filled when registration status ∈ {contract_signed, qr_sent,
  // checked_in, completed}, else null.
  chat_platform?: "zalo" | "telegram" | "whatsapp" | "other" | null;
  chat_group_url?: string | null;
  // v2.0 — Acceptance (biên bản nghiệm thu) + payment surfacing.
  // `acceptance_notes` is only populated when status='disputed'.
  acceptance_status?: "not_ready" | "pending_sign" | "signed" | "disputed";
  acceptance_sent_at?: string | null;
  acceptance_signed_at?: string | null;
  acceptance_value?: number | null;
  acceptance_notes?: string | null;
  payment_status?: "pending" | "paid";
}

export interface UpdateProfilePatch {
  full_name?: string;
  phone?: string;
  form_data?: Record<string, unknown>;
}

export interface UpdateProfileResponse {
  outcome: "applied" | "pending_admin_approval";
  message: string;
  pending_changes_submitted_at: string | null;
}

export interface RegisterResponse {
  id: number;
  status: "approved" | "waitlisted";
  waitlist_position: number | null;
  message: string;
  magic_link: string;
}

export interface ContractView {
  html_content: string;
  already_signed: boolean;
  signed_at: string | null;
  pdf_url: string | null;
  full_name: string;
}

export interface CheckinResponse {
  success: true;
  full_name: string;
  role_name: string;
  checked_in_at: string;
  method: "qr_scan" | "gps_verify";
}

// Server-side fetch — server components only.
export async function listPublicEvents(): Promise<PublicEvent[]> {
  const res = await fetch(`${BACKEND_URL}/api/public/team-events`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load events: HTTP ${res.status}`);
  return res.json() as Promise<PublicEvent[]>;
}

export async function getPublicEvent(id: number): Promise<PublicEvent> {
  const res = await fetch(`${BACKEND_URL}/api/public/team-events/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load event: HTTP ${res.status}`);
  return res.json() as Promise<PublicEvent>;
}

export async function getStatus(token: string): Promise<StatusResponse> {
  const res = await fetch(`${BACKEND_URL}/api/public/team-status/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<StatusResponse>;
}

/**
 * v1.4.1 — submit profile edits from the crew site. Runs browser-side
 * (no BACKEND_URL needed since we hit the /api proxy).
 */
export async function updateProfile(
  token: string,
  patch: UpdateProfilePatch,
): Promise<UpdateProfileResponse> {
  const res = await fetch(`/api/public/team-registration/${token}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const m = body?.message;
    throw new Error(Array.isArray(m) ? m.join("; ") : (m ?? `HTTP ${res.status}`));
  }
  return res.json() as Promise<UpdateProfileResponse>;
}

export async function getContract(token: string): Promise<ContractView> {
  const res = await fetch(`${BACKEND_URL}/api/public/team-contract/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ContractView>;
}

// ---- v2.0 Acceptance (Biên bản nghiệm thu) ----

export interface AcceptanceView {
  html_content: string;
  acceptance_status: "not_ready" | "pending_sign" | "signed" | "disputed";
  signed_at: string | null;
  pdf_url: string | null;
  full_name: string;
  contract_number: string;
  acceptance_value: number;
  notes: string | null;
}

export async function getAcceptance(token: string): Promise<AcceptanceView> {
  const res = await fetch(
    `${BACKEND_URL}/api/public/team-acceptance/${token}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<AcceptanceView>;
}

// ---- Magic-link recovery (browser-only, hits /api proxy) ----

export interface RecoveredRegistration {
  event_id: number;
  event_name: string;
  role_name: string;
  full_name: string;
  status: string;
  magic_link: string;
}

export interface RequestRecoverResponse {
  ok: true;
  sent_to: string;
}

export async function requestRecoverOtp(
  email: string,
  turnstileToken: string,
): Promise<RequestRecoverResponse> {
  const res = await fetch(`/api/public/recover/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, turnstile_token: turnstileToken }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const m = body?.message;
    throw new Error(Array.isArray(m) ? m.join("; ") : (m ?? `HTTP ${res.status}`));
  }
  return res.json() as Promise<RequestRecoverResponse>;
}

export async function verifyRecoverOtp(
  email: string,
  otp: string,
): Promise<{ registrations: RecoveredRegistration[] }> {
  const res = await fetch(`/api/public/recover/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const m = body?.message;
    throw new Error(Array.isArray(m) ? m.join("; ") : (m ?? `HTTP ${res.status}`));
  }
  return res.json() as Promise<{ registrations: RecoveredRegistration[] }>;
}
