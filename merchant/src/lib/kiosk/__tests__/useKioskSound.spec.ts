// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 / shared kiosk lib — useKioskSound hook tests.
 *
 * Coverage:
 *  - ensureAudioContext lazy-creates AudioContext on user gesture
 *  - beepSuccess plays 800Hz sine
 *  - beepError plays 300Hz sine
 *  - mute toggle persists to localStorage
 */

import { renderHook, act } from '@testing-library/react';
import { useKioskSound } from '../useKioskSound';

describe('useKioskSound', () => {
  let mockOscillator: any;
  let mockCtx: any;
  beforeEach(() => {
    mockOscillator = {
      frequency: { setValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      type: 'sine',
    };
    mockCtx = {
      currentTime: 0,
      destination: {},
      createOscillator: jest.fn(() => mockOscillator),
      createGain: jest.fn(() => ({
        gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
        connect: jest.fn(),
      })),
      resume: jest.fn().mockResolvedValue(undefined),
      state: 'running',
    };
    (global as any).AudioContext = jest.fn(() => mockCtx);
    (global as any).webkitAudioContext = (global as any).AudioContext;
    window.localStorage.clear();
  });

  it('ensureAudioContext creates AudioContext lazily', () => {
    const { result } = renderHook(() => useKioskSound());
    act(() => {
      result.current.ensureAudioContext();
    });
    expect((global as any).AudioContext).toHaveBeenCalled();
  });

  it('beepSuccess plays 800Hz sine', () => {
    const { result } = renderHook(() => useKioskSound());
    act(() => {
      result.current.ensureAudioContext();
      result.current.beepSuccess();
    });
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(800, expect.any(Number));
  });

  it('beepError plays 300Hz sine', () => {
    const { result } = renderHook(() => useKioskSound());
    act(() => {
      result.current.ensureAudioContext();
      result.current.beepError();
    });
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(300, expect.any(Number));
  });

  it('mute toggle persists to localStorage', () => {
    const { result } = renderHook(() => useKioskSound());
    act(() => {
      result.current.toggle();
    });
    expect(window.localStorage.getItem('kiosk-sound-muted')).toBeTruthy();
  });
});
