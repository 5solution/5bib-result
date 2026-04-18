// Local types for v1.5 Emergency Contacts admin UI.
// Decoupled from admin/src/lib/team-api.ts so that if the backend agent's SDK
// helpers land later, we can refactor this file without blocking build.

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
  created_at?: string;
}

export interface UpsertContactInput {
  contact_type: ContactType;
  contact_name: string;
  phone: string;
  phone2?: string | null;
  note?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface ContactTypeMeta {
  value: ContactType;
  label: string;
  icon: string;
  // Tailwind-safe semantic colors for admin view.
  color: string;
  bg: string;
  border: string;
}

export const CONTACT_TYPE_META: Record<ContactType, ContactTypeMeta> = {
  medical: {
    value: "medical",
    label: "Y tế",
    icon: "🏥",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fca5a5",
  },
  rescue: {
    value: "rescue",
    label: "Cứu hộ",
    icon: "🚨",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fcd34d",
  },
  police: {
    value: "police",
    label: "Công an",
    icon: "👮",
    color: "#374151",
    bg: "#f9fafb",
    border: "#d1d5db",
  },
  btc: {
    value: "btc",
    label: "Ban Tổ Chức",
    icon: "📋",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  other: {
    value: "other",
    label: "Khác",
    icon: "📞",
    color: "#6b7280",
    bg: "#f3f4f6",
    border: "#e5e7eb",
  },
};

// Display order on the admin page — mirrors spec v1.5 Thay đổi 3.
export const CONTACT_TYPE_ORDER: ContactType[] = [
  "medical",
  "rescue",
  "police",
  "btc",
  "other",
];

export const CONTACT_TYPE_OPTIONS: ContactTypeMeta[] = CONTACT_TYPE_ORDER.map(
  (t) => CONTACT_TYPE_META[t],
);
