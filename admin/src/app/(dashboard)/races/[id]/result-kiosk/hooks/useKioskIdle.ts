'use client';

/**
 * F-013 BR-RK-06 — Idle timer with last-N-second countdown.
 *
 * Watches user activity (touch / mouse / keyboard / scroll) and fires
 * `onIdle()` after `timeoutMs`. During the last `countdownMs` window emits a
 * decreasing seconds-remaining value via `idleSecondsRemaining` (null while
 * outside the countdown window) so the overlay component can render the
 * countdown chrome.
 *
 * Tap on the overlay is a normal "activity" event → resets the timer.
 *
 * Implementation uses setInterval (not RAF) — countdown granularity is 1Hz,
 * RAF would burn CPU at 60Hz for no UX benefit and races against jest fake
 * timers in tests.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { KIOSK_CONFIG } from '../kiosk.constant';

const ACTIVITY_EVENTS = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const;

export interface UseKioskIdleOptions {
  /** Whether the timer is active. False = paused. */
  enabled: boolean;
  /** Total idle window before `onIdle` fires. Defaults to KIOSK_CONFIG.IDLE_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Last-N-ms window where countdown overlay should display. Defaults to KIOSK_CONFIG.IDLE_COUNTDOWN_LAST_MS. */
  countdownMs?: number;
  /** Callback fired when timer reaches zero. */
  onIdle: () => void;
}

export interface UseKioskIdleReturn {
  /** Seconds remaining inside the countdown window; null otherwise. */
  idleSecondsRemaining: number | null;
  /** Manually reset the timer (e.g. when overlay is tapped). */
  reset: () => void;
}

export function useKioskIdle({
  enabled,
  timeoutMs = KIOSK_CONFIG.IDLE_TIMEOUT_MS,
  countdownMs = KIOSK_CONFIG.IDLE_COUNTDOWN_LAST_MS,
  onIdle,
}: UseKioskIdleOptions): UseKioskIdleReturn {
  const [idleSecondsRemaining, setIdleSecondsRemaining] = useState<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const reset = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIdleSecondsRemaining(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIdleSecondsRemaining(null);
      return;
    }
    if (typeof window === 'undefined') return;

    lastActivityRef.current = Date.now();

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      setIdleSecondsRemaining((curr) => (curr === null ? curr : null));
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    let firedThisCycle = false;
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        if (!firedThisCycle) {
          firedThisCycle = true;
          setIdleSecondsRemaining(null);
          onIdleRef.current();
          // After fire, reset for next cycle (consumer typically calls reset()
          // anyway when re-entering input screen).
          lastActivityRef.current = Date.now();
          firedThisCycle = false;
        }
        return;
      }

      if (remaining <= countdownMs) {
        setIdleSecondsRemaining(Math.ceil(remaining / 1000));
      } else {
        setIdleSecondsRemaining((curr) => (curr === null ? curr : null));
      }
    }, 250);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      window.clearInterval(interval);
    };
  }, [enabled, timeoutMs, countdownMs]);

  return { idleSecondsRemaining, reset };
}
