'use client';

/**
 * F-018 BR-MI-04 — mandatory confirmation modal for Sev 4 & 5.
 * Avoids accidental ambulance dispatch + Race Director alert on misclick.
 * NOT bypassable via click outside (advisory §1.D).
 */
import { Severity } from '../medical.constant';
import { COPY, SEVERITY_VN } from '../medical.microcopy';

interface SeverityConfirmationModalProps {
  open: boolean;
  severity: Severity | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SeverityConfirmationModal({
  open,
  severity,
  onConfirm,
  onCancel,
}: SeverityConfirmationModalProps) {
  if (!open || severity === null || severity < 4) return null;

  const title =
    severity === 5 ? COPY.sevConfirm.title5 : COPY.sevConfirm.title4;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sev-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      // BR-MI-04 — explicitly NOT closing on click-outside.
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2
          id="sev-confirm-title"
          className="text-2xl font-bold text-red-900"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-stone-600">{SEVERITY_VN[severity]}</p>
        <p className="mt-4 text-base text-stone-800">
          {COPY.sevConfirm.body}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            {COPY.sevConfirm.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            {COPY.sevConfirm.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
