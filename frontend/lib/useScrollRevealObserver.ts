'use client';

import { useEffect } from 'react';

/**
 * Attaches a single IntersectionObserver that watches every element
 * tagged with `data-reveal` inside `document` and adds `data-revealed="true"`
 * when it first enters the viewport. The matching CSS rule (globals.css)
 * fades + lifts the element into view.
 *
 * Trade-offs:
 *  - One shared observer per page (cheap) vs per-component ref — the data-
 *    attribute approach lets us sprinkle `data-reveal` onto any existing
 *    element without hoisting refs up, which is exactly what the v2 spec
 *    asks for ("apply scroll-reveal to every section").
 *  - `unobserve` after first trigger → no leak, no repeat animation.
 *  - Respects `prefers-reduced-motion`: the CSS rule short-circuits the
 *    transform/opacity transition, so we still tag the node but it appears
 *    instantly.
 *
 * Re-scan on `deps` change so that newly mounted sections (e.g. after data
 * loads) also get observed.
 */
export function useScrollRevealObserver(deps: unknown[] = []): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof IntersectionObserver === 'undefined') {
      // Very old browsers — just reveal everything so content is visible.
      document
        .querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])')
        .forEach((el) => el.setAttribute('data-revealed', 'true'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', 'true');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    const targets = document.querySelectorAll<HTMLElement>(
      '[data-reveal]:not([data-revealed])',
    );
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
