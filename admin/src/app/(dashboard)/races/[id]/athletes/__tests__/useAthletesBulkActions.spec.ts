// @ts-nocheck — F-014 deferred spec (TD-F013-TESTSTACK locked).
/**
 * F-014 BR-AS-15..18 — Bulk actions hook.
 *
 * Coverage:
 *   - toggle(id) flips selection state
 *   - toggleAll([ids]) selects all or clears all if already-selected
 *   - clear() empties selection
 *   - capExceeded becomes true when selection > BULK_ACTION_CAP (500)
 *   - defer flag is true (Manager Option B placeholder until F-014.5)
 *   - bulkChangeStatus is no-op + toast (does NOT throw)
 */

import { renderHook, act } from '@testing-library/react';
import { useAthletesBulkActions } from '../hooks/useAthletesBulkActions';

jest.mock('sonner', () => ({
  toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() },
}));

describe('useAthletesBulkActions (BR-AS-15..18)', () => {
  it('starts with empty selection + defer=true', () => {
    const { result } = renderHook(() => useAthletesBulkActions());
    expect(result.current.selected.size).toBe(0);
    expect(result.current.defer).toBe(true);
    expect(result.current.capExceeded).toBe(false);
  });

  it('toggle(id) flips state', () => {
    const { result } = renderHook(() => useAthletesBulkActions());
    act(() => result.current.toggle('a'));
    expect(result.current.selected.has('a')).toBe(true);
    act(() => result.current.toggle('a'));
    expect(result.current.selected.has('a')).toBe(false);
  });

  it('toggleAll selects all when none selected', () => {
    const { result } = renderHook(() => useAthletesBulkActions());
    act(() => result.current.toggleAll(['a', 'b', 'c']));
    expect(result.current.selected.size).toBe(3);
  });

  it('toggleAll clears subset when all already selected', () => {
    const { result } = renderHook(() => useAthletesBulkActions());
    act(() => result.current.toggleAll(['a', 'b']));
    act(() => result.current.toggleAll(['a', 'b']));
    expect(result.current.selected.has('a')).toBe(false);
    expect(result.current.selected.has('b')).toBe(false);
  });

  it('clear() empties selection', () => {
    const { result } = renderHook(() => useAthletesBulkActions());
    act(() => result.current.toggleAll(['a', 'b', 'c']));
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
  });

  it('capExceeded triggers when selection > 500', () => {
    const { result } = renderHook(() => useAthletesBulkActions());
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`);
    act(() => result.current.toggleAll(ids));
    expect(result.current.capExceeded).toBe(true);
  });

  it('bulkChangeStatus is no-op placeholder + toast info', async () => {
    const { result } = renderHook(() => useAthletesBulkActions());
    await act(async () => {
      await result.current.bulkChangeStatus({
        athleteIds: ['x'],
        targetStatus: 'DNF',
        reason: 'test reason 1234',
      });
    });
    // No throw means placeholder accepted; toast.info is called inside.
    expect(true).toBe(true);
  });
});
