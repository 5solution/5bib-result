'use client';

/**
 * F-013 PAUSE-RK-01 — Fullscreen toggle hook for the kiosk surface.
 *
 * Reuses the existing `body[data-fullscreen]` attribute primitive that F-008v2
 * + F-011 already established in `globals.css`. The kiosk-only ≤20 LOC append
 * extends that primitive with `body[data-fullscreen="true"]` overflow:hidden +
 * height:100vh containment for touchscreen layout. Setting the attribute to
 * literal "true" satisfies both the legacy `[data-fullscreen]` selector AND
 * the new `[data-fullscreen="true"]` selector at once.
 *
 * NOTE: Native browser Fullscreen API call (document.documentElement
 * .requestFullscreen) requires a user gesture — this hook expects to be
 * triggered from a click handler ("Bật chế độ Kiosk" CTA).
 */

import { useCallback, useEffect, useState } from 'react';

interface UseKioskFullscreenReturn {
  isFullscreen: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
}

const FULLSCREEN_ATTR = 'data-fullscreen';
const FULLSCREEN_VALUE = 'true';

/** Dynamic-import-safe DOM access guard. */
function hasDocument(): boolean {
  return typeof document !== 'undefined';
}

export function useKioskFullscreen(): UseKioskFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(async () => {
    if (!hasDocument()) return;
    document.body.setAttribute(FULLSCREEN_ATTR, FULLSCREEN_VALUE);
    setIsFullscreen(true);
    // Best-effort native Fullscreen API. Browsers throw if not from user
    // gesture or if blocked — we swallow because the body-attribute fallback
    // already hides admin chrome via CSS.
    try {
      const el = document.documentElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req = (el as any).requestFullscreen as (() => Promise<void>) | undefined;
      if (typeof req === 'function') {
        await req.call(el);
      }
    } catch {
      /* ignore — body-attribute fallback already in effect */
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (!hasDocument()) return;
    document.body.removeAttribute(FULLSCREEN_ATTR);
    setIsFullscreen(false);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exit = (document as any).exitFullscreen as (() => Promise<void>) | undefined;
      if (typeof exit === 'function' && (document as any).fullscreenElement) {
        await exit.call(document);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Escape-to-exit + cleanup on unmount (F-008v2 pattern).
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
      // Prevent leaked fullscreen state on unmount/navigation.
      if (document.body.getAttribute(FULLSCREEN_ATTR) === FULLSCREEN_VALUE) {
        document.body.removeAttribute(FULLSCREEN_ATTR);
      }
    };
  }, []);

  return { isFullscreen, enterFullscreen, exitFullscreen };
}
