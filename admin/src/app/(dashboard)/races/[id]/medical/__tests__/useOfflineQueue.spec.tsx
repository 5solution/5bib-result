// @ts-nocheck — F-018 deferred RTL spec (TD-F013-TESTSTACK).
/**
 * F-018 useOfflineQueue — IndexedDB native API + Background Sync semantics.
 *
 * Coverage when test stack lands (partial — IDB mocking is genuinely tricky):
 *  - enqueueOffline writes to IDB store and resolves with id
 *  - listAll returns queued items
 *  - flushQueue POSTs each item then deletes on 2xx
 *  - flushQueue keeps item on 5xx (retry on next online event)
 *  - useOfflineQueue.flush is auto-invoked on `online` event
 *  - In-memory fallback when IDB unavailable (Safari private mode)
 */

import { renderHook, act } from '@testing-library/react';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

describe('useOfflineQueue', () => {
  it('starts with online=true when navigator.onLine===true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { result } = renderHook(() => useOfflineQueue());
    expect(result.current.isOnline).toBe(true);
  });

  it('flips isOnline=false on offline event', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { result } = renderHook(() => useOfflineQueue());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.isOnline).toBe(false);
  });
});
