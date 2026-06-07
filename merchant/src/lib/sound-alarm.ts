/**
 * F-008 v2 — 880Hz Web Audio alarm helper (extract from F-005 page.tsx).
 *
 * Single source of truth for CRITICAL timing-alert alarm. Used by
 * SoundToggleButton + SSE hook callback bridge.
 *
 * Browser autoplay policy: AudioContext requires user gesture before first
 * play(). Catch all errors silently — caller cannot do anything if browser
 * blocks. F-005 pattern preserved verbatim.
 */

interface WebkitAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * Play a 880Hz sine tone fading from 0.3 → 0.01 over 500ms. Single-shot;
 * each invocation creates a fresh AudioContext → close after 1s to release
 * browser audio device handle.
 */
export function play880Hz(): void {
  try {
    const Ctor =
      window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => {
      void ctx.close();
    }, 1000);
  } catch {
    // browser blocked autoplay — user must interact first. F-005 silent fail.
  }
}

/**
 * localStorage key for sound preference (per-user-per-browser persist).
 * Value `'1'` = ON, `'0'` = OFF, missing = default ON.
 */
export const SOUND_ENABLED_KEY = 'cc-sound-enabled';

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(SOUND_ENABLED_KEY);
  if (raw === null) return true; // default ON for race-day MC safety
  return raw === '1';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_ENABLED_KEY, enabled ? '1' : '0');
}
