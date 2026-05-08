'use client';

/**
 * F-014 BR-AS-25/26 — URL hash deep-link + active-section highlighter.
 *
 * On mount: if `window.location.hash` matches a section id, smooth-scroll
 * into view (skipped under prefers-reduced-motion).
 *
 * While scrolling: IntersectionObserver tracks which section is closest
 * to the viewport top and exposes its id as `activeId`.
 */

import { useEffect, useState } from 'react';

export interface UseUrlHashScrollResult {
  activeId: string;
}

export function useUrlHashScroll(sectionIds: string[]): UseUrlHashScrollResult {
  const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? '');

  // Mount: scroll to hash if present (BR-AS-26 deep-link).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || !sectionIds.includes(hash)) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setActiveId(hash);
  }, [sectionIds]);

  // Active highlight via IntersectionObserver.
  useEffect(() => {
    if (typeof window === 'undefined' || sectionIds.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the most-intersecting entry above viewport center.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = (visible[0].target as HTMLElement).id;
          if (id) setActiveId(id);
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sectionIds]);

  return { activeId };
}
