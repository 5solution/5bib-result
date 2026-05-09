'use client';

/**
 * F-013 BR-RK-07 / BR-RK-01 — "Thoát Kiosk" exit button.
 *
 * Magenta-bordered touchscreen-friendly button (≥60×60px) that returns to
 * Surface 1 (admin tab body). Escape keyboard fallback owned by
 * `useKioskFullscreen` hook — this button is the touchscreen primary path.
 */

import { X } from 'lucide-react';
import { KIOSK_CONFIG } from '../kiosk.constant';
import { KIOSK_COPY } from '../kiosk.microcopy';

interface KioskExitButtonProps {
  onClick: () => void;
}

export function KioskExitButton({ onClick }: KioskExitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={KIOSK_COPY.exit.title}
      aria-label={KIOSK_COPY.exit.label}
      className="flex items-center gap-2 rounded-xl border-2 border-[#FF0E65] bg-white px-4 font-bold text-[#FF0E65] transition-transform active:scale-95"
      style={{
        minHeight: `${KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
        minWidth: `${KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
        touchAction: 'manipulation',
      }}
      data-testid="kiosk-exit-button"
    >
      <X className="h-5 w-5" aria-hidden />
      <span className="hidden sm:inline">{KIOSK_COPY.exit.label}</span>
    </button>
  );
}
