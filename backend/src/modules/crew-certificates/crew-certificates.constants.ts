/**
 * FEATURE-090 — Crew Certificate (GCN) constants.
 *
 * Standalone module: admin upload phôi + roster (Excel/CSV) → crew tìm theo tên
 * → render GCN PNG. REUSE CertificateRenderService (engine mở rộng generic
 * variables). Template embed trong batch (decouple race_id).
 */

/** BR-01 — slug public của đợt GCN. */
export const CREW_SLUG_REGEX = /^[a-z0-9-]{3,60}$/;

/** BR-02a — tối đa số dòng roster mỗi lần upload. */
export const CREW_ROSTER_MAX_ROWS = 500;

/** BR-05 — tìm kiếm: tối thiểu ký tự + giới hạn kết quả (chống enumeration). */
export const CREW_SEARCH_MIN_CHARS = 2;
export const CREW_SEARCH_MAX_RESULTS = 20;

/** BR-02 — cột bắt buộc trong roster (header tiếng Việt, so khớp lowercase/bỏ dấu). */
export const CREW_COL_FULLNAME = 'ho ten';
export const CREW_COL_POSITION = 'vi tri';
export const CREW_COL_PHOTO = 'anh';

/** S3 folder phôi nền (lifecycle rule 8 — persist). */
export const CREW_ASSETS_FOLDER = 'crew-certificates';

/** BR-11 — Redis render cache + lock (port F-089/landing). */
export const CREW_CACHE = {
  RENDER_PREFIX: 'crew-cert:render:',
  LOCK_PREFIX: 'crew-cert-lock:',
  RENDER_TTL_SECONDS: 600,
  LOCK_TTL_SECONDS: 5,
  LOCK_RETRY_MAX: 3,
  LOCK_RETRY_SLEEP_MS: 200,
} as const;

/** BR-06 — photoUrl chỉ http/https (chống SSRF khi engine loadImage). */
export const CREW_PHOTO_URL_REGEX = /^https?:\/\/.+/i;
