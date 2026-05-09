// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 / shared kiosk lib — useKioskIdle hook tests.
 *
 * Coverage:
 *  - 60s idle fires onIdle callback
 *  - last 10s exposes idleSecondsRemaining countdown
 *  - any pointer/key event resets timer
 *  - enabled=false disables timer entirely
 */

import { renderHook, act } from '@testing-library/react';
import { useKioskIdle } from '../useKioskIdle';

describe('useKioskIdle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires onIdle after 60s of inactivity', () => {
    const onIdle = jest.fn();
    renderHook(() => useKioskIdle({ enabled: true, onIdle }));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(onIdle).toHaveBeenCalled();
  });

  it('exposes countdown in last 10s window', () => {
    const onIdle = jest.fn();
    const { result } = renderHook(() => useKioskIdle({ enabled: true, onIdle }));
    act(() => {
      jest.advanceTimersByTime(55_000); // T-5s
    });
    expect(result.current.idleSecondsRemaining).not.toBeNull();
    expect(result.current.idleSecondsRemaining).toBeLessThanOrEqual(10);
  });

  it('resets timer when pointer event fires', () => {
    const onIdle = jest.fn();
    renderHook(() => useKioskIdle({ enabled: true, onIdle }));
    act(() => {
      jest.advanceTimersByTime(50_000);
      window.dispatchEvent(new Event('pointerdown'));
      jest.advanceTimersByTime(50_000);
    });
    // 50s + reset + 50s = 100s elapsed but only 50s since reset → onIdle NOT fired
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('does nothing when enabled=false', () => {
    const onIdle = jest.fn();
    renderHook(() => useKioskIdle({ enabled: false, onIdle }));
    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });
});
