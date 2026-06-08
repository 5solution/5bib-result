/**
 * F-069 Merchant Portal — i18n dictionary + label maps.
 * F-071 — extended to 5 languages: vi / en / km (Khmer) / lo (Lao) / ms (Malay).
 *
 * UI chrome only; backend data (race / merchant names) is NEVER translated.
 * VI is the default + fallback base (BR-02/BR-03): every Entry MUST have `vi`,
 * other languages are optional and fall back to `vi` when missing.
 *
 * ⚠️ km + lo translations are provisional (machine-assisted, F-071) and pending
 * native review before PROD use for Cambodia/Laos organizers.
 */

export type Lang = "vi" | "en" | "km" | "lo" | "ms";

/** vi required (fallback base); other languages optional. */
export type Entry = { vi: string } & Partial<Record<Exclude<Lang, "vi">, string>>;
type Dict = Record<string, Entry>;

/** Switcher registry — display order + native label + flag. */
export const LANGS: ReadonlyArray<{
  code: Lang;
  native: string;
  short: string;
  flag: string;
}> = [
  { code: "vi", native: "Tiếng Việt", short: "VI", flag: "🇻🇳" },
  { code: "en", native: "English", short: "EN", flag: "🇬🇧" },
  { code: "km", native: "ភាសាខ្មែរ", short: "KM", flag: "🇰🇭" },
  { code: "lo", native: "ລາວ", short: "LO", flag: "🇱🇦" },
  { code: "ms", native: "Bahasa Melayu", short: "MS", flag: "🇲🇾" },
];

/** All valid language codes (for localStorage validation — BR-04). */
export const LANG_CODES: readonly Lang[] = LANGS.map((l) => l.code);

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && LANG_CODES.includes(v as Lang);
}

// ---- i18n dictionary (UI chrome only) ----
export const DICT: Dict = {
  // brand / chrome
  portal: { vi: "Cổng Đối tác", en: "Merchant Portal", km: "ផតថលដៃគូ", lo: "ປະຕູຄູ່ຮ່ວມ", ms: "Portal Rakan Niaga" },
  nav_races: { vi: "Giải chạy", en: "Races", km: "ការប្រណាំង", lo: "ການແຂ່ງຂັນ", ms: "Perlumbaan" },
  nav_tickets: { vi: "Bán vé", en: "Ticket Sales", km: "លក់សំបុត្រ", lo: "ຂາຍປີ້", ms: "Jualan Tiket" },
  nav_revenue: { vi: "Doanh thu", en: "Revenue", km: "ចំណូល", lo: "ລາຍຮັບ", ms: "Hasil" },
  nav_settings: { vi: "Cài đặt", en: "Settings", km: "ការកំណត់", lo: "ການຕັ້ງຄ່າ", ms: "Tetapan" },
  logout: { vi: "Đăng xuất", en: "Log out", km: "ចាកចេញ", lo: "ອອກຈາກລະບົບ", ms: "Log keluar" },
  refresh: { vi: "Làm mới", en: "Refresh", km: "ផ្ទុកឡើងវិញ", lo: "ໂຫຼດຄືນ", ms: "Muat semula" },
  export_excel: { vi: "Xuất Excel", en: "Export Excel", km: "នាំចេញ Excel", lo: "ສົ່ງອອກ Excel", ms: "Eksport Excel" },
  all_merchants: { vi: "Tất cả BTC", en: "All merchants", km: "អ្នករៀបចំទាំងអស់", lo: "ຜູ້ຈັດທັງໝົດ", ms: "Semua penganjur" },
  select_merchant: { vi: "Chọn BTC", en: "Select merchant", km: "ជ្រើសរើសអ្នករៀបចំ", lo: "ເລືອກຜູ້ຈັດ", ms: "Pilih penganjur" },
  select_race: { vi: "Chọn giải", en: "Select race", km: "ជ្រើសរើសការប្រណាំង", lo: "ເລືອກການແຂ່ງຂັນ", ms: "Pilih perlumbaan" },
  updated_at: { vi: "Cập nhật lúc", en: "Updated at", km: "បានធ្វើបច្ចុប្បន្នភាពនៅ", lo: "ອັບເດດເມື່ອ", ms: "Dikemas kini pada" },

  // periods + granularity
  period: { vi: "Khoảng thời gian", en: "Time period", km: "ចន្លោះពេល", lo: "ໄລຍະເວລາ", ms: "Tempoh masa" },
  last_7: { vi: "7 ngày qua", en: "Last 7 days", km: "៧ ថ្ងៃចុងក្រោយ", lo: "7 ມື້ຜ່ານມາ", ms: "7 hari lepas" },
  last_30: { vi: "30 ngày qua", en: "Last 30 days", km: "៣០ ថ្ងៃចុងក្រោយ", lo: "30 ມື້ຜ່ານມາ", ms: "30 hari lepas" },
  last_90: { vi: "90 ngày qua", en: "Last 90 days", km: "៩០ ថ្ងៃចុងក្រោយ", lo: "90 ມື້ຜ່ານມາ", ms: "90 hari lepas" },
  custom: { vi: "Tùy chỉnh", en: "Custom", km: "ផ្ទាល់ខ្លួន", lo: "ກຳນົດເອງ", ms: "Tersuai" },
  daily: { vi: "Ngày", en: "Daily", km: "ប្រចាំថ្ងៃ", lo: "ລາຍວັນ", ms: "Harian" },
  weekly: { vi: "Tuần", en: "Weekly", km: "ប្រចាំសប្តាហ៍", lo: "ລາຍອາທິດ", ms: "Mingguan" },
  monthly: { vi: "Tháng", en: "Monthly", km: "ប្រចាំខែ", lo: "ລາຍເດືອນ", ms: "Bulanan" },
  vs_prev: { vi: "so với kỳ trước", en: "vs previous period", km: "ធៀបនឹងរយៈពេលមុន", lo: "ທຽບກັບໄລຍະກ່ອນ", ms: "berbanding tempoh sebelumnya" },

  // login
  login_title: { vi: "Đăng nhập Cổng Đối tác", en: "Sign in to Merchant Portal", km: "ចូលទៅផតថលដៃគូ", lo: "ເຂົ້າສູ່ປະຕູຄູ່ຮ່ວມ", ms: "Log masuk ke Portal Rakan Niaga" },
  login_sub: {
    vi: "Theo dõi bán vé & doanh thu giải chạy của bạn.",
    en: "Track ticket sales & revenue for your events.",
    km: "តាមដានការលក់សំបុត្រ និងចំណូលនៃការប្រណាំងរបស់អ្នក។",
    lo: "ຕິດຕາມການຂາຍປີ້ ແລະ ລາຍຮັບຂອງການແຂ່ງຂັນຂອງທ່ານ.",
    ms: "Pantau jualan tiket & hasil acara anda.",
  },
  email: { vi: "Email", en: "Email", km: "អ៊ីមែល", lo: "ອີເມວ", ms: "E-mel" },
  password: { vi: "Mật khẩu", en: "Password", km: "ពាក្យសម្ងាត់", lo: "ລະຫັດຜ່ານ", ms: "Kata laluan" },
  remember: { vi: "Ghi nhớ đăng nhập", en: "Remember me", km: "ចងចាំការចូល", lo: "ຈື່ການເຂົ້າສູ່ລະບົບ", ms: "Ingat saya" },
  forgot: { vi: "Quên mật khẩu?", en: "Forgot password?", km: "ភ្លេចពាក្យសម្ងាត់?", lo: "ລືມລະຫັດຜ່ານ?", ms: "Lupa kata laluan?" },
  signin: { vi: "Đăng nhập", en: "Sign in", km: "ចូល", lo: "ເຂົ້າສູ່ລະບົບ", ms: "Log masuk" },
  signin_sso: { vi: "Đăng nhập bằng tài khoản 5BIB (SSO)", en: "Continue with 5BIB SSO", km: "ចូលដោយគណនី 5BIB (SSO)", lo: "ເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີ 5BIB (SSO)", ms: "Teruskan dengan 5BIB SSO" },
  or: { vi: "hoặc", en: "or", km: "ឬ", lo: "ຫຼື", ms: "atau" },
  secured_by: { vi: "Bảo mật bởi auth.5bib.com", en: "Secured by auth.5bib.com", km: "សុវត្ថិភាពដោយ auth.5bib.com", lo: "ຮັບປະກັນໂດຍ auth.5bib.com", ms: "Dilindungi oleh auth.5bib.com" },
  authenticating: { vi: "Đang xác thực…", en: "Authenticating…", km: "កំពុងផ្ទៀងផ្ទាត់…", lo: "ກຳລັງຢືນຢັນ…", ms: "Mengesahkan…" },
  loading: { vi: "Đang tải…", en: "Loading…", km: "កំពុងផ្ទុក…", lo: "ກຳລັງໂຫຼດ…", ms: "Memuatkan…" },
  retry: { vi: "Thử lại", en: "Retry", km: "ព្យាយាមម្តងទៀត", lo: "ລອງໃໝ່", ms: "Cuba lagi" },

  // race list
  your_races: { vi: "Giải chạy của bạn", en: "Your races", km: "ការប្រណាំងរបស់អ្នក", lo: "ການແຂ່ງຂັນຂອງທ່ານ", ms: "Perlumbaan anda" },
  races_count: { vi: "giải", en: "races", km: "ការប្រណាំង", lo: "ການແຂ່ງຂັນ", ms: "perlumbaan" },
  tickets_sold: { vi: "vé đã bán", en: "tickets sold", km: "សំបុត្រលក់ហើយ", lo: "ປີ້ທີ່ຂາຍແລ້ວ", ms: "tiket dijual" },
  showing: { vi: "Hiển thị", en: "Showing", km: "កំពុងបង្ហាញ", lo: "ກຳລັງສະແດງ", ms: "Memaparkan" },
  view_report: { vi: "Xem báo cáo", en: "View report", km: "មើលរបាយការណ៍", lo: "ເບິ່ງລາຍງານ", ms: "Lihat laporan" },
  no_races_title: { vi: "Chưa có giải nào", en: "No races yet", km: "មិនទាន់មានការប្រណាំង", lo: "ຍັງບໍ່ມີການແຂ່ງຂັນ", ms: "Tiada perlumbaan lagi" },
  no_races_body: {
    vi: "Tài khoản của bạn chưa được gán giải nào. Liên hệ BTC/5BIB để được cấp quyền.",
    en: "Your account has no race assignments yet. Please contact your BTC / 5BIB admin.",
    km: "គណនីរបស់អ្នកមិនទាន់ត្រូវបានកំណត់ការប្រណាំងណាមួយឡើយ។ សូមទាក់ទងអ្នករៀបចំ/5BIB ដើម្បីទទួលសិទ្ធិ។",
    lo: "ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ຮັບການກຳນົດການແຂ່ງຂັນໃດໆ. ກະລຸນາຕິດຕໍ່ຜູ້ຈັດ/5BIB ເພື່ອຂໍສິດ.",
    ms: "Akaun anda belum ditugaskan sebarang perlumbaan. Sila hubungi penganjur / pentadbir 5BIB.",
  },
  load_failed: { vi: "Không tải được dữ liệu", en: "Failed to load data", km: "មិនអាចផ្ទុកទិន្នន័យបានទេ", lo: "ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໄດ້", ms: "Gagal memuatkan data" },
  all_races_link: { vi: "Tất cả giải", en: "All races", km: "ការប្រណាំងទាំងអស់", lo: "ການແຂ່ງຂັນທັງໝົດ", ms: "Semua perlumbaan" },

  // ticket sales
  ticket_report: { vi: "Báo cáo bán vé", en: "Ticket Sales Report", km: "របាយការណ៍លក់សំបុត្រ", lo: "ລາຍງານການຂາຍປີ້", ms: "Laporan Jualan Tiket" },
  all_races: { vi: "Tất cả giải", en: "All races", km: "ការប្រណាំងទាំងអស់", lo: "ການແຂ່ງຂັນທັງໝົດ", ms: "Semua perlumbaan" },
  kpi_total: { vi: "Tổng vé bán", en: "Total tickets", km: "សំបុត្រសរុប", lo: "ປີ້ທັງໝົດ", ms: "Jumlah tiket" },
  kpi_paid: { vi: "Vé đã thanh toán", en: "Paid tickets", km: "សំបុត្របានបង់ប្រាក់", lo: "ປີ້ທີ່ຈ່າຍແລ້ວ", ms: "Tiket dibayar" },
  kpi_pending: { vi: "Vé chờ xử lý", en: "Pending tickets", km: "សំបុត្ររង់ចាំ", lo: "ປີ້ລໍຖ້າ", ms: "Tiket belum selesai" },
  kpi_cancelled: { vi: "Vé đã huỷ", en: "Cancelled tickets", km: "សំបុត្របានលុបចោល", lo: "ປີ້ທີ່ຍົກເລີກ", ms: "Tiket dibatalkan" },
  trend_reg: { vi: "Xu hướng đăng ký", en: "Registration trend", km: "និន្នាការចុះឈ្មោះ", lo: "ແນວໂນ້ມການລົງທະບຽນ", ms: "Trend pendaftaran" },
  by_course: { vi: "Theo cự ly", en: "By course", km: "តាមចម្ងាយ", lo: "ຕາມໄລຍະທາງ", ms: "Mengikut kategori" },
  by_ticket_type: { vi: "Theo loại vé", en: "By ticket type", km: "តាមប្រភេទសំបុត្រ", lo: "ຕາມປະເພດປີ້", ms: "Mengikut jenis tiket" },
  order_detail: { vi: "Chi tiết đơn hàng", en: "Order detail", km: "ព័ត៌មានលម្អិតការបញ្ជាទិញ", lo: "ລາຍລະອຽດການສັ່ງຊື້", ms: "Butiran pesanan" },
  search_order: { vi: "Tìm mã đơn…", en: "Search order code…", km: "ស្វែងរកលេខការបញ្ជាទិញ…", lo: "ຄົ້ນຫາລະຫັດສັ່ງຊື້…", ms: "Cari kod pesanan…" },
  th_no: { vi: "STT", en: "#", km: "ល.រ", lo: "ລ/ດ", ms: "No." },
  th_code: { vi: "Mã đơn", en: "Order code", km: "លេខការបញ្ជាទិញ", lo: "ລະຫັດສັ່ງຊື້", ms: "Kod pesanan" },
  th_buyer: { vi: "Người mua", en: "Buyer", km: "អ្នកទិញ", lo: "ຜູ້ຊື້", ms: "Pembeli" },
  th_date: { vi: "Ngày", en: "Date", km: "កាលបរិច្ឆេទ", lo: "ວັນທີ", ms: "Tarikh" },
  th_course: { vi: "Cự ly", en: "Course", km: "ចម្ងាយ", lo: "ໄລຍະທາງ", ms: "Kategori" },
  th_ticket: { vi: "Loại vé", en: "Ticket type", km: "ប្រភេទសំបុត្រ", lo: "ປະເພດປີ້", ms: "Jenis tiket" },
  th_qty: { vi: "SL", en: "Qty", km: "ចំនួន", lo: "ຈຳນວນ", ms: "Kuantiti" },
  th_status: { vi: "Trạng thái", en: "Status", km: "ស្ថានភាព", lo: "ສະຖານະ", ms: "Status" },
  of_total: { vi: "của tổng", en: "of total", km: "នៃសរុប", lo: "ຂອງທັງໝົດ", ms: "daripada jumlah" },
  page_word: { vi: "Trang", en: "Page", km: "ទំព័រ", lo: "ໜ້າ", ms: "Halaman" },
  prev_page: { vi: "Trước", en: "Prev", km: "មុន", lo: "ກ່ອນ", ms: "Sebelum" },
  next_page: { vi: "Sau", en: "Next", km: "បន្ទាប់", lo: "ຕໍ່ໄປ", ms: "Seterusnya" },
  no_orders: { vi: "Chưa có đơn hàng", en: "No orders yet", km: "មិនទាន់មានការបញ្ជាទិញ", lo: "ຍັງບໍ່ມີການສັ່ງຊື້", ms: "Tiada pesanan lagi" },
  no_data: { vi: "Chưa có dữ liệu", en: "No data", km: "មិនទាន់មានទិន្នន័យ", lo: "ຍັງບໍ່ມີຂໍ້ມູນ", ms: "Tiada data" },

  // F-070 — MKT analytics
  mkt_analytics: { vi: "Phân tích MKT", en: "MKT analytics", km: "ការវិភាគទីផ្សារ", lo: "ການວິເຄາະການຕະຫຼາດ", ms: "Analitik MKT" },
  forecast_title: { vi: "Lũy kế & dự báo về đích", en: "Pace & projection to race day", km: "សន្សំ និងការព្យាករណ៍ដល់ថ្ងៃប្រណាំង", lo: "ສະສົມ ແລະ ການຄາດຄະເນຮອດວັນແຂ່ງ", ms: "Kumulatif & unjuran ke hari perlumbaan" },
  heatmap_title: { vi: "Khung giờ vàng đăng ký", en: "Registration time heatmap", km: "ម៉ោងមាសនៃការចុះឈ្មោះ", lo: "ຊົ່ວໂມງທອງຄຳຂອງການລົງທະບຽນ", ms: "Peta haba waktu pendaftaran" },
  funnel_title: { vi: "Phễu chuyển đổi đơn", en: "Order conversion funnel", km: "ចីវលលនៃការបំប្លែងការបញ្ជាទិញ", lo: "ກວຍການແປງການສັ່ງຊື້", ms: "Corong penukaran pesanan" },
  ticket_target: { vi: "Mục tiêu vé", en: "Ticket target", km: "គោលដៅសំបុត្រ", lo: "ເປົ້າໝາຍປີ້", ms: "Sasaran tiket" },
  save: { vi: "Lưu", en: "Save", km: "រក្សាទុក", lo: "ບັນທຶກ", ms: "Simpan" },
  saving: { vi: "Đang lưu…", en: "Saving…", km: "កំពុងរក្សាទុក…", lo: "ກຳລັງບັນທຶກ…", ms: "Menyimpan…" },
  target_saved: { vi: "Đã lưu mục tiêu", en: "Target saved", km: "បានរក្សាទុកគោលដៅ", lo: "ບັນທຶກເປົ້າໝາຍແລ້ວ", ms: "Sasaran disimpan" },
  target_invalid: { vi: "Mục tiêu phải là số nguyên 0–10.000.000", en: "Target must be an integer 0–10,000,000", km: "គោលដៅត្រូវតែជាចំនួនគត់ 0–10.000.000", lo: "ເປົ້າໝາຍຕ້ອງເປັນຈຳນວນເຕັມ 0–10.000.000", ms: "Sasaran mesti integer 0–10,000,000" },
  vn_hours: { vi: "giờ VN", en: "VN time", km: "ម៉ោងវៀតណាម", lo: "ເວລາຫວຽດນາມ", ms: "Waktu Vietnam" },
  race_ended_note: { vi: "Giải đã kết thúc — chỉ hiện lũy kế thực tế", en: "Race ended — showing actual cumulative only", km: "ការប្រណាំងបានបញ្ចប់ — បង្ហាញតែការសន្សំជាក់ស្តែង", lo: "ການແຂ່ງຂັນສິ້ນສຸດ — ສະແດງສະເພາະຍອດສະສົມຕົວຈິງ", ms: "Perlumbaan tamat — paparkan kumulatif sebenar sahaja" },
  conversion: { vi: "Tỷ lệ chuyển đổi", en: "Conversion", km: "អត្រាបំប្លែង", lo: "ອັດຕາການແປງ", ms: "Kadar penukaran" },
  pending_rate: { vi: "Đơn treo", en: "Pending", km: "ការបញ្ជាទិញរង់ចាំ", lo: "ການສັ່ງຊື້ຄ້າງ", ms: "Tertangguh" },
  cancel_rate: { vi: "Huỷ / hoàn", en: "Cancel/refund", km: "លុបចោល / សងវិញ", lo: "ຍົກເລີກ / ຄືນເງິນ", ms: "Batal / bayar balik" },
  orders_created: { vi: "Tổng đơn tạo", en: "Orders created", km: "ការបញ្ជាទិញសរុបដែលបានបង្កើត", lo: "ການສັ່ງຊື້ທີ່ສ້າງທັງໝົດ", ms: "Jumlah pesanan dibuat" },
  paid_confirmed: { vi: "Đã thanh toán", en: "Paid / confirmed", km: "បានបង់ប្រាក់", lo: "ຈ່າຍແລ້ວ", ms: "Dibayar / disahkan" },
  insight: { vi: "MKT insight", en: "MKT insight", km: "ការយល់ដឹងទីផ្សារ", lo: "ຄວາມເຂົ້າໃຈການຕະຫຼາດ", ms: "Wawasan MKT" },
  insight_heatmap: {
    vi: "Cao điểm đăng ký: {day} khung {bucket}h. Lên lịch chạy ads & gửi email/notification ngay trước các khung này.",
    en: "Peak registration window: {day} {bucket}h. Schedule ads & email/notification blasts just before these windows.",
    km: "ម៉ោងចុះឈ្មោះកំពូល៖ {day} ម៉ោង {bucket}។ កំណត់ពេលផ្សាយពាណិជ្ជកម្ម និងផ្ញើអ៊ីមែល/ការជូនដំណឹង មុនពេលទាំងនេះ។",
    lo: "ຊ່ວງລົງທະບຽນສູງສຸດ: {day} ຊ່ວງ {bucket} ໂມງ. ກຳນົດເວລາໂຄສະນາ ແລະ ສົ່ງອີເມວ/ການແຈ້ງເຕືອນ ກ່ອນຊ່ວງເຫຼົ່ານີ້.",
    ms: "Tempoh pendaftaran puncak: {day} {bucket}h. Jadualkan iklan & e-mel/notifikasi sebelum tempoh ini.",
  },
  insight_funnel: {
    vi: "Tỷ lệ chốt {conv}%; còn {pend}% đơn treo chưa thanh toán — gửi nhắc thanh toán để thu hồi. Tỷ lệ huỷ/hoàn {cancel}% cần theo dõi nguyên nhân.",
    en: "{conv}% close rate; {pend}% orders pending payment — send payment reminders to recover them. {cancel}% cancel/refund rate is worth investigating.",
    km: "អត្រាបិទ {conv}%; នៅសល់ {pend}% នៃការបញ្ជាទិញរង់ចាំការទូទាត់ — ផ្ញើការរំលឹកការទូទាត់ដើម្បីយកមកវិញ។ អត្រាលុបចោល/សងវិញ {cancel}% គួរស្រាវជ្រាវ។",
    lo: "ອັດຕາປິດ {conv}%; ຍັງເຫຼືອ {pend}% ການສັ່ງຊື້ຄ້າງຈ່າຍ — ສົ່ງການເຕືອນຈ່າຍເງິນເພື່ອເກັບຄືນ. ອັດຕາຍົກເລີກ/ຄືນເງິນ {cancel}% ຄວນຕິດຕາມສາເຫດ.",
    ms: "Kadar penutupan {conv}%; {pend}% pesanan menunggu bayaran — hantar peringatan bayaran untuk memulihkannya. Kadar batal/bayar balik {cancel}% perlu disiasat.",
  },
  tickets_word: { vi: "vé", en: "tickets", km: "សំបុត្រ", lo: "ປີ້", ms: "tiket" },
  insight_race_ended: {
    vi: "Giải đã kết thúc — {n} vé.",
    en: "Race ended — {n} tickets.",
    km: "ការប្រណាំងបានបញ្ចប់ — {n} សំបុត្រ។",
    lo: "ການແຂ່ງຂັນສິ້ນສຸດ — {n} ປີ້.",
    ms: "Perlumbaan tamat — {n} tiket.",
  },
  insight_proj_above: {
    vi: "Theo tốc độ 7 ngày gần nhất, dự kiến đạt ~{proj} vé vào ngày đua — vượt mục tiêu {target}. Duy trì ngân sách hiện tại.",
    en: "At the last-7-day pace, projected ~{proj} tickets by race day — above the {target} target. Hold current spend.",
    km: "តាមល្បឿន ៧ ថ្ងៃចុងក្រោយ ព្យាករណ៍ ~{proj} សំបុត្រ នៅថ្ងៃប្រណាំង — លើសគោលដៅ {target}។ រក្សាថវិកាបច្ចុប្បន្ន។",
    lo: "ຕາມຄວາມໄວ 7 ມື້ຫຼ້າສຸດ, ຄາດວ່າຈະໄດ້ ~{proj} ປີ້ ໃນວັນແຂ່ງ — ເກີນເປົ້າໝາຍ {target}. ຮັກສາງົບປະມານປັດຈຸບັນ.",
    ms: "Pada kadar 7 hari terkini, dijangka ~{proj} tiket menjelang hari perlumbaan — melebihi sasaran {target}. Kekalkan perbelanjaan semasa.",
  },
  insight_proj_below: {
    vi: "Theo tốc độ 7 ngày gần nhất, dự kiến đạt ~{proj} vé vào ngày đua — thấp hơn mục tiêu {target}. Cần một đợt đẩy để chạm mục tiêu.",
    en: "At the last-7-day pace, projected ~{proj} tickets by race day — below the {target} target. A push is needed to hit the goal.",
    km: "តាមល្បឿន ៧ ថ្ងៃចុងក្រោយ ព្យាករណ៍ ~{proj} សំបុត្រ នៅថ្ងៃប្រណាំង — ទាបជាងគោលដៅ {target}។ ត្រូវការការជំរុញដើម្បីសម្រេចគោលដៅ។",
    lo: "ຕາມຄວາມໄວ 7 ມື້ຫຼ້າສຸດ, ຄາດວ່າຈະໄດ້ ~{proj} ປີ້ ໃນວັນແຂ່ງ — ຕ່ຳກວ່າເປົ້າໝາຍ {target}. ຕ້ອງການການຊຸກຍູ້ເພື່ອບັນລຸເປົ້າໝາຍ.",
    ms: "Pada kadar 7 hari terkini, dijangka ~{proj} tiket menjelang hari perlumbaan — di bawah sasaran {target}. Dorongan diperlukan untuk capai matlamat.",
  },
  insight_proj_notarget: {
    vi: "Theo tốc độ 7 ngày gần nhất, dự kiến đạt ~{proj} vé về ngày đua. Đặt mục tiêu để so sánh.",
    en: "At the last-7-day pace, projected ~{proj} tickets by race day. Set a target to compare.",
    km: "តាមល្បឿន ៧ ថ្ងៃចុងក្រោយ ព្យាករណ៍ ~{proj} សំបុត្រ នៅថ្ងៃប្រណាំង។ កំណត់គោលដៅដើម្បីប្រៀបធៀប។",
    lo: "ຕາມຄວາມໄວ 7 ມື້ຫຼ້າສຸດ, ຄາດວ່າຈະໄດ້ ~{proj} ປີ້ ໃນວັນແຂ່ງ. ຕັ້ງເປົ້າໝາຍເພື່ອປຽບທຽບ.",
    ms: "Pada kadar 7 hari terkini, dijangka ~{proj} tiket menjelang hari perlumbaan. Tetapkan sasaran untuk perbandingan.",
  },
  not_enough_data: { vi: "Chưa đủ dữ liệu", en: "Not enough data", km: "ទិន្នន័យមិនគ្រប់គ្រាន់", lo: "ຂໍ້ມູນບໍ່ພຽງພໍ", ms: "Data tidak mencukupi" },
  no_reg_data: { vi: "Chưa có dữ liệu đăng ký cho giải này", en: "No registration data for this race", km: "មិនទាន់មានទិន្នន័យចុះឈ្មោះសម្រាប់ការប្រណាំងនេះ", lo: "ຍັງບໍ່ມີຂໍ້ມູນການລົງທະບຽນສຳລັບການແຂ່ງຂັນນີ້", ms: "Tiada data pendaftaran untuk perlumbaan ini" },
  target_label: { vi: "Mục tiêu", en: "Target", km: "គោលដៅ", lo: "ເປົ້າໝາຍ", ms: "Sasaran" },
  race_day: { vi: "Ngày đua", en: "Race day", km: "ថ្ងៃប្រណាំង", lo: "ວັນແຂ່ງ", ms: "Hari perlumbaan" },
  cumulative_tickets: { vi: "vé lũy kế", en: "cumulative", km: "សំបុត្រសន្សំ", lo: "ປີ້ສະສົມ", ms: "kumulatif" },
  legend_low: { vi: "Ít", en: "Low", km: "តិច", lo: "ໜ້ອຍ", ms: "Rendah" },
  legend_high: { vi: "Nhiều", en: "High", km: "ច្រើន", lo: "ຫຼາຍ", ms: "Tinggi" },

  // F-074 — YoY (So với mùa trước)
  yoy_title: { vi: "So với mùa trước", en: "vs previous edition", km: "ធៀបនឹងលើកមុន", lo: "ທຽບກັບຄັ້ງກ່ອນ", ms: "vs edisi sebelumnya" },
  yoy_pick: { vi: "Chọn giải so sánh…", en: "Pick a race to compare…", km: "ជ្រើសរើសការប្រណាំងដើម្បីប្រៀបធៀប…", lo: "ເລືອກການແຂ່ງຂັນເພື່ອປຽບທຽບ…", ms: "Pilih perlumbaan untuk dibandingkan…" },
  this_race: { vi: "Giải này", en: "This race", km: "ការប្រណាំងនេះ", lo: "ການແຂ່ງຂັນນີ້", ms: "Perlumbaan ini" },
  days_before_unit: { vi: "ngày trước đua", en: "days before race", km: "ថ្ងៃមុនការប្រណាំង", lo: "ມື້ກ່ອນແຂ່ງ", ms: "hari sebelum perlumbaan" },
  yoy_empty: { vi: "Chưa có giải nào trước đó cùng BTC để so sánh", en: "No earlier race from this organizer to compare", km: "គ្មានការប្រណាំងមុននេះពីអ្នករៀបចំនេះដើម្បីប្រៀបធៀប", lo: "ບໍ່ມີການແຂ່ງຂັນກ່ອນໜ້າຈາກຜູ້ຈັດນີ້ເພື່ອປຽບທຽບ", ms: "Tiada perlumbaan terdahulu daripada penganjur ini" },

  // F-073 — capacity / quota (Sức chứa)
  capacity_title: { vi: "Sức chứa theo cự ly", en: "Capacity by course", km: "សមត្ថភាពតាមចម្ងាយ", lo: "ຄວາມຈຸຕາມໄລຍະ", ms: "Kapasiti mengikut kategori" },
  quota_word: { vi: "Quota", en: "Quota", km: "កូតា", lo: "Quota", ms: "Kuota" },
  sold_word: { vi: "Đã bán", en: "Sold", km: "បានលក់", lo: "ຂາຍແລ້ວ", ms: "Terjual" },
  remaining_word: { vi: "Còn lại", en: "Remaining", km: "នៅសល់", lo: "ຍັງເຫຼືອ", ms: "Baki" },
  filled_word: { vi: "Lấp đầy", en: "Filled", km: "បានបំពេញ", lo: "ເຕັມ", ms: "Penuh" },
  unlimited_word: { vi: "Không giới hạn", en: "Unlimited", km: "គ្មានដែនកំណត់", lo: "ບໍ່ຈຳກັດ", ms: "Tanpa had" },

  // F-072 — participant insights (Cơ cấu VĐV)
  participants_report: { vi: "Cơ cấu VĐV", en: "Participants", km: "រចនាសម្ព័ន្ធអត្តពលិក", lo: "ໂຄງສ້າງນັກກິລາ", ms: "Peserta" },
  kpi_participants: { vi: "Tổng VĐV", en: "Total participants", km: "អត្តពលិកសរុប", lo: "ນັກກິລາທັງໝົດ", ms: "Jumlah peserta" },
  by_size: { vi: "Phân bổ size áo", en: "Shirt size distribution", km: "ការបែងចែកទំហំអាវ", lo: "ການແບ່ງຂະໜາດເສື້ອ", ms: "Taburan saiz baju" },
  by_gender: { vi: "Theo giới tính", en: "By gender", km: "តាមភេទ", lo: "ຕາມເພດ", ms: "Mengikut jantina" },
  by_agegroup: { vi: "Theo nhóm tuổi", en: "By age group", km: "តាមក្រុមអាយុ", lo: "ຕາມກຸ່ມອາຍຸ", ms: "Mengikut kumpulan umur" },
  by_nationality: { vi: "Theo quốc tịch", en: "By nationality", km: "តាមសញ្ជាតិ", lo: "ຕາມສັນຊາດ", ms: "Mengikut warganegara" },
  by_province: { vi: "Theo tỉnh/thành", en: "By province", km: "តាមខេត្ត/ក្រុង", lo: "ຕາມແຂວງ/ເມືອງ", ms: "Mengikut wilayah" },
  export_size: { vi: "Xuất Excel size", en: "Export size (Excel)", km: "នាំចេញទំហំ (Excel)", lo: "ສົ່ງອອກຂະໜາດ (Excel)", ms: "Eksport saiz (Excel)" },
  exporting: { vi: "Đang xuất…", en: "Exporting…", km: "កំពុងនាំចេញ…", lo: "ກຳລັງສົ່ງອອກ…", ms: "Mengeksport…" },
  no_participants: { vi: "Chưa có VĐV đã thanh toán", en: "No paid participants yet", km: "មិនទាន់មានអត្តពលិកដែលបានបង់ប្រាក់", lo: "ຍັງບໍ່ມີນັກກິລາທີ່ຈ່າຍແລ້ວ", ms: "Tiada peserta berbayar lagi" },

  // revenue
  revenue_report: { vi: "Báo cáo doanh thu", en: "Revenue Report", km: "របាយការណ៍ចំណូល", lo: "ລາຍງານລາຍຮັບ", ms: "Laporan Hasil" },
  fee_rate_now: { vi: "Mức phí hiện tại", en: "Current fee rate", km: "អត្រាថ្លៃសេវាបច្ចុប្បន្ន", lo: "ອັດຕາຄ່າທຳນຽມປັດຈຸບັນ", ms: "Kadar yuran semasa" },
  kpi_gmv: { vi: "GMV (Tổng doanh thu gộp)", en: "GMV (Gross revenue)", km: "GMV (ចំណូលសរុបសរុប)", lo: "GMV (ລາຍຮັບລວມ)", ms: "GMV (Hasil kasar)" },
  kpi_fee: { vi: "Phí 5BIB", en: "5BIB platform fee", km: "ថ្លៃសេវា 5BIB", lo: "ຄ່າທຳນຽມ 5BIB", ms: "Yuran platform 5BIB" },
  kpi_net: { vi: "Doanh thu ròng", en: "Net revenue", km: "ចំណូលសុទ្ធ", lo: "ລາຍຮັບສຸດທິ", ms: "Hasil bersih" },
  kpi_orders: { vi: "Số đơn (đã TT)", en: "Orders (paid)", km: "ការបញ្ជាទិញ (បានបង់ប្រាក់)", lo: "ການສັ່ງຊື້ (ຈ່າຍແລ້ວ)", ms: "Pesanan (dibayar)" },
  trend_rev: { vi: "Xu hướng doanh thu", en: "Revenue trend", km: "និន្នាការចំណូល", lo: "ແນວໂນ້ມລາຍຮັບ", ms: "Trend hasil" },
  breakdown_cat: { vi: "Phân bổ theo loại phí", en: "Breakdown by fee type", km: "ការបែងចែកតាមប្រភេទថ្លៃសេវា", lo: "ການແບ່ງຕາມປະເພດຄ່າທຳນຽມ", ms: "Pecahan mengikut jenis yuran" },
  order_type: { vi: "Loại phí", en: "Fee type", km: "ប្រភេទថ្លៃសេវា", lo: "ປະເພດຄ່າທຳນຽມ", ms: "Jenis yuran" },
  th_orders: { vi: "Số đơn", en: "Orders", km: "ការបញ្ជាទិញ", lo: "ການສັ່ງຊື້", ms: "Pesanan" },
  th_pct_gmv: { vi: "% GMV", en: "% GMV", km: "% GMV", lo: "% GMV", ms: "% GMV" },
  total_row: { vi: "Tổng cộng", en: "Total", km: "សរុប", lo: "ລວມທັງໝົດ", ms: "Jumlah" },
  computing_fee: { vi: "Đang tính phí…", en: "Computing fee…", km: "កំពុងគណនាថ្លៃសេវា…", lo: "ກຳລັງຄຳນວນຄ່າທຳນຽມ…", ms: "Mengira yuran…" },

  // settings
  settings_title: { vi: "Cài đặt", en: "Settings", km: "ការកំណត់", lo: "ການຕັ້ງຄ່າ", ms: "Tetapan" },
  language: { vi: "Ngôn ngữ", en: "Language", km: "ភាសា", lo: "ພາສາ", ms: "Bahasa" },
  account: { vi: "Tài khoản", en: "Account", km: "គណនី", lo: "ບັນຊີ", ms: "Akaun" },
  your_name: { vi: "Tên", en: "Name", km: "ឈ្មោះ", lo: "ຊື່", ms: "Nama" },
  role_label: { vi: "Quyền", en: "Role", km: "សិទ្ធិ", lo: "ສິດ", ms: "Peranan" },
  assigned_races: { vi: "Giải được xem", en: "Assigned races", km: "ការប្រណាំងដែលអាចមើលបាន", lo: "ການແຂ່ງຂັນທີ່ເບິ່ງໄດ້", ms: "Perlumbaan yang ditugaskan" },
  save_settings: { vi: "Lưu cài đặt", en: "Save settings", km: "រក្សាទុកការកំណត់", lo: "ບັນທຶກການຕັ້ງຄ່າ", ms: "Simpan tetapan" },
  f_email: { vi: "Email", en: "Email", km: "អ៊ីមែល", lo: "ອີເມວ", ms: "E-mel" },
  lang_save_note: {
    vi: "Lưu trên trình duyệt này. Dữ liệu từ hệ thống (tên giải, tên BTC) không được dịch.",
    en: "Saved to this browser. Backend data (race & merchant names) is never translated.",
    km: "រក្សាទុកនៅលើកម្មវិធីរុករកនេះ។ ទិន្នន័យពីប្រព័ន្ធ (ឈ្មោះការប្រណាំង ឈ្មោះអ្នករៀបចំ) មិនត្រូវបានបកប្រែ។",
    lo: "ບັນທຶກໄວ້ໃນໂປຣແກຣມທ່ອງເວັບນີ້. ຂໍ້ມູນຈາກລະບົບ (ຊື່ການແຂ່ງຂັນ, ຊື່ຜູ້ຈັດ) ບໍ່ໄດ້ຮັບການແປ.",
    ms: "Disimpan dalam pelayar ini. Data sistem (nama perlumbaan & penganjur) tidak diterjemah.",
  },

  // permission / error states
  unauth_title: { vi: "Không có quyền truy cập", en: "Access denied", km: "គ្មានសិទ្ធិចូលប្រើ", lo: "ບໍ່ມີສິດເຂົ້າເຖິງ", ms: "Akses ditolak" },
  unauth_body: {
    vi: "Tài khoản của bạn chưa được cấp quyền truy cập Merchant Portal. Vui lòng liên hệ admin 5BIB.",
    en: "Your account is not authorised for the Merchant Portal. Please contact your 5BIB admin.",
    km: "គណនីរបស់អ្នកមិនទាន់ត្រូវបានផ្តល់សិទ្ធិចូលប្រើ Merchant Portal ទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រង 5BIB។",
    lo: "ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ຮັບສິດເຂົ້າເຖິງ Merchant Portal. ກະລຸນາຕິດຕໍ່ຜູ້ດູແລ 5BIB.",
    ms: "Akaun anda tidak dibenarkan mengakses Merchant Portal. Sila hubungi pentadbir 5BIB anda.",
  },
  rev_gate_title: { vi: "Cần quyền xem doanh thu", en: "Revenue access required", km: "ត្រូវការសិទ្ធិមើលចំណូល", lo: "ຕ້ອງການສິດເບິ່ງລາຍຮັບ", ms: "Akses hasil diperlukan" },
  rev_gate_body: {
    vi: "Bạn chỉ có quyền xem báo cáo bán vé. Liên hệ admin 5BIB để nâng cấp quyền xem doanh thu.",
    en: "You only have ticket report access. Contact your 5BIB admin to upgrade to revenue access.",
    km: "អ្នកមានសិទ្ធិមើលតែរបាយការណ៍លក់សំបុត្រប៉ុណ្ណោះ។ ទាក់ទងអ្នកគ្រប់គ្រង 5BIB ដើម្បីដំឡើងសិទ្ធិមើលចំណូល។",
    lo: "ທ່ານມີສິດເບິ່ງສະເພາະລາຍງານການຂາຍປີ້ເທົ່ານັ້ນ. ຕິດຕໍ່ຜູ້ດູແລ 5BIB ເພື່ອຍົກລະດັບສິດເບິ່ງລາຍຮັບ.",
    ms: "Anda hanya mempunyai akses laporan tiket. Hubungi pentadbir 5BIB untuk menaik taraf ke akses hasil.",
  },
  go_tickets: { vi: "Về báo cáo bán vé", en: "Go to ticket report", km: "ត្រឡប់ទៅរបាយការណ៍លក់សំបុត្រ", lo: "ກັບໄປລາຍງານການຂາຍປີ້", ms: "Ke laporan tiket" },

  // roles
  role_viewer: { vi: "Báo cáo bán vé", en: "Ticket report", km: "របាយការណ៍លក់សំបុត្រ", lo: "ລາຍງານການຂາຍປີ້", ms: "Laporan tiket" },
  role_finance: { vi: "Bán vé + Doanh thu", en: "Tickets + Revenue", km: "សំបុត្រ + ចំណូល", lo: "ປີ້ + ລາຍຮັບ", ms: "Tiket + Hasil" },
};

export function t(key: string, lang: Lang = "vi"): string {
  const e = DICT[key];
  if (!e) return key; // BR-03: missing key → raw key (dev visibility)
  return e[lang] || e.vi; // BR-03: missing language → fallback to vi
}

// ---- centralized label maps (BR-MP-24) ----
export const L: Record<string, Dict> = {
  /** Backend financial_status values (paid / voided / pending) + extras. */
  orderStatus: {
    completed: { vi: "Đã hoàn thành", en: "Completed", km: "បានបញ្ចប់", lo: "ສຳເລັດແລ້ວ", ms: "Selesai" },
    paid: { vi: "Đã thanh toán", en: "Paid", km: "បានបង់ប្រាក់", lo: "ຈ່າຍແລ້ວ", ms: "Dibayar" },
    pending: { vi: "Chờ xử lý", en: "Pending", km: "រង់ចាំ", lo: "ລໍຖ້າ", ms: "Belum selesai" },
    cancelled: { vi: "Đã huỷ", en: "Cancelled", km: "បានលុបចោល", lo: "ຍົກເລີກແລ້ວ", ms: "Dibatalkan" },
    refunded: { vi: "Đã hoàn tiền", en: "Refunded", km: "បានសងប្រាក់វិញ", lo: "ຄືນເງິນແລ້ວ", ms: "Dibayar balik" },
    voided: { vi: "Đã huỷ bỏ", en: "Voided", km: "បានលុបចោល", lo: "ຍົກເລີກ", ms: "Dibatalkan" },
  },
  category: {
    ORDINARY: { vi: "Đơn thường", en: "Standard", km: "ការបញ្ជាទិញធម្មតា", lo: "ການສັ່ງຊື້ປົກກະຕິ", ms: "Biasa" },
    GROUP_BUY: { vi: "Mua nhóm", en: "Group Buy", km: "ការទិញជាក្រុម", lo: "ການຊື້ເປັນກຸ່ມ", ms: "Belian Kumpulan" },
    MANUAL: { vi: "Thủ công", en: "Manual Entry", km: "បញ្ចូលដោយដៃ", lo: "ປ້ອນດ້ວຍມື", ms: "Kemasukan Manual" },
  },
  /** REAL backend race statuses (MySQL races.status). */
  raceStatus: {
    COMPLETE: { vi: "Đã kết thúc", en: "Ended", km: "បានបញ្ចប់", lo: "ສິ້ນສຸດແລ້ວ", ms: "Tamat" },
    ONGOING: { vi: "Đang diễn ra", en: "Live", km: "កំពុងប្រព្រឹត្តទៅ", lo: "ກຳລັງດຳເນີນ", ms: "Langsung" },
    GENERATED_CODE: { vi: "Sắp diễn ra", en: "Upcoming", km: "នឹងប្រព្រឹត្តទៅ", lo: "ກຳລັງຈະມາເຖິງ", ms: "Akan datang" },
    CANCEL: { vi: "Đã huỷ", en: "Cancelled", km: "បានលុបចោល", lo: "ຍົກເລີກແລ້ວ", ms: "Dibatalkan" },
  },
  /** Revenue breakdown fee-type groups (backend groupKey). */
  feeGroup: {
    fee_percent: { vi: "Phí %", en: "Percentage fee", km: "ថ្លៃសេវា %", lo: "ຄ່າທຳນຽມ %", ms: "Yuran peratusan" },
    fee_fixed: { vi: "Phí cố định (MANUAL)", en: "Fixed fee", km: "ថ្លៃសេវាថេរ (MANUAL)", lo: "ຄ່າທຳນຽມຄົງທີ່ (MANUAL)", ms: "Yuran tetap" },
  },
};

export function lab(map: Dict, key: string, lang: Lang = "vi"): string {
  const e = map[key];
  if (!e) return key;
  return e[lang] || e.vi;
}
