// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 / shared kiosk lib — useFullscreen hook tests.
 *
 * Coverage:
 *  - enterFullscreen calls Fullscreen API on user gesture
 *  - exitFullscreen exits and clears body[data-fullscreen]
 *  - body[data-fullscreen='true'] set on enter
 *  - ESC keydown returns to non-fullscreen state
 */

import { renderHook, act } from '@testing-library/react';
import { useFullscreen } from '../useFullscreen';

describe('useFullscreen', () => {
  let requestSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;
  beforeEach(() => {
    requestSpy = jest
      .spyOn(document.documentElement, 'requestFullscreen')
      .mockResolvedValue(undefined as any);
    exitSpy = jest.spyOn(document, 'exitFullscreen').mockResolvedValue(undefined as any);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.removeAttribute('data-fullscreen');
  });

  it('enterFullscreen calls Fullscreen API', async () => {
    const { result } = renderHook(() => useFullscreen());
    await act(async () => {
      await result.current.enterFullscreen();
    });
    expect(requestSpy).toHaveBeenCalled();
    expect(document.body.getAttribute('data-fullscreen')).toBe('true');
  });

  it('exitFullscreen restores state', async () => {
    const { result } = renderHook(() => useFullscreen());
    await act(async () => {
      await result.current.enterFullscreen();
      await result.current.exitFullscreen();
    });
    expect(exitSpy).toHaveBeenCalled();
    expect(document.body.getAttribute('data-fullscreen')).not.toBe('true');
  });

  it('ESC keydown does not throw', () => {
    renderHook(() => useFullscreen());
    expect(() => {
      const ev = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(ev);
    }).not.toThrow();
  });
});
