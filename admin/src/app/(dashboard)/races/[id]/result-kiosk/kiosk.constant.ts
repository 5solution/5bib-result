/**
 * F-013 BR-RK-01..11 — Result Kiosk shared constants.
 *
 * Single source of truth (F-012 shared-constant pattern). All numerics
 * referenced by hooks / components / tests resolve here so Phase 2 admin
 * configurability becomes a single export swap.
 */

export const KIOSK_CONFIG = {
  /** BR-RK-01: BIB max length (5BIB platform convention). */
  BIB_MAX_LENGTH: 6,
  /** BR-RK-06: idle timeout before auto-reset to BIB input home. */
  IDLE_TIMEOUT_MS: 60_000,
  /** BR-RK-06: countdown overlay window (last 10s of idle timer). */
  IDLE_COUNTDOWN_LAST_MS: 10_000,
  /** BR-RK-02: not-found auto-reset window. */
  NOT_FOUND_AUTO_RESET_MS: 5_000,
  /** BR-RK-10: Web Audio success beep frequency / duration. */
  BEEP_SUCCESS_HZ: 800,
  BEEP_SUCCESS_MS: 100,
  /** BR-RK-10: Web Audio error beep frequency / duration / repeat. */
  BEEP_ERROR_HZ: 300,
  BEEP_ERROR_MS: 200,
  BEEP_ERROR_REPEAT: 2,
  BEEP_ERROR_GAP_MS: 200,
  /** Touchscreen UX minimums. */
  TAP_TARGET_MIN_PX: 60,
  DIGIT_BUTTON_PX: 80,
  /** BR-RK-10: localStorage persistence key for sound toggle. */
  SOUND_LS_KEY: '5bib:kiosk-sound',
  /** Animation duration cap (200ms transitions per PRD §5). */
  TRANSITION_MS: 200,
} as const;

export type KioskConfig = typeof KIOSK_CONFIG;
