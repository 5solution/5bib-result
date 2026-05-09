'use client';

/**
 * Shared kiosk Fullscreen hook — minted by F-015 (Manager Plan §3 Option 3).
 *
 * Source: F-013 `result-kiosk/hooks/useKioskFullscreen.ts` — generalized for
 * cross-feature reuse (F-015 Check-In Kiosk + F-013 retrofit TD-F015-01).
 *
 * Reuses the existing `body[data-fullscreen]` attribute primitive that
 * F-008v2 + F-011 established in `globals.css`. Setting the attribute to
 * literal "true" satisfies both `[data-fullscreen]` and `[data-fullscreen="true"]`.
 *
 * NOTE: Native `document.documentElement.requestFullscreen` requires a user
 * gesture — this hook expects to be called from a click handler.
 */

import { useCallback, useEffect, useState } from 'react';

interface UseFullscreenReturn {
  isFullscreen: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
}

const FULLSCREEN_ATTR = 'data-fullscreen';
const FULLSCREEN_VALUE = 'true';

function hasDocument(): boolean {
  return typeof document !== 'undefined';
}

export function useFullscreen(): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(async () => {
    if (!hasDocument()) return;
    document.body.setAttribute(FULLSCREEN_ATTR, FULLSCREEN_VALUE);
    setIsFullscreen(true);
    try {
      const el = document.documentElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req = (el as any).requestFullscreen as (() => Promise<void>) | undefined;
      if (typeof req === 'function') {
        await req.call(el);
      }
    } catch {
      /* swallowed — body-attribute fallback already in effect */
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (!hasDocument()) return;
    document.body.removeAttribute(FULLSCREEN_ATTR);
    setIsFullscreen(false);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exit = (document as any).exitFullscreen as (() => Promise<void>) | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof exit === 'function' && (document as any).fullscreenElement) {
        await exit.call(document);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hasDocument()) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.body.getAttribute(FULLSCREEN_ATTR) === FULLSCREEN_VALUE) {
        document.body.removeAttribute(FULLSCREEN_ATTR);
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
      if (document.body.getAttribute(FULLSCREEN_ATTR) === FULLSCREEN_VALUE) {
        document.body.removeAttribute(FULLSCREEN_ATTR);
      }
    };
  }, []);

  return { isFullscreen, enterFullscreen, exitFullscreen };
}
