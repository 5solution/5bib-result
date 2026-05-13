/**
 * F-029 BR-HD-32 — Central VN dictionary cho timing-alert + simulator status enums.
 *
 * Display Convention: raw enum string KHÔNG được render JSX text — phải map qua
 * label dictionary tiếng Việt trước. Backend giữ enum gốc (English) — KHÔNG đổi.
 *
 * Pattern: `<Badge>{TIMING_SIMULATOR_STATUS_LABEL[status] ?? status}</Badge>`
 * — fallback raw value để dev nhận biết khi backend trả enum chưa map.
 */

/**
 * TimingAlertSimulator status states. Keys match backend enum
 * `TimingAlertSimulatorStatus` (see `timing-alert-simulator.schema.ts`).
 * TODO Coder verify keys against backend enum if any new state added.
 */
export const TIMING_SIMULATOR_STATUS_LABEL: Record<string, string> = {
  IDLE: "Chưa chạy",
  RUNNING: "Đang chạy",
  PAUSED: "Đang tạm dừng",
  COMPLETED: "Đã hoàn tất",
  FAILED: "Thất bại",
};

/**
 * TimingAlert lifecycle status. Keys match backend `TimingAlertStatus`
 * (see `timing-alert.schema.ts`).
 * TODO Coder verify keys against backend enum if any new state added.
 */
export const ALERT_STATUS_LABEL: Record<string, string> = {
  NEW: "Mới phát sinh",
  OPEN: "Đang mở",
  ACKNOWLEDGED: "Đã xác nhận",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
  AUTO_RESOLVED: "Tự động giải quyết",
  DISMISSED: "Đã bỏ qua",
};
