'use client';

/**
 * F-013 — Kiosk-mode context provider.
 *
 * Single source of truth for the 3-surface state machine:
 *   admin → bib-input → result → bib-input → ... (until exit)
 *
 * Provides:
 *   - mode: 'admin' | 'bib-input' | 'result'
 *   - bib: current input string
 *   - result: current envelope payload (or null)
 *   - resultStatus: 'success' | 'not-found' | 'data-error' | null
 *   - sound on/off (delegated to useKioskSound)
 *   - enterKiosk() / exitKiosk() / submitBib() / reset() / appendDigit() / clearBib() / backspace()
 *
 * Hooks (`useKioskFullscreen`, `useKioskSound`, `useResultLookup`) are wired
 * here so child components consume one provider instead of orchestrating four.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useKioskFullscreen } from '../hooks/useKioskFullscreen';
import { useKioskSound } from '../hooks/useKioskSound';
import { useResultLookup, type LookupOutcome } from '../hooks/useResultLookup';
import { KIOSK_CONFIG } from '../kiosk.constant';
import type { AthleteDetailEnvelope, KioskMode } from '../kiosk.types';

interface KioskContextValue {
  // State
  mode: KioskMode;
  bib: string;
  result: AthleteDetailEnvelope | null;
  resultKind: LookupOutcome['kind'] | null;
  loading: boolean;
  // Sound
  soundEnabled: boolean;
  toggleSound: () => void;
  // BIB editing
  appendDigit: (digit: string) => void;
  backspace: () => void;
  clearBib: () => void;
  setBib: (next: string) => void;
  // Surface transitions
  enterKiosk: () => Promise<void>;
  exitKiosk: () => Promise<void>;
  submitBib: () => Promise<void>;
  resetToInput: () => void;
}

const Ctx = createContext<KioskContextValue | null>(null);

export function useKioskContext(): KioskContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useKioskContext must be inside <KioskModeProvider>');
  return v;
}

interface KioskModeProviderProps {
  raceId: string;
  children: ReactNode;
}

export function KioskModeProvider({ raceId, children }: KioskModeProviderProps) {
  const [mode, setMode] = useState<KioskMode>('admin');
  const [bib, setBibState] = useState<string>('');
  const [result, setResult] = useState<AthleteDetailEnvelope | null>(null);
  const [resultKind, setResultKind] = useState<LookupOutcome['kind'] | null>(null);

  const fullscreen = useKioskFullscreen();
  const sound = useKioskSound();
  const lookup = useResultLookup({ raceId });

  const setBib = useCallback((next: string) => {
    // BR-RK-01: digits only, max 6 chars
    const cleaned = next.replace(/\D+/g, '').slice(0, KIOSK_CONFIG.BIB_MAX_LENGTH);
    setBibState(cleaned);
  }, []);

  const appendDigit = useCallback((digit: string) => {
    setBibState((curr) => {
      if (!/^[0-9]$/.test(digit)) return curr;
      if (curr.length >= KIOSK_CONFIG.BIB_MAX_LENGTH) return curr;
      return curr + digit;
    });
  }, []);

  const backspace = useCallback(() => {
    setBibState((curr) => curr.slice(0, -1));
  }, []);

  const clearBib = useCallback(() => {
    setBibState('');
  }, []);

  const enterKiosk = useCallback(async () => {
    // User-gesture-bound: AudioContext + Fullscreen API both need a click.
    sound.ensureAudioContext();
    await fullscreen.enterFullscreen();
    setBibState('');
    setResult(null);
    setResultKind(null);
    setMode('bib-input');
  }, [fullscreen, sound]);

  const exitKiosk = useCallback(async () => {
    await fullscreen.exitFullscreen();
    setMode('admin');
    setBibState('');
    setResult(null);
    setResultKind(null);
  }, [fullscreen]);

  const resetToInput = useCallback(() => {
    setBibState('');
    setResult(null);
    setResultKind(null);
    setMode('bib-input');
  }, []);

  const submitBib = useCallback(async () => {
    if (!bib) return;
    const outcome = await lookup.mutateAsync(bib);
    setResultKind(outcome.kind);
    if (outcome.kind === 'found') {
      setResult(outcome.envelope);
      sound.beepSuccess();
      setMode('result');
    } else if (outcome.kind === 'not-found') {
      setResult(null);
      sound.beepError();
      setMode('result');
    } else if (outcome.kind === 'data-error') {
      setResult(null);
      sound.beepError();
      setMode('result');
    } else {
      // network-error stays on input screen with toast (consumed by surface)
      sound.beepError();
    }
  }, [bib, lookup, sound]);

  const value = useMemo<KioskContextValue>(
    () => ({
      mode,
      bib,
      result,
      resultKind,
      loading: lookup.isPending,
      soundEnabled: sound.enabled,
      toggleSound: sound.toggle,
      appendDigit,
      backspace,
      clearBib,
      setBib,
      enterKiosk,
      exitKiosk,
      submitBib,
      resetToInput,
    }),
    [
      mode,
      bib,
      result,
      resultKind,
      lookup.isPending,
      sound.enabled,
      sound.toggle,
      appendDigit,
      backspace,
      clearBib,
      setBib,
      enterKiosk,
      exitKiosk,
      submitBib,
      resetToInput,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
