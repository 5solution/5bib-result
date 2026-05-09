// @ts-nocheck — F-013: jest + @testing-library/react not in admin node_modules
// (Manager STOP trigger "NO npm install"). Spec is correct Jest+RTL form,
// will type-check + run once admin gains the test stack (Phase 2).
/**
 * F-013 BR-RK-10 — Sound hook tests (Jest + @testing-library/react).
 *
 * Coverage:
 *  - happy: success beep emits 800Hz tone via Web Audio
 *  - edge: localStorage 'off' persists across reload (default ON when empty)
 *  - edge: error beep emits 2× 300Hz with gap
 *  - edge: toggle round-trip persists to localStorage
 *  - edge: AudioContext API unavailable → graceful no-op
 */

import { act, renderHook } from '@testing-library/react';
import { useKioskSound } from '../hooks/useKioskSound';
import { KIOSK_CONFIG } from '../kiosk.constant';

interface MockOscillator {
  frequency: { value: number };
  type: string;
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
}
interface MockGain {
  gain: {
    value: number;
    exponentialRampToValueAtTime: jest.Mock;
  };
  connect: jest.Mock;
}

function createMockAudioContext() {
  const oscillators: MockOscillator[] = [];
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createOscillator: jest.fn((): MockOscillator => {
      const osc = {
        frequency: { value: 0 },
        type: 'sine',
        connect: jest.fn(() => gain),
        start: jest.fn(),
        stop: jest.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: jest.fn(
      (): MockGain => ({
        gain: {
          value: 0,
          exponentialRampToValueAtTime: jest.fn(),
        },
        connect: jest.fn(() => ctx.destination),
      }),
    ),
    resume: jest.fn(),
  };
  // eslint-disable-next-line prefer-const
  let gain: MockGain = ctx.createGain();
  return { ctx, oscillators };
}

describe('useKioskSound (BR-RK-10)', () => {
  let mockAudio: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    mockAudio = createMockAudioContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).AudioContext = jest.fn(() => mockAudio.ctx);
    window.localStorage.clear();
  });

  it('defaults enabled=true when localStorage empty', () => {
    const { result } = renderHook(() => useKioskSound());
    expect(result.current.enabled).toBe(true);
  });

  it('reads localStorage off persistence', () => {
    window.localStorage.setItem(KIOSK_CONFIG.SOUND_LS_KEY, 'off');
    const { result } = renderHook(() => useKioskSound());
    expect(result.current.enabled).toBe(false);
  });

  it('toggle round-trip persists to localStorage', () => {
    const { result } = renderHook(() => useKioskSound());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(window.localStorage.getItem(KIOSK_CONFIG.SOUND_LS_KEY)).toBe('off');
    act(() => result.current.toggle());
    expect(window.localStorage.getItem(KIOSK_CONFIG.SOUND_LS_KEY)).toBe('on');
  });

  it('beepSuccess emits 800Hz tone via Web Audio', () => {
    const { result } = renderHook(() => useKioskSound());
    act(() => result.current.ensureAudioContext());
    act(() => result.current.beepSuccess());
    expect(mockAudio.ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(mockAudio.oscillators[0].frequency.value).toBe(KIOSK_CONFIG.BEEP_SUCCESS_HZ);
    expect(mockAudio.oscillators[0].start).toHaveBeenCalled();
  });

  it('beepError emits 300Hz × 2 with gap', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useKioskSound());
    act(() => result.current.ensureAudioContext());
    act(() => result.current.beepError());
    act(() => {
      jest.advanceTimersByTime(
        (KIOSK_CONFIG.BEEP_ERROR_MS + KIOSK_CONFIG.BEEP_ERROR_GAP_MS) *
          KIOSK_CONFIG.BEEP_ERROR_REPEAT,
      );
    });
    expect(mockAudio.ctx.createOscillator).toHaveBeenCalledTimes(KIOSK_CONFIG.BEEP_ERROR_REPEAT);
    expect(mockAudio.oscillators[0].frequency.value).toBe(KIOSK_CONFIG.BEEP_ERROR_HZ);
    jest.useRealTimers();
  });

  it('disabled state suppresses beep', () => {
    window.localStorage.setItem(KIOSK_CONFIG.SOUND_LS_KEY, 'off');
    const { result } = renderHook(() => useKioskSound());
    act(() => result.current.ensureAudioContext());
    act(() => result.current.beepSuccess());
    expect(mockAudio.ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('graceful no-op when AudioContext unavailable', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).AudioContext;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).webkitAudioContext;
    const { result } = renderHook(() => useKioskSound());
    expect(() => {
      act(() => result.current.ensureAudioContext());
      act(() => result.current.beepSuccess());
    }).not.toThrow();
  });
});
