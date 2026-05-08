/**
 * F-015 BR-CK-16 — Vietnamese microcopy (Phase 1 VN-only).
 *
 * Scope-local — not hoisted to a shared module. Phase 2 EN/CN i18n forks
 * keys when proper i18n module lands.
 */

export const CHECKIN_COPY = {
  // Surface 1 — admin tab body
  tab: {
    eyebrow: 'RACE · CHECK-IN KIOSK',
    title: 'Check-In Kiosk',
    meta: 'Pickup BIB tại lều BTC',
    description:
      'Kiosk lều phát BIB. Bấm "Bật chế độ Kiosk" → fullscreen → BTC quét QR / nhập BIB / nhập CMND để xác nhận đã giao racekit cho athlete.',
    enterButton: 'Bật chế độ Kiosk',
    enterHint:
      'Tap target ≥60×60px · Idle reset 60s · VN-only MVP · Cần kết nối realtime',
    draftEmpty: 'Race chưa publish — Kiosk chưa khả dụng',
    draftEmptyHint:
      'Khi race chuyển sang pre_race / live / ended, nút "Bật chế độ Kiosk" sẽ khả dụng.',
    settingsTitle: 'Cài đặt station',
    stationLabel: 'Mã station',
    stationHint: 'Chọn 1-10. Mỗi iPad ↔ 1 station ID riêng.',
    soundLabel: 'Âm thanh',
    soundOnText: 'Bật',
    soundOffText: 'Tắt',
    windowTitle: 'Cửa pickup',
    windowOpenLabel: 'Mở từ',
    windowCloseLabel: 'Đến',
    windowNotConfigured: 'Chưa cấu hình. Vào Settings → Race để set.',
    statsTitle: 'Tiến độ pickup',
    stationsTableTitle: 'Stations đang active',
    feedTitle: 'Pickup gần đây',
    feedEmpty: 'Chưa có pickup nào trong session này.',
    feedRow: (bib: string, name: string, station: string, ago: string) =>
      `BIB ${bib} · ${name} · Station ${station} · ${ago}`,
  },
  // Surface 2 — lookup input
  input: {
    title: 'Tra cứu athlete',
    raceLine: (race: string, station: string) => `${race} · Station ${station}`,
    qrButton: 'Quét QR',
    qrHint: 'Cho phép camera khi browser hỏi',
    qrScanning: 'Đang quét — đưa QR vào khung...',
    qrError: 'Không thể truy cập camera',
    qrCancel: 'Đóng camera',
    bibPadTitle: 'Nhập BIB',
    bibPlaceholder: '_',
    bibSubmit: 'Tìm',
    cmndExpand: 'Hoặc nhập 4 số cuối CMND/CCCD',
    cmndCollapse: 'Đóng',
    cmndHelper: 'Nhập 4 số cuối CMND/CCCD của athlete',
    cmndSubmit: 'Tìm',
    cmndPlaceholder: '____',
    orDivider: 'hoặc',
    networkError: 'Lỗi kết nối — thử lại',
    notFound: (val: string) => `Không tìm thấy "${val}". Kiểm tra lại hoặc dùng QR.`,
    cmndNotFound: 'Không tìm thấy athlete khớp 4 số cuối CMND.',
    cmndMultiCandidate: (n: number) => `Tìm thấy ${n} athletes. Chọn đúng người:`,
    chooseCandidate: 'Chọn',
    closedTitle: 'Đóng cửa pickup',
    closedSubtitle: (start: string, end: string) =>
      `Pickup mở từ ${start} đến ${end}. Liên hệ admin nếu cần ngoài giờ.`,
    helpLink: 'Liên hệ admin',
    digitLabel: (digit: number) => `Phím số ${digit}`,
    clearLabel: 'Xoá',
    backspaceLabel: 'Xoá ký tự cuối',
    soundOn: 'Tắt âm thanh',
    soundOff: 'Bật âm thanh',
  },
  // Surface 3 — result + confirm
  result: {
    confirmButton: 'Xác nhận đã giao',
    cancelButton: 'Hủy',
    submitting: 'Đang xác nhận...',
    successTitle: 'Đã giao racekit',
    successHint: (sec: number) => `Tự động về lookup trong ${sec}s...`,
    alreadyTitle: 'BIB này đã được pickup',
    alreadyHint: (when: string, station: string) =>
      `Lúc ${when} tại Station ${station}. Phase 1 không cho phép re-print.`,
    backToInput: 'Quay lại',
    conflictTitle: 'Xung đột — đang đồng bộ',
    conflictHint: 'BIB này vừa được pickup tại station khác. Đang sync...',
    networkErrorTitle: 'Lỗi kết nối',
    networkErrorHint: 'Thử lại sau vài giây.',
    retry: 'Thử lại',
    bibLabel: 'BIB',
    courseLabel: 'Course',
    sizeLabel: 'Size áo',
    chipBadge: 'Đã verify chip',
    racekitOkBadge: 'Đã pickup racekit',
    racekitWaitBadge: 'Chưa pickup',
  },
  // Banners
  banners: {
    onlineRequired:
      'Phase 1 chỉ chạy được khi có kết nối realtime. Nếu mạng yếu vui lòng đứng gần router.',
    sseDisconnected:
      'Mất kết nối realtime — đang dùng polling 30s/lần. Reconnecting...',
    sseReconnecting: 'Đang reconnect SSE...',
    sseConnected: 'Đã reconnect realtime.',
    outsideWindow: (start: string, end: string) =>
      `Ngoài cửa pickup (${start}–${end}).`,
  },
  // Idle countdown
  idle: {
    title: 'Quay lại lookup',
    countdown: (sec: number) => `${sec}s...`,
    dismiss: 'Tap để dừng',
  },
  // Exit kiosk
  exit: {
    label: 'Thoát Kiosk',
    title: 'Thoát chế độ Kiosk (Esc)',
  },
  // Multi-station status
  status: {
    perStation: (station: string, count: number) => `Station ${station}: ${count}`,
    global: (current: number, total: number) =>
      total > 0 ? `Tổng: ${current.toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')}` : `Tổng: ${current.toLocaleString('vi-VN')}`,
    rate: (perMin: number) => `${perMin} pickup/phút`,
  },
} as const;
