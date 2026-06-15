/**
 * FEATURE-085 — Dictionary VN cho Igloo Insurance (Display Convention).
 * KHÔNG render raw enum trong JSX text — luôn map qua đây (fallback raw để dev
 * nhận biết enum mới).
 */

export const IGLOO_STATUS_LABEL: Record<string, string> = {
  QUEUED: "Chờ gửi",
  PENDING: "Đang xử lý",
  PROCESSING: "Đang xử lý (GIC)",
  GET_CERTI_PROCESSING: "Đang lấy chứng nhận",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã huỷ",
};

/** Màu badge theo trạng thái (tailwind class). */
export const IGLOO_STATUS_TONE: Record<string, string> = {
  QUEUED: "bg-stone-100 text-stone-700",
  PENDING: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  GET_CERTI_PROCESSING: "bg-indigo-100 text-indigo-700",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-stone-200 text-stone-600",
};

export const IGLOO_PACKAGE_LABEL: Record<string, string> = {
  ROAD: "Đường trường (Road)",
  TRAIL: "Địa hình (Trail)",
};

export const IGLOO_SOURCE_LABEL: Record<string, string> = {
  cron: "Tự động",
  manual: "Thủ công",
};

export const IGLOO_SKIP_REASON_LABEL: Record<string, string> = {
  ALREADY_HAS_ORDER: "Đã có đơn",
  NOT_ELIGIBLE: "Không đủ điều kiện",
};

export function statusLabel(s: string): string {
  return IGLOO_STATUS_LABEL[s] ?? s;
}
export function packageLabel(s: string): string {
  return IGLOO_PACKAGE_LABEL[s] ?? s;
}
export function sourceLabel(s: string): string {
  return IGLOO_SOURCE_LABEL[s] ?? s;
}

/** Format VNĐ. */
export function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}
