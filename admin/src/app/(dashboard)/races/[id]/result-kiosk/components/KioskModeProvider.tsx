'use client';

/**
 * F-013 + F-017 — Kiosk-mode context provider.
 *
 * F-017 EXTENDED state machine (4 active surfaces):
 *   admin → chip-input → result → chip-input → ... (until exit)
 *           ↘ bib-input-fallback (manual pad escape hatch)
 *
 * Provides:
 *   - mode: 'admin' | 'chip-input' | 'bib-input-fallback' | 'result' | 'config-dialog'
 *   - bib: current input string (manual pad)
 *   - lastChipId: last scanned chip (debug + UI)
 *   - result: current envelope payload (or null)
 *   - resultKind: 'found' | 'not-found' | 'chip-disabled' | 'race-not-mapped' | 'athlete-not-found' | 'data-error' | 'network-error' | null
 *   - sound on/off (delegated to useKioskSound)
 *   - enterKiosk() / exitKiosk() / submitBib() / submitChip() / switchToFallback() /
 *     resetToInput() / appendDigit() / clearBib() / backspace()
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
import { useChipScan, type ChipScanOutcome } from '../hooks/useChipScan';
import { KIOSK_CONFIG } from '../kiosk.constant';
import type { AthleteDetailEnvelope, KioskMode } from '../kiosk.types';

/**
 * F-017 — extended outcome union covers F-013 lookup outcomes + new
 * chip-specific outcomes. Discriminated union for KioskResultScreen render.
 */
export type ResultKind =
  | LookupOutcome['kind']
  | ChipScanOutcome['kind'];

interface KioskContextValue {
  // State
  mode: KioskMode;
  bib: string;
  lastChipId: string | null;
  result: AthleteDetailEnvelope | null;
  resultKind: ResultKind | null;
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
  /** F-017 — chip scan submission. Called by ChipScanInput.onScan. */
  submitChip: (chipId: string) => Promise<void>;
  /** F-017 — switch from chip-input to manual BIB number pad (BR-AF-23 fallback). */
  switchToFallback: () => void;
  /** F-017 — switch back from fallback to chip-input. */
  switchToChipInput: () => void;
  resetToInput: () => void;
  /** F-017 — open / close display config dialog from admin tab body. */
  openConfigDialog: () => void;
  closeConfigDialog: () => void;
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
  const [lastChipId, setLastChipId] = useState<string | null>(null);
  const [result, setResult] = useState<AthleteDetailEnvelope | null>(null);
  const [resultKind, setResultKind] = useState<ResultKind | null>(null);

  const fullscreen = useKioskFullscreen();
  const sound = useKioskSound();
  const lookup = useResultLookup({ raceId });
  const chipScan = useChipScan({ raceId });

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
    setLastChipId(null);
    setResult(null);
    setResultKind(null);
    // F-017 — chip-input is the primary entry mode (was 'bib-input' in F-013).
    setMode('chip-input');
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
    setLastChipId(null);
    setResult(null);
    setResultKind(null);
    // F-017 — return to chip-input by default (primary mode).
    setMode('chip-input');
  }, []);

  const switchToFallback = useCallback(() => {
    setBibState('');
    setMode('bib-input-fallback');
  }, []);

  const switchToChipInput = useCallback(() => {
    setBibState('');
    setMode('chip-input');
  }, []);

  const openConfigDialog = useCallback(() => {
    setMode('config-dialog');
  }, []);

  const closeConfigDialog = useCallback(() => {
    setMode('admin');
  }, []);

  const submitChip = useCallback(
    async (chipId: string) => {
      const trimmed = chipId.trim();
      if (!trimmed) return;
      setLastChipId(trimmed);
      const outcome = await chipScan.mutateAsync(trimmed);
      setResultKind(outcome.kind);
      if (outcome.kind === 'found') {
        setBibState(outcome.bib);
        setResult(outcome.envelope);
        sound.beepSuccess();
        setMode('result');
      } else if (outcome.kind === 'network-error') {
        sound.beepError();
        // stay on chip-input
      } else {
        // chip-not-found / chip-disabled / race-not-mapped / athlete-not-found / data-error
        if ('bib' in outcome && typeof outcome.bib === 'string') {
          setBibState(outcome.bib);
        }
        setResult(null);
        sound.beepError();
        setMode('result');
      }
    },
    [chipScan, sound],
  );

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
      lastChipId,
      result,
      resultKind,
      loading: lookup.isPending || chipScan.isPending,
      soundEnabled: sound.enabled,
      toggleSound: sound.toggle,
      appendDigit,
      backspace,
      clearBib,
      setBib,
      enterKiosk,
      exitKiosk,
      submitBib,
      submitChip,
      switchToFallback,
      switchToChipInput,
      resetToInput,
      openConfigDialog,
      closeConfigDialog,
    }),
    [
      mode,
      bib,
      lastChipId,
      result,
      resultKind,
      lookup.isPending,
      chipScan.isPending,
      sound.enabled,
      sound.toggle,
      appendDigit,
      backspace,
      clearBib,
      setBib,
      enterKiosk,
      exitKiosk,
      submitBib,
      submitChip,
      switchToFallback,
      switchToChipInput,
      resetToInput,
      openConfigDialog,
      closeConfigDialog,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
