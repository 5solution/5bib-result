import { randomInt } from 'crypto';

/**
 * FEATURE-089 — Short link rút gọn URL.
 *
 * Generic URL shortener: admin dán URL bất kỳ → short code → redirect 302.
 * Redirect được phục vụ ở FRONTEND (middleware `s.5bib.com/<code>` → `/r/<code>`
 * route handler) gọi backend resolve API. Backend chỉ giữ data + resolve sạch.
 * Cache + SETNX anti-stampede port pattern F-083 LandingService.
 */

/** Host hiển thị cho short link. Override qua env cho dev. */
export const SHORTLINK_BASE_HOST =
  process.env.SHORTLINK_BASE_HOST ?? 's.5bib.com';

/** BR-01 — độ dài code random. */
export const SHORTLINK_CODE_LENGTH = 6;

/** base62 alphabet cho code random (BR-01). */
export const SHORTLINK_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Số lần retry khi random code đụng unique index (BR-01). */
export const SHORTLINK_CODE_MAX_RETRY = 5;

/** BR-02 — custom alias format. */
export const SHORTLINK_ALIAS_REGEX = /^[A-Za-z0-9_-]{3,32}$/;

/** BR-04 — targetUrl bắt buộc http/https (chống open-redirect). */
export const SHORTLINK_URL_REGEX = /^https?:\/\/.+/i;
export const SHORTLINK_URL_MAX = 2048;

/**
 * BR-03 — code KHÔNG được trùng reserved words (đụng route/subdomain hệ thống).
 * So sánh lowercase.
 */
export const SHORTLINK_RESERVED = new Set<string>([
  'r',
  'api',
  'admin',
  'health',
  'www',
  'result',
  'app',
  's',
  'go',
  'link',
  'assets',
  'static',
  'favicon.ico',
  'robots.txt',
]);

/** BR-12 — Redis keys + tuning (port F-083 LANDING_CACHE). */
export const SHORTLINK_CACHE = {
  CODE_PREFIX: 'shortlink:code:',
  LOCK_PREFIX: 'shortlink-lock:',
  CACHE_TTL_SECONDS: 3600,
  LOCK_TTL_SECONDS: 5,
  LOCK_RETRY_MAX: 3,
  LOCK_RETRY_SLEEP_MS: 200,
} as const;

/** BR-03 — alias/code có bị reserved không (lowercase compare). */
export function isReservedCode(code: string): boolean {
  return SHORTLINK_RESERVED.has(code.toLowerCase());
}

/** BR-01 — sinh 1 code base62 ngẫu nhiên (crypto random, không phải Math.random). */
export function generateRandomCode(length = SHORTLINK_CODE_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SHORTLINK_ALPHABET[randomInt(SHORTLINK_ALPHABET.length)];
  }
  return out;
}

/** Build short URL hiển thị từ code. */
export function buildShortUrl(code: string): string {
  return `https://${SHORTLINK_BASE_HOST}/${code}`;
}
