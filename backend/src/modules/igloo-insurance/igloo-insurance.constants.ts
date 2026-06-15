/**
 * FEATURE-085 — Igloo Insurance constants.
 */

/**
 * Trạng thái đơn (local state machine). `QUEUED` là trạng thái nội bộ TRƯỚC
 * khi gửi Igloo; phần còn lại mirror trạng thái Igloo/GIC.
 *   QUEUED → submit-worker → PENDING(+iglooRequestId) → poll-worker →
 *   PROCESSING → GET_CERTI_PROCESSING → SUCCESS | FAILED | CANCELLED
 */
export const IGLOO_STATUSES = [
  'QUEUED',
  'PENDING',
  'PROCESSING',
  'GET_CERTI_PROCESSING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
] as const;
export type IglooStatus = (typeof IGLOO_STATUSES)[number];

/** Trạng thái "đã xong" (không poll nữa). */
export const IGLOO_TERMINAL_STATUSES: IglooStatus[] = [
  'SUCCESS',
  'FAILED',
  'CANCELLED',
];

/**
 * Trạng thái coi như "đã có đơn" → loại VĐV khỏi pool + idempotency skip
 * (BR-IGL-06/06b). FAILED/CANCELLED KHÔNG nằm đây → cho phép tạo lại.
 */
export const IGLOO_ACTIVE_STATUSES: IglooStatus[] = [
  'QUEUED',
  'PENDING',
  'PROCESSING',
  'GET_CERTI_PROCESSING',
  'SUCCESS',
];

export const IGLOO_SOURCES = ['cron', 'manual'] as const;
export type IglooSource = (typeof IGLOO_SOURCES)[number];

/** Số lần retry tối đa cho đơn FAILED (BR-IGL-11). */
export const IGLOO_MAX_RETRY = 3;

/** Redis SETNX locks (BR-IGL-13). */
export const IGLOO_LOCKS = {
  daily: (ymd: string) => `igloo:daily-lock:${ymd}`,
  submit: 'igloo:submit-lock',
  poll: 'igloo:poll-lock',
};
export const IGLOO_LOCK_TTL_SEC = {
  daily: 23 * 3600,
  submit: 110,
  poll: 110,
};

/** Số đơn submit/poll mỗi tick (rate-limit thân thiện). */
export const IGLOO_SUBMIT_BATCH = 20;
export const IGLOO_POLL_BATCH = 30;

/** Igloo partner API paths. */
export const IGLOO_API = {
  createRequest: '/api/v1/partner/insurance/requests',
  getRequest: (id: string) => `/api/v1/partner/insurance/requests/${id}`,
};
