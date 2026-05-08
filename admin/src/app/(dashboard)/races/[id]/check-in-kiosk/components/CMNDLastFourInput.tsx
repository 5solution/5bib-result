'use client';

/**
 * F-015 BR-CK-10 — CMND last-4-digit input (PII-aware).
 *
 * CRITICAL PII boundary:
 *  - Component holds only the last 4 digits in local state via parent context
 *    (CheckInModeProvider strips beyond 4 chars at every setter).
 *  - NEVER `console.log` / Logger / network-trace this value.
 *  - On confirm-success or kiosk-exit, parent context wipes the value.
 *  - Component does NOT render an HTML5 number input — uses tel-mode + custom
 *    cleanup so iOS keyboard suggestions / autocomplete cannot persist past 4.
 *
 * UX:
 *  - Helper text: "Nhập 4 số cuối CMND/CCCD của athlete"
 *  - 4-digit pad with single-line readout
 *  - Submit button enabled only when length === 4
 */

import { CHECKIN_CONFIG } from '../checkin.constant';
import { CHECKIN_COPY } from '../checkin.microcopy';

interface CMNDLastFourInputProps {
  value: string;
  onAppend: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function CMNDLastFourInput({
  value,
  onAppend,
  onBackspace,
  onClear,
  onSubmit,
  disabled,
}: CMNDLastFourInputProps) {
  const ready = value.length === CHECKIN_CONFIG.CMND_LAST_DIGITS;
  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      data-testid="cmnd-last-four-input"
    >
      <p className="mb-3 text-sm text-stone-600">{CHECKIN_COPY.input.cmndHelper}</p>
      <div
        className="mb-3 grid grid-cols-4 gap-2"
        aria-label="CMND last 4 digits readout"
      >
        {Array.from({ length: CHECKIN_CONFIG.CMND_LAST_DIGITS }).map((_, i) => (
          <div
            key={i}
            className="flex h-14 items-center justify-center rounded-md border border-stone-200 bg-stone-50 font-mono text-2xl font-bold text-stone-900"
            aria-hidden
          >
            {value[i] ? value[i] : <span className="text-stone-300">{CHECKIN_COPY.input.cmndPlaceholder.charAt(i) ?? '_'}</span>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled || value.length >= CHECKIN_CONFIG.CMND_LAST_DIGITS}
            onClick={() => onAppend(d)}
            className="rounded-md bg-stone-50 py-3 font-mono text-xl font-bold text-stone-900 active:scale-95 disabled:opacity-40"
            data-testid={`cmnd-digit-${d}`}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || value.length === 0}
          className="rounded-md bg-stone-100 py-3 text-sm font-bold text-stone-700 disabled:opacity-40"
          data-testid="cmnd-clear"
        >
          {CHECKIN_COPY.input.clearLabel}
        </button>
        <button
          key="0"
          type="button"
          disabled={disabled || value.length >= CHECKIN_CONFIG.CMND_LAST_DIGITS}
          onClick={() => onAppend('0')}
          className="rounded-md bg-stone-50 py-3 font-mono text-xl font-bold text-stone-900 active:scale-95 disabled:opacity-40"
          data-testid="cmnd-digit-0"
        >
          0
        </button>
        <button
          type="button"
          onClick={onBackspace}
          disabled={disabled || value.length === 0}
          className="rounded-md bg-stone-100 py-3 text-sm font-bold text-stone-700 disabled:opacity-40"
          data-testid="cmnd-backspace"
        >
          {CHECKIN_COPY.input.backspaceLabel}
        </button>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !ready}
        className="mt-3 w-full rounded-md bg-[#FF0E65] py-3 text-base font-bold text-white disabled:bg-stone-300"
        data-testid="cmnd-submit"
      >
        {CHECKIN_COPY.input.cmndSubmit}
      </button>
    </div>
  );
}
