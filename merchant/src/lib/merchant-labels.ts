/**
 * F-069 M4 — Merchant Portal Display Labels (VN). Backend trả enum gốc, FE map VN.
 */

export const RACE_STATUS_LABEL: Record<string, string> = {
  COMPLETE: "Đã kết thúc",
  ONGOING: "Đang diễn ra",
  GENERATED_CODE: "Chuẩn bị",
  CANCEL: "Đã hủy",
};

export const FINANCIAL_STATUS_LABEL: Record<string, string> = {
  paid: "Đã thanh toán",
  voided: "Đã hủy",
  pending: "Chờ thanh toán",
};

export const PERMISSION_LABEL: Record<string, string> = {
  ticket_report: "Báo cáo vé",
  revenue_report: "Báo cáo doanh thu",
};

export const CATEGORY_GROUP_LABEL: Record<string, string> = {
  fee_percent: "Phí % (theo doanh thu)",
  fee_fixed: "Phí cố định / Thủ công (VNĐ/vé)",
};

export const PERIOD_LABEL: Record<string, string> = {
  "7d": "7 ngày",
  "30d": "30 ngày",
  "90d": "90 ngày",
  quarter: "Quý này",
  year: "Năm nay",
};

export function labelOf(
  dict: Record<string, string>,
  key: string | null | undefined,
): string {
  if (!key) return "—";
  return dict[key] ?? key;
}

/** vi-VN currency (VNĐ). */
export function fmtVnd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("vi-VN") + " ₫";
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("vi-VN");
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString("vi-VN");
}
