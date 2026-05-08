/**
 * F-015 BR-CK-01..22 — Check-In Kiosk feature constants.
 *
 * Single source of truth for feature-local numerics. Shared kiosk constants
 * (idle timeout / beep freq / SOUND_LS_KEY) live in `@/lib/kiosk` —
 * scope-local feature constants live here.
 */

export const CHECKIN_CONFIG = {
  /** BR-CK-01: BIB max length (5BIB platform convention). */
  BIB_MAX_LENGTH: 6,
  /** BR-CK-10: CMND last-N digits typed by BTC for fuzzy match. */
  CMND_LAST_DIGITS: 4,
  /** BR-CK-02: not-found auto-reset window for inline error toast. */
  NOT_FOUND_AUTO_RESET_MS: 5_000,
  /** BR-CK-05: post-409 cooldown before kiosk re-enables input. */
  CONFLICT_COOLDOWN_MS: 3_000,
  /** Surface 3 success → auto-redirect to lookup screen. */
  SUCCESS_AUTO_RESET_MS: 1_500,
  /** BR-CK-22: lookup endpoint timeout client-side hint. */
  LOOKUP_TIMEOUT_MS: 8_000,
  /** SSE reconnect: max consecutive failures before falling back to polling. */
  SSE_MAX_FAILURES_BEFORE_POLLING: 3,
  /** SSE polling fallback interval (ms). */
  SSE_POLLING_FALLBACK_MS: 30_000,
  /** Number of pickup-feed events to retain in scrollback. */
  RECENT_FEED_LIMIT: 20,
  /** BR-CK-17: ConfirmPickup tap target dimensions. */
  CONFIRM_BUTTON_MIN_WIDTH_PX: 480,
  CONFIRM_BUTTON_MIN_HEIGHT_PX: 120,
  /** Station picker range. */
  STATION_MIN: 1,
  STATION_MAX: 10,
  /** localStorage key for selected station (per-device). */
  STATION_LS_KEY: '5bib:checkin-station',
  /** SSE event types broadcast by backend. */
  SSE_EVENT_PICKUP: 'pickup',
  SSE_EVENT_HEARTBEAT: 'heartbeat',
  /** Lookup mode literals (BR-CK source field on `check_in_logs`). */
  SOURCE_QR: 'qr',
  SOURCE_BIB: 'bib',
  SOURCE_CMND: 'cmnd',
} as const;

export type CheckInConfig = typeof CHECKIN_CONFIG;
export type LookupSource = typeof CHECKIN_CONFIG.SOURCE_QR | typeof CHECKIN_CONFIG.SOURCE_BIB | typeof CHECKIN_CONFIG.SOURCE_CMND;
