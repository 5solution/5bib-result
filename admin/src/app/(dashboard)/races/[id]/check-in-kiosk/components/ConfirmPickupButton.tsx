'use client';

/**
 * F-015 BR-CK-04/13/17 — Confirm Pickup atomic CTA.
 *
 * Tap target ≥ 480×120px (race-day stress + gloves + iPad portrait).
 * Sound (success / error) is fired here in user-gesture co-location per
 * BR-CK-13 (Web Audio autoplay policy).
 *
 * Disabled while submitting (prevent double-tap → race condition).
 */

import { CheckCircle2, Loader2 } from 'lucide-react';
import { CHECKIN_CONFIG } from '../checkin.constant';
import { CHECKIN_COPY } from '../checkin.microcopy';

interface ConfirmPickupButtonProps {
  onClick: () => void;
  submitting: boolean;
  disabled?: boolean;
}

export function ConfirmPickupButton({ onClick, submitting, disabled }: ConfirmPickupButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting || disabled}
      className="flex items-center justify-center gap-3 rounded-2xl bg-[#FF0E65] text-2xl font-bold text-white shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-300"
      style={{
        minWidth: `${CHECKIN_CONFIG.CONFIRM_BUTTON_MIN_WIDTH_PX}px`,
        minHeight: `${CHECKIN_CONFIG.CONFIRM_BUTTON_MIN_HEIGHT_PX}px`,
        touchAction: 'manipulation',
      }}
      data-testid="confirm-pickup-button"
    >
      {submitting ? (
        <>
          <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          {CHECKIN_COPY.result.submitting}
        </>
      ) : (
        <>
          <CheckCircle2 className="h-7 w-7" aria-hidden />
          {CHECKIN_COPY.result.confirmButton}
        </>
      )}
    </button>
  );
}
