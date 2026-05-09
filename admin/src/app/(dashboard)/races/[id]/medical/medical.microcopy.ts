/**
 * F-018 — VN microcopy + EN labels per BR-AF-02.
 * Race-day BTC operator vocabulary — operational verbs, not clinical jargon
 * (advisory Insight 2).
 */

import {
  Category,
  ClosureReason,
  IncidentState,
  Severity,
  TraumaSubtype,
} from './medical.constant';

/** F-018 BR-MI-02 — VN action-verb labels (advisory §1.B Option B). */
export const SEVERITY_VN: Record<Severity, string> = {
  1: 'Nhẹ — Sơ cứu tại chỗ',
  2: 'Trung bình — Cần y tá xử lý',
  3: 'Nghiêm trọng — Đưa về lều y tế',
  4: 'Nặng — Chuyển viện',
  5: 'Nguy kịch — Hồi sức cấp cứu',
};

export const SEVERITY_SHORT_VN: Record<Severity, string> = {
  1: 'Nhẹ',
  2: 'Trung bình',
  3: 'Nghiêm trọng',
  4: 'Nặng',
  5: 'Nguy kịch',
};

export const SEVERITY_EN: Record<Severity, string> = {
  1: 'Minor',
  2: 'Moderate',
  3: 'Serious',
  4: 'Severe',
  5: 'Life-threatening',
};

/** F-018 BR-MI-06 — 8 categories Phase 1 (advisory §2.B). */
export const CATEGORY_VN: Record<Category, string> = {
  cardiac: 'Tim mạch',
  trauma: 'Chấn thương',
  heat_stroke: 'Sốc nhiệt / Kiệt sức do nóng',
  dehydration: 'Mất nước',
  musculoskeletal: 'Cơ-xương (chuột rút / căng cơ)',
  neurological: 'Thần kinh (bất tỉnh / co giật)',
  allergic: 'Dị ứng / Sốc phản vệ',
  other: 'Khác (mô tả)',
};

export const TRAUMA_SUBTYPE_VN: Record<TraumaSubtype, string> = {
  fall: 'Té ngã',
  laceration: 'Vết rách',
  head: 'Đầu (LOC / SCAT5)',
  other: 'Khác',
};

/** F-018 BR-MI-11 — state machine VN labels (advisory §3.A). */
export const STATE_VN: Record<IncidentState, string> = {
  REPORTED: 'Đã ghi nhận',
  MEDIC_DISPATCHED: 'Đã điều y tế',
  MEDIC_ON_SITE: 'Y tế đã đến',
  AMB_REQUESTED: 'Đã gọi cấp cứu',
  HOSPITAL_TRANSFER: 'Đã chuyển viện',
  RESOLVED_ONSITE: 'Đã xử lý tại chỗ',
  RESOLVED_DNF: 'Đã xử lý — DNF',
  CLOSED: 'Đã đóng (hoàn tất hồ sơ)',
};

export const CLOSURE_REASON_VN: Record<ClosureReason, string> = {
  RESOLVED: 'Đã giải quyết',
  FALSE_ALARM: 'Báo nhầm (chỉ Race Director)',
  DUPLICATE: 'Trùng lặp',
  ATHLETE_REFUSED_TREATMENT: 'VĐV từ chối điều trị',
};

/** Operator-facing strings (form headers, empty states, etc.). */
export const COPY = {
  tab: {
    label: 'Y tế',
    tooltip: 'Y tế / Medical',
  },
  page: {
    title: 'Sự cố Y tế',
    cta: 'Báo cáo Y tế mới',
    activeBadgePrefix: 'đang mở',
  },
  empty: {
    noIncidents: 'Chưa có sự cố y tế nào. Tốt — race đang an toàn.',
    filteredZero: 'Không có sự cố khớp bộ lọc',
    clearFilters: 'Xóa bộ lọc',
    raceDraft:
      'Race chưa bắt đầu. Module y tế mở khi race chuyển sang pre_race.',
  },
  error: {
    generic: 'Lỗi tải danh sách. Thử lại?',
    retry: 'Thử lại',
    bibLookup: 'Không tìm thấy VĐV với BIB này',
    photoUpload: 'Lỗi tải ảnh. Đang lưu hàng đợi...',
  },
  form: {
    title: 'Báo cáo Y tế mới',
    severityHeading: 'Mức độ',
    categoryHeading: 'Loại sự cố',
    gpsHeading: 'Vị trí',
    optionalSection: 'Thêm chi tiết (không bắt buộc)',
    bibLabel: 'BIB VĐV',
    bibPlaceholder: 'Nhập BIB hoặc bỏ trống nếu không xác định',
    nameLabel: 'Tên VĐV',
    descLabel: 'Mô tả chi tiết',
    photoLabel: 'Ảnh chứng minh',
    photoRequiredHint: '* Bắt buộc với mức Nặng/Nguy kịch',
    witnessLabel: 'Nhân chứng',
    witnessRequiredHint: '* Cần ≥2 nhân chứng để đóng hồ sơ Sev 4-5',
    submit: 'Gửi báo cáo',
    submitting: 'Đang gửi...',
    cancel: 'Huỷ',
    autoSuggestPrefix: 'Đề xuất:',
    autoSuggestSuffix: '(có thể đổi)',
  },
  sevConfirm: {
    title4: 'Xác nhận mức độ NẶNG',
    title5: 'Xác nhận mức độ NGUY KỊCH',
    body: 'Hành động này sẽ thông báo Race Director và bệnh viện. Tiếp tục?',
    confirm: 'Xác nhận',
    cancel: 'Huỷ',
    undoToast: 'Báo cáo đã gửi — hoàn tác trong 5s',
  },
  detail: {
    title: 'Chi tiết sự cố',
    timeline: 'Lịch sử trạng thái',
    transitionCta: 'Chuyển trạng thái',
    requestAmbulance: 'Yêu cầu xe cứu thương',
    exportPdf: 'Xuất báo cáo PDF',
    closedBanner: 'Sự cố đã đóng',
    slaBreached: 'Vượt SLA',
    medicTeam: 'Đội y tế phụ trách',
    addMedic: 'Thêm thành viên',
  },
  offline: {
    banner:
      'Đang offline — Form vẫn hoạt động, dữ liệu sẽ đồng bộ khi có mạng.',
    queueBadge: 'Đang chờ đồng bộ',
    syncedToast: 'Đã đồng bộ',
    syncErrorToast: 'Đồng bộ lỗi — sẽ thử lại',
  },
  validation: {
    needOneOf: 'Cần ít nhất một trong: BIB, Tên VĐV, Mô tả',
    photoRequired: 'Cần tối thiểu 1 ảnh cho mức Nặng/Nguy kịch',
    otherDescTooShort: 'Danh mục "Khác" yêu cầu mô tả tối thiểu 10 ký tự',
    traumaSubtypeRequired: 'Chấn thương yêu cầu chọn sub-type',
    closureReasonRequired: 'Cần chọn lý do đóng hồ sơ',
    falseAlarmReasonRequired: 'FALSE_ALARM yêu cầu nhập lý do',
    closeSignatureRequired:
      'CLOSED transition cần chữ ký Trưởng Y tế cuộc đua',
  },
  sse: {
    connected: 'Realtime SSE: connected',
    reconnecting: 'Đang kết nối lại...',
    disconnected: 'Mất kết nối SSE',
  },
} as const;
