/**
 * F-062 Wave 1 Foundation (BR-SA-17 v3) — Vietnamese label dictionary cho analytics module.
 *
 * Centralized mapping enum/technical value → user-facing Vietnamese label.
 * Display Convention (CLAUDE.md): KHÔNG render raw enum/snake_case cho user.
 *
 * Pattern usage:
 *   import { ORDER_TYPE_LABEL, MERCHANT_STATUS_LABEL } from '@/lib/analytics-labels';
 *   <Badge>{ORDER_TYPE_LABEL[type] ?? type}</Badge>
 *
 * Fallback to raw value (`?? type`) so dev catches missing label trong DevTools.
 */

// ────────────────────────────────────────────────────────────────────
// Order categories (BR-SA-19 — 6 categories trong donut chart)
// ────────────────────────────────────────────────────────────────────

export const ORDER_TYPE_LABEL = {
  ORDINARY: 'Thường',
  MANUAL: 'Thủ công',
  GROUP_BUY: 'Mua nhóm',
  PERSONAL_GROUP: 'Nhóm cá nhân',
  CHANGE_COURSE: 'Đổi cự ly',
  INSURANCE: 'Bảo hiểm',
} as const satisfies Record<string, string>;

export type OrderType = keyof typeof ORDER_TYPE_LABEL;

// ────────────────────────────────────────────────────────────────────
// Merchant status + health tier (BR-SA-07 5-tier)
// ────────────────────────────────────────────────────────────────────

export const MERCHANT_STATUS_LABEL = {
  ACTIVE: 'Hoạt động',
  AT_RISK: 'Có nguy cơ',
  CHURNED: 'Đã rời',
  NEW: 'Mới',
  ALERT: 'Bất thường',
} as const satisfies Record<string, string>;

export type MerchantStatus = keyof typeof MERCHANT_STATUS_LABEL;

export const HEALTH_TIER_LABEL = {
  EXCELLENT: 'Xuất sắc',
  GOOD: 'Tốt',
  AVERAGE: 'Trung bình',
  WEAK: 'Yếu',
  AT_RISK_SCORE: 'Nguy cơ',
} as const satisfies Record<string, string>;

export type HealthTier = keyof typeof HEALTH_TIER_LABEL;

/**
 * Health tier color tokens — map sang 5Solution brand tokens (Manager Adjustment #5 v3).
 * Tránh hardcode `text-blue-600` Tailwind default.
 */
export const HEALTH_TIER_COLOR = {
  EXCELLENT: 'var(--5bib-success)', // #166534 green
  GOOD: 'var(--5s-blue)', // #1D49FF — 5Solution brand blue (NOT Tailwind blue-600)
  AVERAGE: '#f59e0b', // amber-500
  WEAK: '#f97316', // orange-500
  AT_RISK_SCORE: '#ef4444', // red-500
} as const satisfies Record<HealthTier, string>;

// ────────────────────────────────────────────────────────────────────
// Alert type + severity (BR-SA-06 races-need-attention)
// ────────────────────────────────────────────────────────────────────

export const ALERT_TYPE_LABEL = {
  LOW_FILL_RATE: 'Tỷ lệ bán thấp',
  ORDER_DROP: 'Đơn hàng giảm mạnh',
  STAGNANT: 'Đình trệ',
} as const satisfies Record<string, string>;

export type AlertType = keyof typeof ALERT_TYPE_LABEL;

export const ALERT_SEVERITY_LABEL = {
  WARNING: 'Cảnh báo',
  CRITICAL: 'Nghiêm trọng',
} as const satisfies Record<string, string>;

export type AlertSeverity = keyof typeof ALERT_SEVERITY_LABEL;

// ────────────────────────────────────────────────────────────────────
// Race type (BR-SA-21 — Tab 2 Hiệu suất Race)
// ────────────────────────────────────────────────────────────────────

export const RACE_TYPE_LABEL = {
  ROAD_MARATHON: 'Marathon đường bộ',
  ROAD_HALF_MARATHON: 'Bán Marathon đường bộ',
  ULTRA_TRAIL_RACE: 'Ultra Trail',
  TRAIL_RACE: 'Trail',
} as const satisfies Record<string, string>;

export type RaceType = keyof typeof RACE_TYPE_LABEL;

// ────────────────────────────────────────────────────────────────────
// Period / Granularity / Compare (BR-SA-01 v3 — 3 enum riêng)
// ────────────────────────────────────────────────────────────────────

export const PERIOD_LABEL = {
  '7d': '7 ngày qua',
  '30d': '30 ngày qua',
  quarter: 'Quý này',
  year: 'Năm nay',
  rolling12m: '12 tháng rolling',
  custom: 'Tuỳ chỉnh',
} as const satisfies Record<string, string>;

export type PeriodKind = keyof typeof PERIOD_LABEL;

export const GRANULARITY_LABEL = {
  daily: 'Ngày',
  weekly: 'Tuần',
  monthly: 'Tháng',
} as const satisfies Record<string, string>;

export type GranularityKind = keyof typeof GRANULARITY_LABEL;

export const COMPARE_LABEL = {
  none: 'Không so sánh',
  prev: 'Kỳ trước',
  wow: 'Tuần trước (WoW)',
  mom: 'Tháng trước (MoM)',
  yoy: 'Cùng kỳ năm trước (YoY)',
} as const satisfies Record<string, string>;

export type CompareKind = keyof typeof COMPARE_LABEL;

// ────────────────────────────────────────────────────────────────────
// Funnel stages (BR-SA-09 — 5-stage upgrade)
// ────────────────────────────────────────────────────────────────────

export const FUNNEL_STAGE_LABEL = {
  created: 'Khởi tạo',
  paid: 'Đã thanh toán',
  completed: 'Hoàn thành',
  cancelled: 'Bị hủy',
  refunded: 'Refunded',
} as const satisfies Record<string, string>;

export type FunnelStage = keyof typeof FUNNEL_STAGE_LABEL;

// ────────────────────────────────────────────────────────────────────
// Lead time buckets (BR-SA-20b — Runner behavior)
// ────────────────────────────────────────────────────────────────────

export const LEAD_TIME_BUCKET_LABEL = {
  '0-7': 'Last-minute',
  '8-30': 'Cận race',
  '31-60': 'Lập kế hoạch',
  '61-120': 'Early bird',
  '120+': 'Super early',
} as const satisfies Record<string, string>;

export type LeadTimeBucket = keyof typeof LEAD_TIME_BUCKET_LABEL;

export const LEAD_TIME_BUCKET_COLOR = {
  '0-7': '#f87171', // red-400
  '8-30': '#fbbf24', // amber-400
  '31-60': '#60a5fa', // blue-400
  '61-120': '#4ade80', // green-400
  '120+': '#c084fc', // purple-400
} as const satisfies Record<LeadTimeBucket, string>;

// ────────────────────────────────────────────────────────────────────
// Day of week labels cho heatmap (BR-SA-20a — Booking heatmap)
// ────────────────────────────────────────────────────────────────────

export const DAY_OF_WEEK_LABEL = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

// ────────────────────────────────────────────────────────────────────
// Gender (BR-SA-20d — Demographics)
// ────────────────────────────────────────────────────────────────────

export const GENDER_LABEL = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
  unknown: 'Không rõ',
} as const satisfies Record<string, string>;

export type Gender = keyof typeof GENDER_LABEL;

// ────────────────────────────────────────────────────────────────────
// Repeat cohort tiers (BR-SA-20c — Runner cohort)
// ────────────────────────────────────────────────────────────────────

export const REPEAT_COHORT_TIER_LABEL = {
  '1': '1 giải',
  '2': '2 giải',
  '3-4': '3-4 giải',
  '5+': '5+ giải',
} as const satisfies Record<string, string>;

export type RepeatCohortTier = keyof typeof REPEAT_COHORT_TIER_LABEL;

// ────────────────────────────────────────────────────────────────────
// Error messages (BR-SA-16 — Tiếng Việt)
// ────────────────────────────────────────────────────────────────────

export const ERROR_MESSAGE = {
  // Numeric-prefix keys must be quoted (TS strict mode reject bare 400_X identifiers)
  GENERIC_400: (detail?: string) =>
    detail ? `Tham số không hợp lệ: ${detail}` : 'Tham số không hợp lệ',
  DATE_RANGE_400: 'Phạm vi thời gian không được vượt quá 366 ngày',
  EXPORT_TOO_LARGE_400: (max = 10000) =>
    `Dữ liệu quá lớn (>${max} dòng), vui lòng thu hẹp phạm vi thời gian`,
  UNAUTH_401: 'Chưa đăng nhập hoặc token hết hạn',
  FORBIDDEN_403: 'Không có quyền truy cập chức năng này',
  SERVER_500: 'Lỗi hệ thống, vui lòng thử lại sau',
  GA4_UNAVAILABLE: 'GA4 chưa được cấu hình hoặc tạm thời không khả dụng',
} as const;

// ────────────────────────────────────────────────────────────────────
// Generic helper — safe lookup với fallback
// ────────────────────────────────────────────────────────────────────

/**
 * Type-safe label lookup helper với fallback to raw key.
 * Usage: `labelOr(ORDER_TYPE_LABEL, value, value)` — fallback raw value khi dict miss.
 */
export function labelOr<T extends Record<string, string>>(
  dict: T,
  key: string | undefined | null,
  fallback = '—',
): string {
  if (key == null) return fallback;
  return dict[key] ?? fallback;
}
