'use client';

/**
 * F-013 BR-RK-01 / F-017 BR-AF-23 verbatim port — Manual BIB number pad
 * (FALLBACK input — primary input on F-017 is RFID chip scanner).
 *
 * @deprecated Renamed in F-017 from `BibNumberPad` → `BibNumberPadFallback`.
 *   Logic byte-for-byte preserved. Only the component name changed to
 *   communicate that the chip-scan flow is now primary; the manual pad is
 *   reserved for the (rare) cases where chip read fails or scanner is offline.
 *
 * Why custom (not native HTML `<input type="number">`)?
 *   - Native triggers OS keyboard inconsistently across iPad / Android tablets.
 *   - Custom pad guarantees ≥80×80px tap targets (touchscreen UX requirement).
 *   - Bluetooth keyboard fallback retained via standard `keydown` capture on
 *     a focusable wrapper (not a real `<input>` — no OS keyboard pop).
 *
 * Public API:
 *   - `value` (string) — current BIB display (parent owns state via context)
 *   - `onAppend(digit)` / `onBackspace()` / `onClear()` / `onSubmit()`
 *   - `disabled` — submit pending
 */

import { KeyboardEvent, useCallback } from 'react';
import { Delete, Eraser } from 'lucide-react';
import { KIOSK_CONFIG } from '../kiosk.constant';
import { KIOSK_COPY } from '../kiosk.microcopy';

export interface BibNumberPadFallbackProps {
  value: string;
  onAppend: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

/** @deprecated Use {@link BibNumberPadFallbackProps}. Kept for type compat. */
export type BibNumberPadProps = BibNumberPadFallbackProps;

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function BibNumberPadFallback({
  value,
  onAppend,
  onBackspace,
  onClear,
  onSubmit,
  disabled,
}: BibNumberPadFallbackProps) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        onAppend(e.key);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        onBackspace();
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        onClear();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (value.length > 0) onSubmit();
        return;
      }
      // BR-RK-01: non-digit silently swallowed (no error toast)
    },
    [disabled, onAppend, onBackspace, onClear, onSubmit, value.length],
  );

  const tileSize = `${KIOSK_CONFIG.DIGIT_BUTTON_PX}px`;
  const ctrlSize = `${KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`;

  return (
    <div
      role="group"
      aria-label="BIB number pad"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FF0E65]"
      data-testid="kiosk-bib-numberpad"
    >
      <div className="grid grid-cols-3 gap-3">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled || value.length >= KIOSK_CONFIG.BIB_MAX_LENGTH}
            onClick={() => onAppend(d)}
            aria-label={KIOSK_COPY.input.digitLabel(parseInt(d, 10))}
            className="flex items-center justify-center rounded-xl bg-stone-50 font-mono text-3xl font-bold text-stone-900 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              minWidth: tileSize,
              minHeight: tileSize,
              touchAction: 'manipulation',
            }}
            data-digit={d}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || value.length === 0}
          aria-label={KIOSK_COPY.input.clearLabel}
          className="flex items-center justify-center rounded-xl bg-stone-100 font-bold text-stone-700 transition-transform active:scale-95 disabled:opacity-40"
          style={{ minWidth: tileSize, minHeight: tileSize, touchAction: 'manipulation' }}
          data-action="clear"
        >
          <Eraser className="h-6 w-6" aria-hidden />
          <span className="sr-only">{KIOSK_COPY.input.clearLabel}</span>
        </button>
        <button
          key="0"
          type="button"
          disabled={disabled || value.length >= KIOSK_CONFIG.BIB_MAX_LENGTH}
          onClick={() => onAppend('0')}
          aria-label={KIOSK_COPY.input.digitLabel(0)}
          className="flex items-center justify-center rounded-xl bg-stone-50 font-mono text-3xl font-bold text-stone-900 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ minWidth: tileSize, minHeight: tileSize, touchAction: 'manipulation' }}
          data-digit="0"
        >
          0
        </button>
        <button
          type="button"
          onClick={onBackspace}
          disabled={disabled || value.length === 0}
          aria-label={KIOSK_COPY.input.backspaceLabel}
          className="flex items-center justify-center rounded-xl bg-stone-100 font-bold text-stone-700 transition-transform active:scale-95 disabled:opacity-40"
          style={{ minWidth: tileSize, minHeight: tileSize, touchAction: 'manipulation' }}
          data-action="backspace"
        >
          <Delete className="h-6 w-6" aria-hidden />
          <span className="sr-only">{KIOSK_COPY.input.backspaceLabel}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || value.length === 0}
        className="mt-4 w-full rounded-xl bg-[#FF0E65] font-bold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-300"
        style={{ minHeight: ctrlSize, fontSize: '1.5rem', touchAction: 'manipulation' }}
        data-action="submit"
      >
        {KIOSK_COPY.input.submit}
      </button>
    </div>
  );
}

/**
 * @deprecated Use {@link BibNumberPadFallback}. F-017 RENAME for chip-scan-first
 * UX. Logic identical (BR-AF-23 byte-for-byte preserved). Compat alias retained
 * during migration window so any stray imports still resolve.
 */
export const BibNumberPad = BibNumberPadFallback;
