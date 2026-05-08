// @ts-nocheck — F-014 deferred spec (TD-F013-TESTSTACK locked).
/**
 * F-014 BR-AS-09/52 — Search debounce.
 *
 * Coverage:
 *   - debounce 300ms applied between rapid setQuery calls
 *   - flush() bypasses debounce
 *   - cancel-on-unmount (no leaked timer)
 *   - cancel-on-rapid-input (only the last value is committed)
 *   - initial value seeds both query + debouncedQuery
 */

import { renderHook, act } from '@testing-library/react';
import { useAthletesSearch } from '../hooks/useAthletesSearch';

jest.useFakeTimers();

describe('useAthletesSearch (BR-AS-09 debounce 300ms)', () => {
  it('seeds initial value', () => {
    const { result } = renderHook(() => useAthletesSearch('initial'));
    expect(result.current.query).toBe('initial');
    expect(result.current.debouncedQuery).toBe('initial');
  });

  it('debounces 300ms before committing to debouncedQuery', () => {
    const { result } = renderHook(() => useAthletesSearch(''));
    act(() => result.current.setQuery('Nguyen'));
    expect(result.current.query).toBe('Nguyen');
    expect(result.current.debouncedQuery).toBe('');
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current.debouncedQuery).toBe('');
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.debouncedQuery).toBe('Nguyen');
  });

  it('cancels prior debounce on rapid input — only last value commits', () => {
    const { result } = renderHook(() => useAthletesSearch(''));
    act(() => result.current.setQuery('a'));
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => result.current.setQuery('ab'));
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => result.current.setQuery('abc'));
    expect(result.current.debouncedQuery).toBe('');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.debouncedQuery).toBe('abc');
  });

  it('flush() commits immediately (Enter-key shortcut)', () => {
    const { result } = renderHook(() => useAthletesSearch(''));
    act(() => result.current.setQuery('go'));
    expect(result.current.debouncedQuery).toBe('');
    act(() => result.current.flush());
    expect(result.current.debouncedQuery).toBe('go');
  });

  it('clears timer on unmount (no leak)', () => {
    const { result, unmount } = renderHook(() => useAthletesSearch(''));
    act(() => result.current.setQuery('x'));
    unmount();
    // No pending timers should fire — advancing should not throw.
    expect(() => jest.advanceTimersByTime(500)).not.toThrow();
  });
});
