'use client';

import { useEffect } from 'react';

/**
 * Scroll-reveal for every element tagged with `data-reveal`.
 *
 * Pair of observers:
 *  1. IntersectionObserver — flips `data-revealed="true"` on first enter of
 *     the viewport. The CSS rule (globals.css) fades + lifts the element
 *     into view.
 *  2. MutationObserver — watches `document.body` for newly added nodes that
 *     carry `data-reveal` and hands them to (1). This matters because the
 *     athlete page has an early `if (!athlete) return ...` gate: the hook's
 *     first effect fires when NO chart nodes exist in the DOM yet. When
 *     data loads and the charts mount, we need to pick them up or they
 *     stay stuck at `opacity: 0`.
 *
 * Trade-offs:
 *  - One shared observer pair per page (cheap) vs per-component ref — the
 *    data-attribute approach lets us sprinkle `data-reveal` onto any element
 *    without hoisting refs up.
 *  - `unobserve` after first trigger → no leak, no repeat animation.
 *  - Respects `prefers-reduced-motion`: the CSS rule short-circuits the
 *    transform/opacity transition, so we still tag the node but it appears
 *    instantly.
 */
export function useScrollRevealObserver(deps: unknown[] = []): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Fallback for very old browsers — just reveal everything.
    if (typeof IntersectionObserver === 'undefined') {
      document
        .querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])')
        .forEach((el) => el.setAttribute('data-revealed', 'true'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', 'true');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    const observe = (el: Element) => {
      if (el instanceof HTMLElement && !el.hasAttribute('data-revealed')) {
        io.observe(el);
      }
    };

    // Pick up anything already on the page.
    document
      .querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])')
      .forEach(observe);

    // Pick up anything that mounts later (e.g. charts that render only
    // after athlete data lands).
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute('data-reveal')) observe(node);
          node
            .querySelectorAll?.<HTMLElement>('[data-reveal]:not([data-revealed])')
            .forEach(observe);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
