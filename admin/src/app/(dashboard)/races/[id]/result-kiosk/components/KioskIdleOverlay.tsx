'use client';

/**
 * F-013 BR-RK-06 — Idle countdown overlay shown during the last 10s of idle.
 *
 * - Visible only when `secondsRemaining` is non-null (parent useKioskIdle gate).
 * - Tap anywhere on overlay = early dismiss → calls `onDismiss` to reset timer.
 * - Honors `prefers-reduced-motion` (no scale-in animation).
 */

import { KIOSK_COPY } from '../kiosk.microcopy';

interface KioskIdleOverlayProps {
  secondsRemaining: number | null;
  onDismiss: () => void;
}

export function KioskIdleOverlay({ secondsRemaining, onDismiss }: KioskIdleOverlayProps) {
  if (secondsRemaining === null) return null;

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={KIOSK_COPY.idle.dismiss}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/80 text-white transition-opacity motion-reduce:transition-none"
      data-testid="kiosk-idle-overlay"
    >
      <div className="text-2xl font-medium">{KIOSK_COPY.idle.title}</div>
      <div
        className="mt-4 font-mono text-8xl font-bold tabular-nums"
        data-testid="kiosk-idle-countdown"
      >
        {KIOSK_COPY.idle.countdown(secondsRemaining)}
      </div>
      <div className="mt-6 text-sm text-stone-300">{KIOSK_COPY.idle.dismiss}</div>
    </button>
  );
}
