/**
 * F-069 Merchant Portal — i18n dictionary + label maps (ported from
 * mp-data.jsx). UI chrome only; backend data (race / merchant names) is
 * never translated. VI is the default.
 */

export type Lang = "vi" | "en";

type Entry = { vi: string; en: string };
type Dict = Record<string, Entry>;

// ---- i18n dictionary (UI chrome only) ----
export const DICT: Dict = {
  // brand / chrome
  portal: { vi: "Cổng Đối tác", en: "Merchant Portal" },
  nav_races: { vi: "Giải chạy", en: "Races" },
  nav_tickets: { vi: "Bán vé", en: "Ticket Sales" },
  nav_revenue: { vi: "Doanh thu", en: "Revenue" },
  nav_settings: { vi: "Cài đặt", en: "Settings" },
  logout: { vi: "Đăng xuất", en: "Log out" },
  refresh: { vi: "Làm mới", en: "Refresh" },
  export_excel: { vi: "Xuất Excel", en: "Export Excel" },
  all_merchants: { vi: "Tất cả BTC", en: "All merchants" },
  select_merchant: { vi: "Chọn BTC", en: "Select merchant" },
  select_race: { vi: "Chọn giải", en: "Select race" },
  updated_at: { vi: "Cập nhật lúc", en: "Updated at" },

  // periods + granularity
  period: { vi: "Khoảng thời gian", en: "Time period" },
  last_7: { vi: "7 ngày qua", en: "Last 7 days" },
  last_30: { vi: "30 ngày qua", en: "Last 30 days" },
  last_90: { vi: "90 ngày qua", en: "Last 90 days" },
  custom: { vi: "Tùy chỉnh", en: "Custom" },
  daily: { vi: "Ngày", en: "Daily" },
  weekly: { vi: "Tuần", en: "Weekly" },
  monthly: { vi: "Tháng", en: "Monthly" },
  vs_prev: { vi: "so với kỳ trước", en: "vs previous period" },

  // login
  login_title: { vi: "Đăng nhập Cổng Đối tác", en: "Sign in to Merchant Portal" },
  login_sub: {
    vi: "Theo dõi bán vé & doanh thu giải chạy của bạn.",
    en: "Track ticket sales & revenue for your events.",
  },
  email: { vi: "Email", en: "Email" },
  password: { vi: "Mật khẩu", en: "Password" },
  remember: { vi: "Ghi nhớ đăng nhập", en: "Remember me" },
  forgot: { vi: "Quên mật khẩu?", en: "Forgot password?" },
  signin: { vi: "Đăng nhập", en: "Sign in" },
  signin_sso: { vi: "Đăng nhập bằng tài khoản 5BIB (SSO)", en: "Continue with 5BIB SSO" },
  or: { vi: "hoặc", en: "or" },
  secured_by: { vi: "Bảo mật bởi auth.5bib.com", en: "Secured by auth.5bib.com" },
  authenticating: { vi: "Đang xác thực…", en: "Authenticating…" },
  loading: { vi: "Đang tải…", en: "Loading…" },
  retry: { vi: "Thử lại", en: "Retry" },

  // race list
  your_races: { vi: "Giải chạy của bạn", en: "Your races" },
  races_count: { vi: "giải", en: "races" },
  tickets_sold: { vi: "vé đã bán", en: "tickets sold" },
  showing: { vi: "Hiển thị", en: "Showing" },
  view_report: { vi: "Xem báo cáo", en: "View report" },
  no_races_title: { vi: "Chưa có giải nào", en: "No races yet" },
  no_races_body: {
    vi: "Tài khoản của bạn chưa được gán giải nào. Liên hệ BTC/5BIB để được cấp quyền.",
    en: "Your account has no race assignments yet. Please contact your BTC / 5BIB admin.",
  },
  load_failed: { vi: "Không tải được dữ liệu", en: "Failed to load data" },
  all_races_link: { vi: "Tất cả giải", en: "All races" },

  // ticket sales
  ticket_report: { vi: "Báo cáo bán vé", en: "Ticket Sales Report" },
  all_races: { vi: "Tất cả giải", en: "All races" },
  kpi_total: { vi: "Tổng vé bán", en: "Total tickets" },
  kpi_paid: { vi: "Vé đã thanh toán", en: "Paid tickets" },
  kpi_pending: { vi: "Vé chờ xử lý", en: "Pending tickets" },
  kpi_cancelled: { vi: "Vé đã huỷ", en: "Cancelled tickets" },
  trend_reg: { vi: "Xu hướng đăng ký", en: "Registration trend" },
  by_course: { vi: "Theo cự ly", en: "By course" },
  by_ticket_type: { vi: "Theo loại vé", en: "By ticket type" },
  order_detail: { vi: "Chi tiết đơn hàng", en: "Order detail" },
  search_order: { vi: "Tìm mã đơn…", en: "Search order code…" },
  th_no: { vi: "STT", en: "#" },
  th_code: { vi: "Mã đơn", en: "Order code" },
  th_buyer: { vi: "Người mua", en: "Buyer" },
  th_date: { vi: "Ngày", en: "Date" },
  th_course: { vi: "Cự ly", en: "Course" },
  th_ticket: { vi: "Loại vé", en: "Ticket type" },
  th_qty: { vi: "SL", en: "Qty" },
  th_status: { vi: "Trạng thái", en: "Status" },
  of_total: { vi: "của tổng", en: "of total" },
  page_word: { vi: "Trang", en: "Page" },
  prev_page: { vi: "Trước", en: "Prev" },
  next_page: { vi: "Sau", en: "Next" },
  no_orders: { vi: "Chưa có đơn hàng", en: "No orders yet" },
  no_data: { vi: "Chưa có dữ liệu", en: "No data" },

  // revenue
  revenue_report: { vi: "Báo cáo doanh thu", en: "Revenue Report" },
  fee_rate_now: { vi: "Mức phí hiện tại", en: "Current fee rate" },
  kpi_gmv: { vi: "GMV (Tổng doanh thu gộp)", en: "GMV (Gross revenue)" },
  kpi_fee: { vi: "Phí 5BIB", en: "5BIB platform fee" },
  kpi_net: { vi: "Doanh thu ròng", en: "Net revenue" },
  kpi_orders: { vi: "Số đơn (đã TT)", en: "Orders (paid)" },
  trend_rev: { vi: "Xu hướng doanh thu", en: "Revenue trend" },
  breakdown_cat: { vi: "Phân bổ theo loại phí", en: "Breakdown by fee type" },
  order_type: { vi: "Loại phí", en: "Fee type" },
  th_orders: { vi: "Số đơn", en: "Orders" },
  th_pct_gmv: { vi: "% GMV", en: "% GMV" },
  total_row: { vi: "Tổng cộng", en: "Total" },
  computing_fee: { vi: "Đang tính phí…", en: "Computing fee…" },

  // settings
  settings_title: { vi: "Cài đặt", en: "Settings" },
  language: { vi: "Ngôn ngữ", en: "Language" },
  account: { vi: "Tài khoản", en: "Account" },
  your_name: { vi: "Tên", en: "Name" },
  role_label: { vi: "Quyền", en: "Role" },
  assigned_races: { vi: "Giải được xem", en: "Assigned races" },
  save_settings: { vi: "Lưu cài đặt", en: "Save settings" },
  f_email: { vi: "Email", en: "Email" },

  // permission / error states
  unauth_title: { vi: "Không có quyền truy cập", en: "Access denied" },
  unauth_body: {
    vi: "Tài khoản của bạn chưa được cấp quyền truy cập Merchant Portal. Vui lòng liên hệ admin 5BIB.",
    en: "Your account is not authorised for the Merchant Portal. Please contact your 5BIB admin.",
  },
  rev_gate_title: { vi: "Cần quyền xem doanh thu", en: "Revenue access required" },
  rev_gate_body: {
    vi: "Bạn chỉ có quyền xem báo cáo bán vé. Liên hệ admin 5BIB để nâng cấp quyền xem doanh thu.",
    en: "You only have ticket report access. Contact your 5BIB admin to upgrade to revenue access.",
  },
  go_tickets: { vi: "Về báo cáo bán vé", en: "Go to ticket report" },

  // roles
  role_viewer: { vi: "Báo cáo bán vé", en: "Ticket report" },
  role_finance: { vi: "Bán vé + Doanh thu", en: "Tickets + Revenue" },
};

export function t(key: string, lang: Lang = "vi"): string {
  const e = DICT[key];
  return e ? e[lang] || e.vi : key;
}

// ---- centralized label maps (BR-MP-24) ----
export const L: Record<string, Dict> = {
  /** Backend financial_status values (paid / voided / pending) + extras. */
  orderStatus: {
    completed: { vi: "Đã hoàn thành", en: "Completed" },
    paid: { vi: "Đã thanh toán", en: "Paid" },
    pending: { vi: "Chờ xử lý", en: "Pending" },
    cancelled: { vi: "Đã huỷ", en: "Cancelled" },
    refunded: { vi: "Đã hoàn tiền", en: "Refunded" },
    voided: { vi: "Đã huỷ bỏ", en: "Voided" },
  },
  category: {
    ORDINARY: { vi: "Đơn thường", en: "Standard" },
    GROUP_BUY: { vi: "Mua nhóm", en: "Group Buy" },
    MANUAL: { vi: "Thủ công", en: "Manual Entry" },
  },
  /** REAL backend race statuses (MySQL races.status). */
  raceStatus: {
    COMPLETE: { vi: "Đã kết thúc", en: "Ended" },
    ONGOING: { vi: "Đang diễn ra", en: "Live" },
    GENERATED_CODE: { vi: "Sắp diễn ra", en: "Upcoming" },
    CANCEL: { vi: "Đã huỷ", en: "Cancelled" },
  },
  /** Revenue breakdown fee-type groups (backend groupKey). */
  feeGroup: {
    fee_percent: { vi: "Phí %", en: "Percentage fee" },
    fee_fixed: { vi: "Phí cố định (MANUAL)", en: "Fixed fee" },
  },
};

export function lab(map: Dict, key: string, lang: Lang = "vi"): string {
  const e = map[key];
  return e ? e[lang] || e.vi : key;
}
