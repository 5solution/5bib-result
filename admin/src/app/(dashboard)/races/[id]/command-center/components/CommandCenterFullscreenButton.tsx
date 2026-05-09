'use client';

/**
 * F-008 v2 BR-CC2-22 — Fullscreen toggle button.
 *
 * Pattern: toggle `data-fullscreen` attribute on `<body>`. Globals.css selectors
 * (`body[data-fullscreen] [data-race-ops-shell-header] {...}`) translate the
 * shell header offscreen + remove main padding via 200ms ease-out CSS
 * transition. NO browser F11 API — admin-only fullscreen, NOT OS fullscreen.
 *
 * Esc key listener registered globally (cleanup on unmount). Body attribute is
 * also removed on unmount to prevent leaked fullscreen state when user
 * navigates away mid-session.
 */

import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CommandCenterFullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.body.hasAttribute('data-fullscreen')) {
        document.body.removeAttribute('data-fullscreen');
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
      // Cleanup on unmount — prevent leaked fullscreen state if user
      // navigates away while the body attribute is still set.
      document.body.removeAttribute('data-fullscreen');
    };
  }, []);

  const toggle = () => {
    if (typeof document === 'undefined') return;
    const next = !document.body.hasAttribute('data-fullscreen');
    if (next) {
      document.body.setAttribute('data-fullscreen', '');
    } else {
      document.body.removeAttribute('data-fullscreen');
    }
    setIsFullscreen(next);
  };

  return (
    <Button
      type="button"
      onClick={toggle}
      variant="outline"
      size="sm"
      className="h-9 gap-2"
      title={
        isFullscreen
          ? 'Thoát toàn màn hình (Esc)'
          : 'Toàn màn hình — ẩn shell header'
      }
      data-testid="command-center-fullscreen-button"
      aria-pressed={isFullscreen}
    >
      {isFullscreen ? (
        <>
          <Minimize2 className="h-3.5 w-3.5" />
          <span>Thoát</span>
        </>
      ) : (
        <>
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Toàn màn hình</span>
        </>
      )}
    </Button>
  );
}
