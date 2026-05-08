'use client';

/**
 * F-015 — Check-In kiosk-mode context provider.
 *
 * Single source of truth for 3-surface state machine:
 *   admin → lookup → result → lookup → ... (until exit)
 *
 * Pattern mirrors F-013 KioskModeProvider — feature-local because the state
 * machine + bib/cmnd/qr inputs differ from result-kiosk's BIB-only flow.
 *
 * Wires shared kiosk lib hooks (`useFullscreen`, `useKioskSound`,
 * `useKioskIdle`) so child components consume one provider instead of
 * orchestrating the trio independently.
 *
 * BR-CK-20 boundary: zero imports from `@/lib/chip-verification-api`.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useFullscreen, useKioskSound } from '@/lib/kiosk';
import { CHECKIN_CONFIG } from '../checkin.constant';
import type {
  AthleteCheckInPayload,
  CheckInSurface,
  ConfirmKind,
  LookupMode,
  ResultKind,
} from '../checkin.types';

interface CheckInContextValue {
  // State
  surface: CheckInSurface;
  bibInput: string;
  cmndInput: string;
  /** Surface-2 currently expanded mode (cmnd inline expand). */
  cmndExpanded: boolean;
  result: ResultKind | null;
  selectedAthlete: AthleteCheckInPayload | null;
  confirm: ConfirmKind;
  /** Selected station id (1..10), persisted in localStorage. */
  stationId: string;
  // Sound
  soundEnabled: boolean;
  toggleSound: () => void;
  ensureAudioContext: () => void;
  beepSuccess: () => void;
  beepError: () => void;
  // BIB editing
  appendBibDigit: (d: string) => void;
  bibBackspace: () => void;
  clearBib: () => void;
  setBibInput: (s: string) => void;
  // CMND editing
  appendCmndDigit: (d: string) => void;
  cmndBackspace: () => void;
  clearCmnd: () => void;
  toggleCmndExpand: () => void;
  // Surface transitions
  enterKiosk: () => Promise<void>;
  exitKiosk: () => Promise<void>;
  goToLookup: () => void;
  setResult: (r: ResultKind | null) => void;
  selectAthlete: (a: AthleteCheckInPayload | null) => void;
  setConfirm: (c: ConfirmKind) => void;
  setStationId: (s: string) => void;
}

const Ctx = createContext<CheckInContextValue | null>(null);

export function useCheckInContext(): CheckInContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCheckInContext must be inside <CheckInModeProvider>');
  return v;
}

interface CheckInModeProviderProps {
  raceId: string;
  children: ReactNode;
}

function readStationLs(): string {
  if (typeof window === 'undefined') return '1';
  try {
    const v = window.localStorage.getItem(CHECKIN_CONFIG.STATION_LS_KEY);
    return v && /^[0-9]+$/.test(v) ? v : '1';
  } catch {
    return '1';
  }
}

export function CheckInModeProvider({ children }: CheckInModeProviderProps) {
  const [surface, setSurface] = useState<CheckInSurface>('admin');
  const [bibInput, setBibState] = useState<string>('');
  const [cmndInput, setCmndState] = useState<string>('');
  const [cmndExpanded, setCmndExpanded] = useState(false);
  const [result, setResultState] = useState<ResultKind | null>(null);
  const [selectedAthlete, setSelected] = useState<AthleteCheckInPayload | null>(null);
  const [confirm, setConfirmState] = useState<ConfirmKind>({ kind: 'idle' });
  const [stationId, setStationState] = useState<string>(() => readStationLs());

  const fullscreen = useFullscreen();
  const sound = useKioskSound();

  // Persist station selection.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CHECKIN_CONFIG.STATION_LS_KEY, stationId);
    } catch {
      /* ignore */
    }
  }, [stationId]);

  const setBibInput = useCallback((next: string) => {
    // BR-CK-01: digits only, max 6 chars.
    const cleaned = next.replace(/\D+/g, '').slice(0, CHECKIN_CONFIG.BIB_MAX_LENGTH);
    setBibState(cleaned);
  }, []);

  const appendBibDigit = useCallback((digit: string) => {
    setBibState((curr) => {
      if (!/^[0-9]$/.test(digit)) return curr;
      if (curr.length >= CHECKIN_CONFIG.BIB_MAX_LENGTH) return curr;
      return curr + digit;
    });
  }, []);

  const bibBackspace = useCallback(() => {
    setBibState((c) => c.slice(0, -1));
  }, []);

  const clearBib = useCallback(() => {
    setBibState('');
  }, []);

  // BR-CK-10 — CMND PII boundary: only last-N digits ever held in memory.
  // We never log this value. It is wiped on exit + on confirm-success.
  const setCmndInput = useCallback((next: string) => {
    const cleaned = next.replace(/\D+/g, '').slice(0, CHECKIN_CONFIG.CMND_LAST_DIGITS);
    setCmndState(cleaned);
  }, []);

  const appendCmndDigit = useCallback((digit: string) => {
    setCmndState((curr) => {
      if (!/^[0-9]$/.test(digit)) return curr;
      if (curr.length >= CHECKIN_CONFIG.CMND_LAST_DIGITS) return curr;
      return curr + digit;
    });
  }, []);

  const cmndBackspace = useCallback(() => setCmndState((c) => c.slice(0, -1)), []);
  const clearCmnd = useCallback(() => setCmndState(''), []);
  const toggleCmndExpand = useCallback(() => setCmndExpanded((v) => !v), []);

  const enterKiosk = useCallback(async () => {
    sound.ensureAudioContext();
    await fullscreen.enterFullscreen();
    setBibState('');
    setCmndState('');
    setCmndExpanded(false);
    setResultState(null);
    setSelected(null);
    setConfirmState({ kind: 'idle' });
    setSurface('lookup');
  }, [fullscreen, sound]);

  const exitKiosk = useCallback(async () => {
    await fullscreen.exitFullscreen();
    setSurface('admin');
    setBibState('');
    setCmndState('');
    setCmndExpanded(false);
    setResultState(null);
    setSelected(null);
    setConfirmState({ kind: 'idle' });
  }, [fullscreen]);

  const goToLookup = useCallback(() => {
    setBibState('');
    setCmndState('');
    setCmndExpanded(false);
    setResultState(null);
    setSelected(null);
    setConfirmState({ kind: 'idle' });
    setSurface('lookup');
  }, []);

  const selectAthlete = useCallback((a: AthleteCheckInPayload | null) => {
    setSelected(a);
    if (a) {
      setSurface('result');
      setConfirmState({ kind: 'idle' });
    }
  }, []);

  const setStationId = useCallback((s: string) => {
    if (!/^[0-9]+$/.test(s)) return;
    const n = parseInt(s, 10);
    if (n < CHECKIN_CONFIG.STATION_MIN || n > CHECKIN_CONFIG.STATION_MAX) return;
    setStationState(String(n));
  }, []);

  const value = useMemo<CheckInContextValue>(
    () => ({
      surface,
      bibInput,
      cmndInput,
      cmndExpanded,
      result,
      selectedAthlete,
      confirm,
      stationId,
      soundEnabled: sound.enabled,
      toggleSound: sound.toggle,
      ensureAudioContext: sound.ensureAudioContext,
      beepSuccess: sound.beepSuccess,
      beepError: sound.beepError,
      appendBibDigit,
      bibBackspace,
      clearBib,
      setBibInput,
      appendCmndDigit,
      cmndBackspace,
      clearCmnd,
      toggleCmndExpand,
      enterKiosk,
      exitKiosk,
      goToLookup,
      setResult: setResultState,
      selectAthlete,
      setConfirm: setConfirmState,
      setStationId,
    }),
    [
      surface,
      bibInput,
      cmndInput,
      cmndExpanded,
      result,
      selectedAthlete,
      confirm,
      stationId,
      sound.enabled,
      sound.toggle,
      sound.ensureAudioContext,
      sound.beepSuccess,
      sound.beepError,
      appendBibDigit,
      bibBackspace,
      clearBib,
      setBibInput,
      appendCmndDigit,
      cmndBackspace,
      clearCmnd,
      toggleCmndExpand,
      enterKiosk,
      exitKiosk,
      goToLookup,
      selectAthlete,
      setStationId,
    ],
  );

  // Provide consumer access to setCmndInput via the imperatively-typed
  // `setBibInput` analog — but we expose it through an additional helper
  // because direct `setCmndInput` was easier on the callsite.
  // (We expose appendCmndDigit + clearCmnd which is sufficient for the UI;
  // setCmndInput remains internal.)
  void setCmndInput;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
