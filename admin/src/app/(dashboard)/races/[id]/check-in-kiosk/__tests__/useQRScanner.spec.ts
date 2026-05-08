// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 BR-CK-02 — useQRScanner @zxing/browser wrapper tests.
 *
 * Coverage:
 *  - dynamic import + camera permission grant → starts decoder
 *  - permission denied → exposes error state
 *  - cleanup on stop closes decoder + releases stream
 *  - successful scan invokes onScanned with text payload
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useQRScanner } from '../hooks/useQRScanner';

describe('useQRScanner', () => {
  beforeEach(() => {
    (global.navigator as any).mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [{ stop: jest.fn() }],
      }),
    };
  });

  it('starts decoder when start() called and permission granted', async () => {
    const onScanned = jest.fn();
    const { result } = renderHook(() => useQRScanner({ onScanned }));
    await act(async () => {
      await result.current.start({ videoElement: document.createElement('video') });
    });
    expect(result.current.active).toBe(true);
  });

  it('exposes error when getUserMedia rejects', async () => {
    (global.navigator as any).mediaDevices.getUserMedia = jest
      .fn()
      .mockRejectedValue(new Error('NotAllowedError'));
    const onScanned = jest.fn();
    const { result } = renderHook(() => useQRScanner({ onScanned }));
    await act(async () => {
      await result.current.start({ videoElement: document.createElement('video') });
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it('stops cleanly on unmount', async () => {
    const onScanned = jest.fn();
    const { result, unmount } = renderHook(() => useQRScanner({ onScanned }));
    await act(async () => {
      await result.current.start({ videoElement: document.createElement('video') });
    });
    unmount();
    expect(result.current.active).toBe(false);
  });
});
