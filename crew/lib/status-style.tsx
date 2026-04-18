/**
 * Crew portal — Display Status System
 * Mirror of admin status-style. Kept full set so shared behaviors stay in sync
 * if we ever show contract/checkin badges to volunteers on the status page.
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

/** v1.4 backend emits the 10-state enum directly. Legacy "pending" is
 *  coerced for rows predating the migration. */
export function deriveStatusKey(reg: { status: string }): DisplayStatusKey {
  if (reg.status === "pending") return "pending_approval";
  if (VALID_KEYS.has(reg.status as DisplayStatusKey)) {
    return reg.status as DisplayStatusKey;
  }
  return "pending_approval";
}

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
