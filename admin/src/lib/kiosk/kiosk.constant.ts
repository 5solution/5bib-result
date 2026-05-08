/**
 * Shared kiosk constants — minted by F-015 (TD-F015-01 retrofit target for F-013).
 *
 * Single source of truth for kiosk numerics shared across admin kiosk-mode
 * features (F-013 Result Kiosk + F-015 Check-In Kiosk + future F-016+
 * Volunteer Hub kiosk surfaces). Scope-local feature constants (BIB max
 * length, station count, etc.) stay inside their feature folder.
 */

export const SHARED_KIOSK_CONFIG = {
  /** Idle timeout before auto-reset to feature-defined home surface (ms). */
  IDLE_TIMEOUT_MS: 60_000,
  /** Last-N-ms window inside idle timer where countdown overlay should display. */
  IDLE_COUNTDOWN_LAST_MS: 10_000,
  /** Web Audio success beep frequency (Hz) and duration (ms). */
  BEEP_SUCCESS_HZ: 800,
  BEEP_SUCCESS_MS: 100,
  /** Web Audio error beep frequency, duration, repeat, gap (ms). */
  BEEP_ERROR_HZ: 300,
  BEEP_ERROR_MS: 200,
  BEEP_ERROR_REPEAT: 2,
  BEEP_ERROR_GAP_MS: 200,
  /** Touchscreen tap-target minimum (px) — inherited by feature buttons. */
  TAP_TARGET_MIN_PX: 60,
  /** localStorage key for sound on/off (shared across kiosk modes). */
  SOUND_LS_KEY: '5bib:kiosk-sound',
} as const;

export type SharedKioskConfig = typeof SHARED_KIOSK_CONFIG;
