'use client';

import * as React from 'react';

/**
 * Custom cursor — lerp-followed blob + pinpoint dot.
 * - Default: blue 36px
 * - data-cursor="hover" elements → magenta 64px
 * - data-cursor="magnetic" elements → lime 88px
 * Disabled on touch devices via CSS.
 */
export function S2Cursor() {
  const blobRef = React.useRef<HTMLDivElement>(null);
  const dotRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const blob = blobRef.current;
    const dot = dotRef.current;
    if (!blob || !dot) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let bx = mx;
    let by = my;
    let raf = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      bx = lerp(bx, mx, 0.18);
      by = lerp(by, my, 0.18);
      blob.style.transform = `translate3d(${bx - 18}px, ${by - 18}px, 0)`;
      dot.style.transform = `translate3d(${mx - 3}px, ${my - 3}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;

      // Detect cursor mode based on hovered element
      const target = e.target as HTMLElement | null;
      const cursorEl = target?.closest('[data-cursor]') as HTMLElement | null;
      const mode = cursorEl?.dataset.cursor;
      if (mode) {
        blob.dataset.mode = mode;
      } else {
        delete blob.dataset.mode;
      }
    };

    document.addEventListener('pointermove', onMove);
    return () => {
      document.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={blobRef} className="s2-cursor" aria-hidden="true" />
      <div ref={dotRef} className="s2-cursor-dot" aria-hidden="true" />
    </>
  );
}
