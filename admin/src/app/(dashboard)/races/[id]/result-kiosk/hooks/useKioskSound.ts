'use client';

/**
 * F-013 BR-RK-10 — Web Audio beep with localStorage persistence.
 *
 * AudioContext can ONLY be lazily constructed inside a user gesture (browsers
 * block construction otherwise — Chrome / Safari autoplay policy). We expose
 * `ensureAudioContext()` to be called explicitly from the "Bật chế độ Kiosk"
 * button click handler so the very first context is born under a gesture.
 *
 * Beep tones (success / error) are generated via `OscillatorNode` — no audio
 * asset upload, NO new dependency. SDK consumers don't need to hand back any
 * AudioContext lifecycle; this hook owns it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { KIOSK_CONFIG } from '../kiosk.constant';

const { SOUND_LS_KEY } = KIOSK_CONFIG;

interface UseKioskSoundReturn {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (next: boolean) => void;
  /** Lazy-construct AudioContext under a user gesture. Safe to call repeatedly. */
  ensureAudioContext: () => void;
  beepSuccess: () => void;
  beepError: () => void;
}

function readLs(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(SOUND_LS_KEY);
    if (v === null) return true; // default ON
    return v !== 'off';
  } catch {
    return true;
  }
}

function writeLs(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_LS_KEY, enabled ? 'on' : 'off');
  } catch {
    /* localStorage blocked (private mode) — ignore */
  }
}

export function useKioskSound(): UseKioskSoundReturn {
  const [enabled, setEnabledState] = useState<boolean>(() => readLs());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctxRef = useRef<any>(null);

  // Sync localStorage on change.
  useEffect(() => {
    writeLs(enabled);
  }, [enabled]);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (ctxRef.current) {
      // Some browsers (Safari) suspend on focus loss — resume opportunistically.
      try {
        if (ctxRef.current.state === 'suspended') {
          ctxRef.current.resume();
        }
      } catch {
        /* ignore */
      }
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    try {
      ctxRef.current = new Ctor();
    } catch {
      ctxRef.current = null;
    }
  }, []);

  const playTone = useCallback(
    (hz: number, durationMs: number) => {
      if (!enabled) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = hz;
        osc.type = 'sine';
        // Soft envelope to avoid click pops at start/end.
        gain.gain.value = 0.0001;
        gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + durationMs / 1000,
        );
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
      } catch {
        /* ignore — sound is never critical path */
      }
    },
    [enabled],
  );

  const beepSuccess = useCallback(() => {
    playTone(KIOSK_CONFIG.BEEP_SUCCESS_HZ, KIOSK_CONFIG.BEEP_SUCCESS_MS);
  }, [playTone]);

  const beepError = useCallback(() => {
    if (!enabled || !ctxRef.current) return;
    for (let i = 0; i < KIOSK_CONFIG.BEEP_ERROR_REPEAT; i++) {
      const delayMs = i * (KIOSK_CONFIG.BEEP_ERROR_MS + KIOSK_CONFIG.BEEP_ERROR_GAP_MS);
      setTimeout(() => {
        playTone(KIOSK_CONFIG.BEEP_ERROR_HZ, KIOSK_CONFIG.BEEP_ERROR_MS);
      }, delayMs);
    }
  }, [enabled, playTone]);

  const toggle = useCallback(() => {
    setEnabledState((v) => !v);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
  }, []);

  return {
    enabled,
    toggle,
    setEnabled,
    ensureAudioContext,
    beepSuccess,
    beepError,
  };
}
