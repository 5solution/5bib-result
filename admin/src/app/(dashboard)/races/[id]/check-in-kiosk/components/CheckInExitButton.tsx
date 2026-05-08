'use client';

/**
 * F-015 BR-CK-14 — "Thoát Kiosk" exit button (mirror F-013 KioskExitButton).
 */

import { X } from 'lucide-react';
import { SHARED_KIOSK_CONFIG } from '@/lib/kiosk';
import { CHECKIN_COPY } from '../checkin.microcopy';

interface CheckInExitButtonProps {
  onClick: () => void;
}

export function CheckInExitButton({ onClick }: CheckInExitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={CHECKIN_COPY.exit.title}
      aria-label={CHECKIN_COPY.exit.label}
      className="flex items-center gap-2 rounded-xl border-2 border-[#FF0E65] bg-white px-4 font-bold text-[#FF0E65] transition-transform active:scale-95"
      style={{
        minHeight: `${SHARED_KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
        minWidth: `${SHARED_KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
        touchAction: 'manipulation',
      }}
      data-testid="check-in-exit-button"
    >
      <X className="h-5 w-5" aria-hidden />
      <span className="hidden sm:inline">{CHECKIN_COPY.exit.label}</span>
    </button>
  );
}
