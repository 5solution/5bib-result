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
