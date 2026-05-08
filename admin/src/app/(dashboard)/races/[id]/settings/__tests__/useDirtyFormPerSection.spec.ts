// @ts-nocheck — F-014 deferred spec (TD-F013-TESTSTACK locked).
/**
 * F-014 BR-AS-28/29 — Per-section dirty form tracker.
 *
 * Coverage:
 *   - setDirty(id, true) marks section dirty
 *   - setDirty(id, false) clears section
 *   - anyDirty true when at least one section dirty
 *   - clearAll() resets the map
 *   - re-setting same value is no-op (no extra render)
 */

import { renderHook, act } from '@testing-library/react';
import { useDirtyFormPerSection } from '../hooks/useDirtyFormPerSection';

describe('useDirtyFormPerSection (BR-AS-28/29)', () => {
  it('starts with empty map and anyDirty=false', () => {
    const { result } = renderHook(() => useDirtyFormPerSection());
    expect(result.current.dirtyMap).toEqual({});
    expect(result.current.anyDirty).toBe(false);
  });

  it('setDirty(id, true) flips section dirty', () => {
    const { result } = renderHook(() => useDirtyFormPerSection());
    act(() => result.current.setDirty('race-meta', true));
    expect(result.current.dirtyMap['race-meta']).toBe(true);
    expect(result.current.anyDirty).toBe(true);
  });

  it('setDirty(id, false) clears section', () => {
    const { result } = renderHook(() => useDirtyFormPerSection());
    act(() => result.current.setDirty('publishing', true));
    act(() => result.current.setDirty('publishing', false));
    expect(result.current.dirtyMap['publishing']).toBeUndefined();
    expect(result.current.anyDirty).toBe(false);
  });

  it('multiple sections track independently', () => {
    const { result } = renderHook(() => useDirtyFormPerSection());
    act(() => result.current.setDirty('a', true));
    act(() => result.current.setDirty('b', true));
    expect(Object.keys(result.current.dirtyMap).sort()).toEqual(['a', 'b']);
  });

  it('clearAll() resets the map', () => {
    const { result } = renderHook(() => useDirtyFormPerSection());
    act(() => result.current.setDirty('a', true));
    act(() => result.current.setDirty('b', true));
    act(() => result.current.clearAll());
    expect(result.current.dirtyMap).toEqual({});
  });

  it('re-setting same value preserves map identity (perf guard)', () => {
    const { result } = renderHook(() => useDirtyFormPerSection());
    act(() => result.current.setDirty('a', true));
    const ref1 = result.current.dirtyMap;
    act(() => result.current.setDirty('a', true));
    const ref2 = result.current.dirtyMap;
    expect(ref2).toBe(ref1);
  });
});
