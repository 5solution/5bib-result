/**
 * F-013 PAUSE-RK-09 — Vietnamese microcopy (Phase 1 VN-only).
 *
 * Scope-local — not hoisted to a shared module. Phase 2 EN toggle can fork
 * keys when proper i18n module lands. Customer-facing strings live here so
 * QC can audit in one file.
 */

export const KIOSK_COPY = {
  // Surface 1 — admin tab body
  tab: {
    eyebrow: 'RACE · RESULT KIOSK',
    title: 'Result Kiosk',
    meta: 'Tra cứu kết quả tại lều BTC',
    description:
      'Kiosk = lều BTC tra cứu kết quả cho athlete. Bấm "Bật chế độ Kiosk" → fullscreen + ẩn admin chrome → athlete tap BIB → xem chip time + gun time + rank.',
    enterButton: 'Bật chế độ Kiosk',
    enterHint:
      'Tap target ≥60×60px · Idle reset 60s · VN-only MVP · Sound default ON',
    draftEmpty: 'Race chưa publish — Kiosk chưa khả dụng',
    draftEmptyHint:
      'Khi race chuyển sang pre_race / live / ended, nút "Bật chế độ Kiosk" sẽ khả dụng.',
  },
  // Surface 2 — BIB input
  input: {
    raceLine: (race: string, course?: string) =>
      course ? `${race} · ${course}` : race,
    title: 'Nhập BIB của bạn',
    placeholder: '_',
    submit: 'Tìm',
    clearLabel: 'Xoá',
    backspaceLabel: 'Xoá ký tự cuối',
    digitLabel: (digit: number) => `Phím số ${digit}`,
    soundOn: 'Tắt âm thanh',
    soundOff: 'Bật âm thanh',
    networkError: 'Lỗi kết nối — thử lại',
    retry: 'Thử lại',
    poweredBy: 'Powered by 5BIB',
  },
  // Surface 3 — result display
  result: {
    notFound: 'Không tìm thấy BIB này',
    notFoundHint: (sec: number) => `Quay lại tìm kiếm trong ${sec}s...`,
    dataError: 'Lỗi dữ liệu — thử lại',
    badge: {
      FIN: 'Hoàn thành',
      DNS: 'Chưa start',
      DNF: 'Bỏ cuộc',
      DSQ: 'Vi phạm — DSQ',
      LIVE: 'Đang trên đường',
    },
    chipTimeLabel: 'Chip time',
    gunTimeLabel: 'Gun time',
    overallRankLabel: 'Hạng chung cuộc',
    genderRankLabel: 'Hạng giới',
    catRankLabel: 'Hạng nhóm tuổi',
    splitsTitle: 'Chặng',
    splitsToggleShow: 'Xem chặng',
    splitsToggleHide: 'Ẩn chặng',
    lastCpLabel: 'CP cuối',
    elapsedLabel: 'Thời gian đã chạy',
    livePartial: 'Đang trên đường — chưa qua Finish',
    dsqReasonLabel: 'Lý do',
    rankPlaceholder: '—',
    lookupAnother: 'Tìm BIB khác',
    ariaResult: (name: string, time: string, rank: string) =>
      `Kết quả: ${name}, thời gian ${time}, hạng ${rank}`,
  },
  // Idle overlay
  idle: {
    title: 'Quay lại tìm kiếm',
    countdown: (sec: number) => `${sec}s...`,
    dismiss: 'Tap để dừng',
  },
  // Exit kiosk
  exit: {
    label: 'Thoát Kiosk',
    title: 'Thoát chế độ Kiosk (Esc)',
  },
  // F-017 — Chip scan flow
  chip: {
    waitingTitle: 'Vui lòng dí chip BIB vào đầu đọc',
    waitingHint: 'Đầu đọc sẽ tự nhận chip — không cần bấm phím',
    fallbackCta: 'Nhập BIB thủ công',
    raceNotMappedTitle: 'Chip Verify chưa enable',
    raceNotMappedBody:
      'BTC cần vào tab Chip Verify → Enable + import chip mappings trước race-day để chế độ kiosk chip-scan hoạt động.',
    chipNotFoundTitle: 'Chip chưa map BIB',
    chipNotFoundBody: (chipId: string) =>
      `Chip ${chipId} chưa được gán cho VĐV nào — kiểm tra danh sách mapping ở tab Chip Verify.`,
    chipDisabledTitle: 'Chip bị disable',
    chipDisabledBody: (bib: string) =>
      `BIB ${bib} đã bị disable — liên hệ Race Director để xử lý.`,
    operationalWarning:
      '⚠️ Chip Verification chưa enable cho race này. Vào tab Chip Verify → Enable + import chip mappings trước race-day.',
  },
  // F-017 — Display config UI labels
  config: {
    cta: 'Cấu hình hiển thị',
    title: 'Cấu hình hiển thị Result Kiosk',
    presetLabel: 'Preset',
    heroLabel: 'Khu vực Hero',
    sectionsLabel: 'Section hiển thị',
    themeLabel: 'Màu chủ đạo',
    customMessageLabel: 'Tin nhắn tùy chỉnh',
    sponsorLogosLabel: 'Logo nhà tài trợ',
    soundLabel: 'Âm thanh',
    idleLabel: 'Tự reset (giây)',
    save: 'Lưu',
    cancel: 'Huỷ',
    preview: 'Xem trước',
    presets: {
      DEFAULT: 'Mặc định',
      MINIMAL: 'Tối giản',
      PREMIUM: 'Cao cấp',
      CUSTOM: 'Tùy chỉnh',
    },
    heroChoices: {
      'rank': 'Hạng chung cuộc',
      'finish-time': 'Thời gian về đích',
      'photo': 'Ảnh VĐV',
    },
    sections: {
      rank: 'Hạng',
      finishTime: 'Thời gian',
      splits: 'Chặng',
      sponsorBanner: 'Banner sponsor',
      customMessage: 'Tin nhắn',
      qrShare: 'QR chia sẻ (Phase 2)',
      photo: 'Ảnh VĐV',
    },
  },
} as const;
