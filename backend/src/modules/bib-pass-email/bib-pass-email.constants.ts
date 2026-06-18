/**
 * FEATURE-091 — Border Pass email constants.
 *
 * Gửi thêm 1 ảnh "Border Pass" (cấu hình phôi giống F-090) qua email cho VĐV
 * NGAY SAU khi họ xác nhận số BIB trên legacy. KHÔNG đụng code/DB legacy:
 * chỉ SELECT read-only bảng `athletes` qua connection 'platform' để phát hiện
 * VĐV đã xác nhận (BR-01), render PNG bằng CertificateRenderService (F-090),
 * gửi qua MailService (Mandrill). Idempotent qua collection `bib_pass_sends`.
 */

/** BR-01 — VĐV "đã xác nhận BIB" khi cả 3 cột athletes đều có giá trị. */
export const BIB_PASS_DETECT = {
  /** bib_image là URL ảnh bib-spin legacy → có nghĩa đã xác nhận. */
  REQUIRE_BIB_NUMBER: true,
  REQUIRE_ROLLING_TIME: true,
  REQUIRE_BIB_IMAGE: true,
} as const;

/** BR-11 — chặn trên số email gửi mỗi lần quét/cron (fallback nếu env thiếu). */
export const BIB_PASS_DEFAULT_BATCH_LIMIT = 200;

/** Redis SETNX lock chống cron double-fire (multi-instance) theo race. */
export const BIB_PASS_LOCKS = {
  scan: (raceId: number | string) => `bib-pass-lock:${raceId}`,
  cron: (ymdHh: string) => `bib-pass-cron-lock:${ymdHh}`,
} as const;
export const BIB_PASS_LOCK_TTL_SEC = {
  scan: 120,
  cron: 110,
} as const;

/** BR-03 — token interpolate được trong layer text của phôi. */
export const BIB_PASS_TOKENS = [
  '{name}',
  '{bib}',
  '{event_name}',
  '{location}',
  '{race_day}',
  '{distance}',
  '{passport_no}',
] as const;

/** Tên file đính kèm mặc định (interpolate {bib}). */
export const BIB_PASS_ATTACHMENT_DEFAULT = 'border-pass-{bib}.png';

/** Mongo duplicate-key code (idempotency insert race). */
export const MONGO_DUP_KEY = 11000;
