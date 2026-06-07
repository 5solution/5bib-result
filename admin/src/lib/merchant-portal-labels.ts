/**
 * F-069 M3 Display Labels — central dictionary tiếng Việt cho Merchant Portal.
 *
 * Backend trả enum gốc (`ticket_report` / `revenue_report` / `active` / ...) —
 * KHÔNG đổi. Frontend map qua dictionary này TRƯỚC khi render cho user theo
 * Display Convention (CLAUDE.md "KHÔNG render raw enum/snake_case cho user").
 *
 * Pattern:
 *   import { formatPermission } from "@/lib/merchant-portal-labels";
 *   <Badge>{formatPermission(p)}</Badge>           // "Báo cáo doanh thu"
 * Fallback raw để dev nhận biết miss dictionary:
 *   {MP_PERMISSION_LABEL[p] ?? p}
 */

import type { CreateAccessConfigDto } from "./api-generated/types.gen";

/** Permission enum derived từ generated SDK (single source of truth). */
export type MerchantPortalPermission = CreateAccessConfigDto["permissions"][number];

// ────────────────────────────────────────────────────────────────────────────
// Permission (BR-MP-04 — enum 'ticket_report' | 'revenue_report')
// ────────────────────────────────────────────────────────────────────────────

export const MP_PERMISSION_LABEL: Record<MerchantPortalPermission, string> = {
  ticket_report: "Báo cáo vé",
  revenue_report: "Báo cáo doanh thu",
};

export function formatPermission(p: string | null | undefined): string {
  if (!p) return "—";
  return MP_PERMISSION_LABEL[p as MerchantPortalPermission] ?? p;
}

/**
 * Mô tả ngắn permission cho UI form toggle.
 */
export const MP_PERMISSION_DESC: Record<MerchantPortalPermission, string> = {
  ticket_report: "Xem báo cáo bán vé (số lượng, theo cự ly, theo loại vé).",
  revenue_report:
    "Xem báo cáo doanh thu, phí, lợi nhuận ròng và xuất Excel (quyền tài chính).",
};

// ────────────────────────────────────────────────────────────────────────────
// Permission tier filter (list query — 'ticket_only' | 'ticket_and_revenue')
// ────────────────────────────────────────────────────────────────────────────

export type MerchantPermissionTier = "ticket_only" | "ticket_and_revenue";

export const MP_PERMISSION_TIER_LABEL: Record<MerchantPermissionTier, string> = {
  ticket_only: "Chỉ báo cáo vé",
  ticket_and_revenue: "Vé + Doanh thu",
};

export function formatPermissionTier(t: string | null | undefined): string {
  if (!t) return "—";
  return MP_PERMISSION_TIER_LABEL[t as MerchantPermissionTier] ?? t;
}

// ────────────────────────────────────────────────────────────────────────────
// Active status
// ────────────────────────────────────────────────────────────────────────────

export type MerchantStatusKey = "active" | "inactive";

export const MP_STATUS_LABEL: Record<MerchantStatusKey, string> = {
  active: "Đang hoạt động",
  inactive: "Đã khóa",
};

export function formatMerchantStatus(s: string | null | undefined): string {
  if (!s) return "—";
  return MP_STATUS_LABEL[s as MerchantStatusKey] ?? s;
}

/** Map boolean isActive → key cho badge. */
export function statusKeyFromActive(isActive: boolean): MerchantStatusKey {
  return isActive ? "active" : "inactive";
}

// ────────────────────────────────────────────────────────────────────────────
// Race count sentinel (BR-MP — '__all' = tất cả giải của tenant)
// ────────────────────────────────────────────────────────────────────────────

/**
 * raceCount từ backend là `number | '__all'`. Generated SDK emit union này thành
 * object type (OpenAPI quirk) nên nhận `unknown` + narrow tại chỗ, tránh cast.
 */
export function formatRaceCount(count: unknown): string {
  if (count === "__all") return "Tất cả giải";
  if (typeof count === "number") {
    return Number.isFinite(count) ? `${count} giải` : "—";
  }
  if (typeof count === "string") {
    const n = Number(count);
    return Number.isFinite(n) ? `${n} giải` : "—";
  }
  return "—";
}
