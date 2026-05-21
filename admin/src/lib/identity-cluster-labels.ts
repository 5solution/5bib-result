/**
 * F-049 — Identity Cluster VN business-language dictionary.
 *
 * Per `CLAUDE.md` Display Convention: KHÔNG render raw enum/snake_case cho user.
 * Backend giữ source enum + raw confidence — frontend map sang nhãn business VN.
 *
 * Schema reality (Manager clarification #1): backend KHÔNG có `tier` field —
 * tier là DERIVED từ `source` + `confidence`. Helper `deriveTier()` below.
 */

import type { ComponentProps } from "react";
import type { Badge } from "@/components/ui/badge";

export type Tier = "T1" | "T2" | "T3" | "T4";

export type ClusterSource =
  | "email"
  | "name+dob"
  | "name+gender"
  | "manual"
  | "review_pending";

export type ClusterStatus = "active" | "merged" | "split";

/** Cluster shape from backend admin list endpoint — only fields needed for derivation. */
export interface ClusterSummaryForTier {
  source: ClusterSource | string;
  confidence: number;
}

/**
 * F-049 + Manager Clarification #1 — derive Tier from source + confidence.
 * Backend KHÔNG store tier field; this is the canonical FE mapping.
 */
export function deriveTier(cluster: ClusterSummaryForTier): Tier {
  if (cluster.source === "manual" && cluster.confidence >= 0.9) return "T1";
  if (cluster.source === "email" || cluster.confidence >= 0.9) return "T1";
  if (cluster.source === "name+dob" || cluster.confidence >= 0.8) return "T2";
  if (
    cluster.source === "name+gender" ||
    cluster.source === "review_pending"
  ) {
    // T3 if has confidence ≥ 0.5, else T4 anonymous
    return cluster.confidence >= 0.5 ? "T3" : "T4";
  }
  return "T4";
}

// ────────────────────────────────────────────────────────────────────────────
// Tier — VN business labels (BR-49-04)
// ────────────────────────────────────────────────────────────────────────────

export const TIER_LABEL: Record<Tier, string> = {
  T1: "Định danh qua email — Tin cậy cao",
  T2: "Định danh qua Tên + Năm sinh + Giới tính — Tin cậy trung bình",
  T3: "Cần xem xét lại — Tin cậy thấp",
  T4: "Không định danh được",
};

/** Short label cho badge nhỏ / dropdown filter. */
export const TIER_SHORT_LABEL: Record<Tier, string> = {
  T1: "Tin cậy cao",
  T2: "Trung bình",
  T3: "Cần xem xét",
  T4: "Không định danh",
};

// ────────────────────────────────────────────────────────────────────────────
// Confidence Badge variants (BR-49-03 — traffic light)
// Available Badge variants in admin: gray / blue / green / amber / red / violet / dark
// + default / secondary / destructive / outline / ghost / link
// ────────────────────────────────────────────────────────────────────────────

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

/**
 * Traffic-light Badge variant for confidence number.
 *   ≥ 0.9 → green  (Tin cậy cao)
 *   0.6–0.9 → amber (Tin cậy trung bình)
 *   0.1–0.6 → red  (Cần xem xét)
 *   < 0.1 → gray (Không định danh)
 */
export function confidenceBadgeVariant(conf: number): BadgeVariant {
  if (conf >= 0.9) return "green";
  if (conf >= 0.6) return "amber";
  if (conf >= 0.1) return "red";
  return "gray";
}

export function confidenceLabel(conf: number): string {
  if (conf >= 0.9) return "Tin cậy cao";
  if (conf >= 0.6) return "Tin cậy trung bình";
  if (conf >= 0.1) return "Cần xem xét";
  return "Không xác định";
}

/** Tier → Badge variant alignment (same color as confidenceBadgeVariant). */
export const TIER_BADGE_VARIANT: Record<Tier, BadgeVariant> = {
  T1: "green",
  T2: "amber",
  T3: "red",
  T4: "gray",
};

// ────────────────────────────────────────────────────────────────────────────
// Status — VN labels
// ────────────────────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<ClusterStatus, string> = {
  active: "Hoạt động",
  merged: "Đã hợp nhất",
  split: "Đã phân tách",
};

// ────────────────────────────────────────────────────────────────────────────
// Source — VN labels (for tech-mode + raw debug display)
// ────────────────────────────────────────────────────────────────────────────

export const SOURCE_LABEL: Record<ClusterSource, string> = {
  email: "Email khớp chính xác",
  "name+dob": "Tên + Năm sinh + Giới tính",
  "name+gender": "Tên + Giới tính",
  manual: "Hợp nhất thủ công",
  review_pending: "Chờ xem xét",
};

export function formatSource(s: string | null | undefined): string {
  if (!s) return "—";
  return SOURCE_LABEL[s as ClusterSource] ?? s;
}

// ────────────────────────────────────────────────────────────────────────────
// Tier filter dropdown — VN labels mapped to backend `source` query param
// (Manager Clarification #2 — backend filter is `?source=`, not `?tier=`)
// ────────────────────────────────────────────────────────────────────────────

export type TierFilterValue = "all" | "T1" | "T2" | "T3" | "T4";

export interface TierFilterOption {
  value: TierFilterValue;
  label: string;
  /** Backend `source` query param mapping (null = no filter, fetch all). */
  sourceParam: ClusterSource | null;
}

export const TIER_FILTER_OPTIONS: TierFilterOption[] = [
  { value: "all", label: "Tất cả tier", sourceParam: null },
  { value: "T1", label: "Tin cậy cao (T1)", sourceParam: "email" },
  { value: "T2", label: "Trung bình (T2)", sourceParam: "name+dob" },
  { value: "T3", label: "Cần xem xét (T3)", sourceParam: "review_pending" },
  // T4 = anonymous → no direct source filter, fetch by review_pending + confidence=0
  // For MVP, share with T3 → user filters again via confidence client-side
  { value: "T4", label: "Không định danh (T4)", sourceParam: "review_pending" },
];

export function tierFilterToSourceParam(
  value: TierFilterValue,
): ClusterSource | null {
  return TIER_FILTER_OPTIONS.find((o) => o.value === value)?.sourceParam ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// Action labels (BR-49-05)
// ────────────────────────────────────────────────────────────────────────────

export const ACTION_LABEL = {
  split: "Phân tách hồ sơ",
  merge: "Hợp nhất với hồ sơ khác",
  splitOneRecord: "Phân tách bản ghi này",
  viewDetail: "Xem chi tiết",
  copyId: "Sao chép ID",
  cancel: "Huỷ",
  confirmSplit: "Xác nhận phân tách",
  confirmMerge: "Xác nhận hợp nhất",
  backToList: "Quay lại danh sách",
  showTech: "Hiển thị thông tin kỹ thuật",
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Gender labels
// ────────────────────────────────────────────────────────────────────────────

export const GENDER_LABEL: Record<"male" | "female" | "other", string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

export function formatGender(g: string | null | undefined): string {
  if (!g) return "—";
  return GENDER_LABEL[g as keyof typeof GENDER_LABEL] ?? g;
}

// ────────────────────────────────────────────────────────────────────────────
// Cluster ID truncate + copy helpers (BR-49-01 + BR-49-18)
// ────────────────────────────────────────────────────────────────────────────

/** Truncate UUID to first 8 hex chars prefixed with `#`. */
export function truncateClusterId(clusterId: string): string {
  return `#${clusterId.substring(0, 8)}`;
}

/** Truncate race name to N chars with ellipsis (default 40 per BR-49-07). */
export function truncateRaceName(name: string | undefined, max = 40): string {
  if (!name) return "—";
  if (name.length <= max) return name;
  return name.substring(0, max).trimEnd() + "…";
}
