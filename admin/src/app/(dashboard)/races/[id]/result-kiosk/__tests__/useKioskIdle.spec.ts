// @ts-nocheck — F-013: jest + @testing-library/react not in admin node_modules
// (Manager STOP trigger "NO npm install"). Spec is correct Jest+RTL form,
// will type-check + run once admin gains the test stack (Phase 2).
/**
 * F-013 BR-RK-06 — Idle timer hook tests (Jest + @testing-library/react).
 *
 * Coverage:
 *  - happy: 60s no input → onIdle fires
 *  - edge: countdown emits during last 10s window
 *  - edge: activity event resets timer
 *  - edge: dismiss / manual reset clears countdown
 *  - cleanup: unmount removes window listeners
 */

import { act, renderHook } from '@testing-library/react';
import { useKioskIdle } from '../hooks/useKioskIdle';

jest.useFakeTimers();

describe('useKioskIdle (BR-RK-06)', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('fires onIdle after timeoutMs of inactivity', () => {
    const onIdle = jest.fn();
    renderHook(() =>
      useKioskIdle({ enabled: true, timeoutMs: 60_000, countdownMs: 10_000, onIdle }),
    );
    expect(onIdle).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(60_500);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('emits countdown seconds during last-10s window', () => {
    const onIdle = jest.fn();
    const { result } = renderHook(() =>
      useKioskIdle({ enabled: true, timeoutMs: 60_000, countdownMs: 10_000, onIdle }),
    );
    expect(result.current.idleSecondsRemaining).toBe(null);
    act(() => {
      jest.advanceTimersByTime(51_000); // inside last-10s window
    });
    expect(result.current.idleSecondsRemaining).toBeLessThanOrEqual(10);
    expect(result.current.idleSecondsRemaining).toBeGreaterThan(0);
  });

  it('resets timer on simulated activity', () => {
    const onIdle = jest.fn();
    renderHook(() =>
      useKioskIdle({ enabled: true, timeoutMs: 60_000, countdownMs: 10_000, onIdle }),
    );
    act(() => {
      jest.advanceTimersByTime(40_000);
    });
    act(() => {
      window.dispatchEvent(new Event('mousedown'));
      jest.advanceTimersByTime(40_000); // 40s after reset = still under 60s total
    });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('does not run when enabled=false', () => {
    const onIdle = jest.fn();
    renderHook(() =>
      useKioskIdle({ enabled: false, timeoutMs: 1_000, countdownMs: 500, onIdle }),
    );
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('manual reset() clears countdown state', () => {
    const onIdle = jest.fn();
    const { result } = renderHook(() =>
      useKioskIdle({ enabled: true, timeoutMs: 60_000, countdownMs: 10_000, onIdle }),
    );
    act(() => {
      jest.advanceTimersByTime(55_000);
    });
    expect(result.current.idleSecondsRemaining).not.toBe(null);
    act(() => {
      result.current.reset();
    });
    expect(result.current.idleSecondsRemaining).toBe(null);
  });

  it('cleans up window listeners on unmount', () => {
    const onIdle = jest.fn();
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() =>
      useKioskIdle({ enabled: true, timeoutMs: 60_000, countdownMs: 10_000, onIdle }),
    );
    unmount();
    expect(removeSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});
