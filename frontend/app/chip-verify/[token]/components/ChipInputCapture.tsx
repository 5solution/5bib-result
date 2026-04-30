'use client';

import { useEffect, useRef } from 'react';

interface Props {
  onScan: (chipId: string) => void;
  /** Disable global keydown listener while modal/input is focused. */
  disabled?: boolean;
}

/**
 * Global keydown listener for RFID readers (USB HID — emit chip ID + Enter).
 *
 * Edge cases handled:
 *   - Inactive modal/input → ignore (parent passes `disabled={true}`)
 *   - User typing in <input> field → ignore unless `data-rfid-capture`
 *   - Vietnamese IME composition → ignore (compositionstart/end window)
 *   - Slow human typing → buffer reset on >200ms gap
 *   - Same chip within 1.5s → debounced (kiosk often double-triggers RFID)
 *   - Non-printable keys → ignored (only `key.length === 1` accumulated)
 */
export function ChipInputCapture({ onScan, disabled }: Props) {
  const bufferRef = useRef('');
  const lastKeyAtRef = useRef(0);
  const lastScanRef = useRef<{ chipId: string; at: number }>({
    chipId: '',
    at: 0,
  });
  const composingRef = useRef(false);

  useEffect(() => {
    if (disabled) return;

    const onCompStart = () => {
      composingRef.current = true;
      bufferRef.current = '';
    };
    const onCompEnd = () => {
      composingRef.current = false;
      bufferRef.current = '';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (composingRef.current) return;

      // Ignore typing in actual input fields unless explicitly opted-in via
      // data-rfid-capture attribute on the input element.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isFormField =
          tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        const isContentEditable =
          (target as HTMLElement).isContentEditable === true;
        const optedIn = target.dataset?.rfidCapture === 'true';
        if ((isFormField || isContentEditable) && !optedIn) return;
      }

      const now = Date.now();
      // Reset buffer on slow input — RFID readers send characters within 5-50ms,
      // human typing is >100ms between keys.
      if (now - lastKeyAtRef.current > 200) {
        bufferRef.current = '';
      }
      lastKeyAtRef.current = now;

      if (e.key === 'Enter') {
        const raw = bufferRef.current.trim();
        bufferRef.current = '';
        if (!raw) return;
        const chipId = raw.toUpperCase();
        // Debounce same chip within 1.5s
        if (
          chipId === lastScanRef.current.chipId &&
          now - lastScanRef.current.at < 1500
        ) {
          return;
        }
        lastScanRef.current = { chipId, at: now };
        onScan(chipId);
        return;
      }

      // Only accumulate single printable characters (RFID readers emit ASCII)
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('compositionstart', onCompStart);
    window.addEventListener('compositionend', onCompEnd);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('compositionstart', onCompStart);
      window.removeEventListener('compositionend', onCompEnd);
    };
  }, [onScan, disabled]);

  return null; // headless component
}
