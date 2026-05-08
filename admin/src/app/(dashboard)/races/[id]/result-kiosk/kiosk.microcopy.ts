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
} as const;
