/**
 * F-028 Display Labels — central dictionary tiếng Việt.
 *
 * Mọi value technical (enum status, snake_case key, English label) PHẢI
 * map qua dictionary tiếng Việt trước khi render UI cho user. Backend giữ
 * enum value gốc — KHÔNG đổi (đã chuẩn hoá BR-CM-07 / BR-PNL-03).
 *
 * Pattern dùng:
 *   import { formatPeriod } from "@/lib/finance-labels";
 *   <span>{formatPeriod(period)}</span>     // "3 tháng gần nhất"
 *
 * Hoặc fallback raw để dev nhận biết khi miss dictionary:
 *   <Badge>{PERIOD_LABEL[k] ?? k}</Badge>
 *
 * Rule append vào CLAUDE.md "Display Convention" — KHÔNG render raw enum/
 * snake_case cho user.
 */

import type {
  CostCategory,
  DashboardPeriod,
  MarginTier,
  RevenueSource,
} from "@/lib/finance-api";

// ────────────────────────────────────────────────────────────────────────────
// Period preset
// ────────────────────────────────────────────────────────────────────────────

export const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  current_month: "Tháng này",
  last_3_months: "3 tháng gần nhất",
  last_6_months: "6 tháng gần nhất",
  last_12_months: "12 tháng gần nhất",
  ytd: "Năm hiện tại (YTD)",
  custom: "Tùy chỉnh…",
};

export function formatPeriod(p: string | null | undefined): string {
  if (!p) return "—";
  return PERIOD_LABEL[p as DashboardPeriod] ?? p;
}

// ────────────────────────────────────────────────────────────────────────────
// Cost category (Phase 1 BR-PNL-03 enum 5)
// ────────────────────────────────────────────────────────────────────────────

export const COST_CATEGORY_LABEL: Record<CostCategory, string> = {
  LABOR: "Nhân công",
  MATERIAL: "Vật tư",
  VENDOR: "Nhà cung cấp",
  OUTSOURCE: "Thuê ngoài",
  OTHER: "Khác",
};

export function formatCostCategory(c: string | null | undefined): string {
  if (!c) return "—";
  return COST_CATEGORY_LABEL[c as CostCategory] ?? c;
}

// ────────────────────────────────────────────────────────────────────────────
// Contract status (F-024 BR-CM-07)
// ────────────────────────────────────────────────────────────────────────────

export type ContractStatusKey =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "CONVERTED_TO_CONTRACT"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export const CONTRACT_STATUS_LABEL: Record<ContractStatusKey, string> = {
  DRAFT: "Nháp",
  SENT: "Đã gửi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Từ chối",
  CONVERTED_TO_CONTRACT: "Đã chuyển HĐ",
  ACTIVE: "Đang hiệu lực",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã huỷ",
};

export function formatContractStatus(s: string | null | undefined): string {
  if (!s) return "—";
  return CONTRACT_STATUS_LABEL[s as ContractStatusKey] ?? s;
}

// ────────────────────────────────────────────────────────────────────────────
// Contract type (F-024)
// ────────────────────────────────────────────────────────────────────────────

export type ContractTypeKey =
  | "TIMING"
  | "RACEKIT"
  | "OPERATIONS"
  | "TICKET_SALES";

export const CONTRACT_TYPE_LABEL: Record<ContractTypeKey, string> = {
  TIMING: "Tính giờ",
  RACEKIT: "Racekit",
  OPERATIONS: "Vận hành",
  TICKET_SALES: "Bán vé",
};

export function formatContractType(t: string | null | undefined): string {
  if (!t) return "—";
  return CONTRACT_TYPE_LABEL[t as ContractTypeKey] ?? t;
}

/** Liệt kê các loại "non-TICKET_SALES" thành chuỗi VN cho banner / hướng dẫn. */
export function joinNonTicketContractTypes(): string {
  return [
    CONTRACT_TYPE_LABEL.TIMING,
    CONTRACT_TYPE_LABEL.RACEKIT,
    CONTRACT_TYPE_LABEL.OPERATIONS,
  ].join(" / ");
}

// ────────────────────────────────────────────────────────────────────────────
// Provider (5BIB / 5SOLUTION legal entity)
// ────────────────────────────────────────────────────────────────────────────

export type ProviderKey = "5BIB" | "5SOLUTION";

export const PROVIDER_LABEL: Record<ProviderKey, string> = {
  "5BIB": "Công ty cổ phần 5BIB",
  "5SOLUTION": "Công ty cổ phần công nghệ 5Solution",
};

export function formatProvider(p: string | null | undefined): string {
  if (!p) return "—";
  return PROVIDER_LABEL[p as ProviderKey] ?? p;
}

// ────────────────────────────────────────────────────────────────────────────
// Revenue source (BR-PNL Phase 1)
// ────────────────────────────────────────────────────────────────────────────

export const REVENUE_SOURCE_LABEL: Record<RevenueSource, string> = {
  ACTUAL: "Thực tế",
  ESTIMATED: "Ước tính",
};

export function formatRevenueSource(
  r: string | null | undefined,
): string {
  if (!r) return "—";
  return REVENUE_SOURCE_LABEL[r as RevenueSource] ?? r;
}

// ────────────────────────────────────────────────────────────────────────────
// Margin tier
// ────────────────────────────────────────────────────────────────────────────

export const MARGIN_TIER_LABEL: Record<MarginTier, string> = {
  loss: "Lỗ",
  thin: "Mỏng",
  healthy: "Tốt",
  neutral: "—",
};

export function formatMarginTier(t: string | null | undefined): string {
  if (!t) return "—";
  return MARGIN_TIER_LABEL[t as MarginTier] ?? t;
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard groupBy (Phase 2 tabs)
// ────────────────────────────────────────────────────────────────────────────

export const GROUP_BY_LABEL: Record<string, string> = {
  month: "Theo thời gian",
  type: "Theo loại HĐ",
  partner: "Theo đối tác",
};

export function formatGroupBy(g: string | null | undefined): string {
  if (!g) return "—";
  return GROUP_BY_LABEL[g] ?? g;
}
