/**
 * F-014 Athletes tab — scope-local Vietnamese microcopy (F-013 pattern).
 *
 * NOT imported from `@/lib/vn-microcopy.ts` — that one is global and we want
 * F-014 strings live with the tab so they evolve together. Manager BR-AS-29
 * mandates section-local state, microcopy follows same locality.
 */

export const ATHLETES_VN = {
  // Page header
  pageTitle: 'Vận động viên',
  pageSubtitle: 'Quản lý roster, BIB và trạng thái race-day',

  // Filter bar
  searchPlaceholder: 'Tìm BIB hoặc tên VĐV...',
  filterStatus: 'Trạng thái',
  filterCourse: 'Cự ly',
  filterGender: 'Giới tính',
  filterAgeGroup: 'Nhóm tuổi',
  filterPaid: 'Thanh toán',
  resetFilters: 'Đặt lại',
  viewToggleAll: 'Tất cả',
  viewToggleLive: 'Đang chạy',
  viewToggleFinishers: 'Hoàn thành',
  viewToggleIncidents: 'Sự cố',

  // Table
  colBib: 'BIB',
  colName: 'Họ tên',
  colCourse: 'Cự ly',
  colGender: 'Giới',
  colAg: 'AG',
  colStatus: 'Trạng thái',
  colChipTime: 'Thời gian',
  colActions: 'Thao tác',

  // Row actions
  actionView: 'Xem',
  actionEdit: 'Sửa',
  actionChangeStatus: 'Đổi trạng thái',
  actionContact: 'Liên hệ',
  actionAuditLog: 'Lịch sử',

  // Bulk action bar
  bulkSelected: (n: number) => `Đã chọn ${n} VĐV`,
  bulkChangeStatus: 'Đổi trạng thái hàng loạt',
  bulkExport: 'Xuất CSV đã chọn',
  bulkClearSelection: 'Bỏ chọn',
  bulkDisabledTip: 'Endpoint chưa sẵn sàng — F-014.5',
  bulkCapWarning: (cap: number) => `Tối đa ${cap} VĐV mỗi lần`,

  // Drawer
  drawerEditTitle: 'Sửa thông tin VĐV',
  drawerProfileTitle: 'Hồ sơ VĐV',
  drawerTabEdit: 'Chỉnh sửa',
  drawerTabProfile: 'Hồ sơ',
  drawerTabAudit: 'Lịch sử thay đổi',
  drawerSave: 'Lưu thay đổi',
  drawerCancel: 'Hủy',
  drawerClose: 'Đóng',

  // Change status dialog
  changeStatusTitle: 'Đổi trạng thái VĐV',
  changeStatusReasonLabel: 'Lý do',
  changeStatusReasonPlaceholder: 'VD: VĐV bị thương tại CP3, dừng cuộc...',
  changeStatusReasonHelp: (n: number, min: number) => `${n}/${min} ký tự tối thiểu`,
  changeStatusConfirm: 'Xác nhận',
  changeStatusReasonRequired:
    'Lý do phải có ít nhất 10 ký tự với DSQ/DNF/CUT/MED',

  // Empty states
  emptyTitle: 'Chưa có vận động viên',
  emptyDescription:
    'Sau khi đồng bộ master data hoặc đăng ký mở, danh sách VĐV sẽ xuất hiện ở đây.',
  emptyActionMaster: 'Mở Master Data',
  zeroMatchTitle: 'Không có kết quả phù hợp',
  zeroMatchDescription: 'Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.',
  zeroMatchAction: 'Đặt lại bộ lọc',

  // Draft race guard
  guardDraftTitle: 'Giải đang ở trạng thái Nháp',
  guardDraftDescription:
    'Chuyển giải sang Chuẩn bị hoặc Đang diễn ra để bắt đầu nhập danh sách VĐV.',

  // Status (synced with athletes.constant.ts STATUS_TONES — kept here for
  // accessibility readers and screen-reader full labels)
  statusFullLabel: {
    REG: 'Đã đăng ký, chưa nhận BIB',
    PICKED: 'Đã nhận BIB, sẵn sàng xuất phát',
    DNS: 'Không xuất phát (Did Not Start)',
    LIVE: 'Đang trong cuộc đua',
    FIN: 'Hoàn thành',
    DNF: 'Bỏ cuộc giữa chừng (Did Not Finish)',
    CUT: 'Quá thời gian giới hạn (Cut Off Time)',
    DSQ: 'Bị truất quyền thi đấu (Disqualified)',
    MED: 'Đang xử lý y tế',
  } as const,

  // Toasts
  toastSaveSuccess: 'Đã cập nhật VĐV',
  toastSaveError: 'Cập nhật thất bại',
  toastStatusSuccess: 'Đã đổi trạng thái',
  toastStatusError: 'Đổi trạng thái thất bại',
  toastExportSuccess: (n: number) => `Đã xuất ${n} VĐV`,
  toastExportError: 'Xuất CSV thất bại',
  toastBulkDeferred: 'Hành động hàng loạt sẽ có ở F-014.5',
} as const;
