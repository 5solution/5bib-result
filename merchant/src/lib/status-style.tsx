/**
 * Team Management — Display Status System
 *
 * Source of truth for status colors + labels across admin. Per DesignCorrection v2
 * spec: action-based semantic palette (amber=needs action, blue=in-progress,
 * green=done, violet=completed, red=problem, gray=inactive).
 *
 * Backend registration entity has a simple `status` enum
 * (pending|approved|waitlisted|rejected|cancelled) plus `contract_status`,
 * `checked_in_at`, and `payment_status` sub-states. `deriveStatusKey` fans
 * these out into finer-grained UI keys so admin can see the "most advanced"
 * meaningful state for a row at a glance.
 */

import type { ReactElement } from "react";

export type DisplayStatusKey =
  | "pending_approval"
  | "approved"
  | "contract_sent"
  | "contract_signed"
  | "qr_sent"
  | "checked_in"
  | "completed"
  | "waitlisted"
  | "rejected"
  | "cancelled";

export const STATUS_STYLE: Record<
  DisplayStatusKey,
  { label: string; bg: string; text: string; border: string }
> = {
  pending_approval: {
    label: "Chờ duyệt",
    bg: "#fef3c7",
    text: "#b45309",
    border: "#fcd34d",
  },
  approved: {
    label: "Đã duyệt",
    bg: "#dcfce7",
    text: "#15803d",
    border: "#86efac",
  },
  contract_sent: {
    label: "Chờ ký HĐ",
    bg: "#dbeafe",
    text: "#1d4ed8",
    border: "#93c5fd",
  },
  contract_signed: {
    label: "Đã ký HĐ",
    bg: "#d1fae5",
    text: "#065f46",
    border: "#6ee7b7",
  },
  qr_sent: {
    label: "Có QR",
    bg: "#eff6ff",
    text: "#2563eb",
    border: "#bfdbfe",
  },
  checked_in: {
    label: "Đã check-in",
    bg: "#1d4ed8",
    text: "#ffffff",
    border: "transparent",
  },
  completed: {
    label: "Hoàn thành",
    bg: "#ede9fe",
    text: "#5b21b6",
    border: "#c4b5fd",
  },
  waitlisted: {
    label: "Waitlist",
    bg: "#f3f4f6",
    text: "#6b7280",
    border: "#d1d5db",
  },
  rejected: {
    label: "Từ chối",
    bg: "#fee2e2",
    text: "#b91c1c",
    border: "#fca5a5",
  },
  cancelled: {
    label: "Đã hủy",
    bg: "#f3f4f6",
    text: "#9ca3af",
    border: "#e5e7eb",
  },
};

const VALID_KEYS = new Set<DisplayStatusKey>([
  "pending_approval",
  "approved",
  "contract_sent",
  "contract_signed",
  "qr_sent",
  "checked_in",
  "completed",
  "waitlisted",
  "rejected",
  "cancelled",
]);

/**
 * Map backend registration fields → a single display status key.
 *
 * v1.4 backend emits the 10-state enum directly (pending_approval,
 * approved, contract_sent, contract_signed, qr_sent, checked_in,
 * completed, waitlisted, rejected, cancelled). Legacy "pending" is
 * coerced to "pending_approval" for rows that predate the migration.
 */
export function deriveStatusKey(reg: {
  status: string;
}): DisplayStatusKey {
  if (reg.status === "pending") return "pending_approval";
  if (VALID_KEYS.has(reg.status as DisplayStatusKey)) {
    return reg.status as DisplayStatusKey;
  }
  return "pending_approval";
}

/**
 * All actionable states (ordered by funnel stage). Used for filter
 * tab rendering + context-sensitive action buttons.
 */
export const STATUS_FUNNEL: DisplayStatusKey[] = [
  "pending_approval",
  "approved",
  "contract_sent",
  "contract_signed",
  "qr_sent",
  "checked_in",
  "completed",
  "waitlisted",
  "rejected",
  "cancelled",
];

export function StatusBadge({
  status,
}: {
  status: DisplayStatusKey;
}): ReactElement {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {s.label}
    </span>
  );
}
