'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Web Audio API sound feedback for kiosk.
 *
 * Browser autoplay policy: AudioContext must be created/resumed inside
 * a user-gesture handler. The kiosk page renders a "Bắt đầu" modal on
 * first mount; clicking it calls `unlock()` to bootstrap the AudioContext.
 * Without unlock, beeps are silent (no error thrown).
 *
 * Cleanup: AudioContext is closed on unmount (8h kiosk session memory).
 */
export type SoundType =
  | 'found'
  | 'duplicate'
  | 'notFound'
  | 'bibUnassigned'
  | 'alreadyPickedUp';

export function useSoundFeedback() {
  const ctxRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);

  // Cleanup on unmount — close AudioContext to release audio resources.
  useEffect(() => {
    return () => {
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => undefined);
        ctxRef.current = null;
      }
    };
  }, []);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    let ctx = ctxRef.current;
    if (!ctx) {
      // BUG #FE-3 fix — no `as unknown as`. Safari < 14 exposes only the
      // prefixed `webkitAudioContext`; we declare both fields as optional on
      // a local interface and intersect with Window.
      interface AudioContextProvider {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      }
      const w = window as Window & AudioContextProvider;
      const Ctor = w.AudioContext || w.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      ctxRef.current = ctx;
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    return ctx;
  }, []);

  /** Call inside a user-gesture handler (button click) to authorize audio. */
  const unlock = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    // Play a tiny silent buffer so the browser fully unlocks.
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    unlockedRef.current = true;
  }, [ensureCtx]);

  const beep = useCallback(
    (freq: number, durMs: number, when = 0): void => {
      const ctx = ensureCtx();
      if (!ctx) return;
      const start = ctx.currentTime + when / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + durMs / 1000);
      osc.start(start);
      osc.stop(start + durMs / 1000 + 0.05);
    },
    [ensureCtx],
  );

  const play = useCallback(
    (kind: SoundType): void => {
      switch (kind) {
        case 'found':
          // Single high-pitched chime — success
          beep(880, 150);
          break;
        case 'duplicate':
        case 'alreadyPickedUp':
          // Double medium beep — warning, slight delay
          beep(660, 100, 0);
          beep(660, 100, 130);
          break;
        case 'notFound':
          // Triple low buzz — error
          beep(220, 80, 0);
          beep(220, 80, 100);
          beep(220, 80, 200);
          break;
        case 'bibUnassigned':
          // Long medium buzz — soft warning
          beep(440, 400);
          break;
      }
    },
    [beep],
  );

  return { play, unlock, isUnlocked: () => unlockedRef.current };
}
