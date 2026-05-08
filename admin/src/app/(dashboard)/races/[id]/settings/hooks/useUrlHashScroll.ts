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

import { useEffect, useRef, useState } from 'react';

export interface UseUrlHashScrollResult {
  activeId: string;
}

export function useUrlHashScroll(sectionIds: string[]): UseUrlHashScrollResult {
  const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? '');

  // Stabilize sectionIds dep — caller passes new array literal every render
  // (e.g. `sections.map(s => s.id)`). Without this guard the IntersectionObserver
  // disconnect/reconnect every render AND the scroll-to-hash effect fires
  // smooth-scroll on every state change, snapping the user back to the anchor
  // and effectively BLOCKING scroll. Bug found 2026-05-08 on Settings#timing.
  const idsKey = sectionIds.join('|');
  const idsRef = useRef(sectionIds);
  idsRef.current = sectionIds;

  // Mount-only: scroll to hash if present (BR-AS-26 deep-link).
  // Empty deps — runs ONCE on mount, never re-fires (no smooth-scroll snap-back).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || !idsRef.current.includes(hash)) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setActiveId(hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active highlight via IntersectionObserver — re-init only when section LIST
  // actually changes (string key, not array identity).
  useEffect(() => {
    if (typeof window === 'undefined' || idsRef.current.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = (visible[0].target as HTMLElement).id;
          if (id) setActiveId((prev) => (prev === id ? prev : id));
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    idsRef.current.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [idsKey]);

  return { activeId };
}
