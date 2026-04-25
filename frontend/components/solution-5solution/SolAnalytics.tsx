'use client';

/**
 * SolAnalytics — DOM-level GTM tracking for 5solution.vn.
 * Renders null. Form tracking is handled in sol-lead-form.tsx,
 * module card click tracking is handled in sol-ecosystem.tsx.
 *
 * Events covered here:
 *   nav_click          — header nav anchor clicks
 *   hero_cta_click     — CTA buttons in #top hero
 *   scroll_depth       — each section crossing 30% threshold
 */

import * as React from 'react';

function dl(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
}

const SCROLL_SECTIONS = [
  'top',
  'about',
  'ecosystem',
  '5bib',
  '5ticket',
  'result',
  '5pix',
  'why',
  'process',
  'testimonials',
  'partners',
  'contact',
] as const;

export default function SolAnalytics() {
  React.useEffect(() => {
    // ── Nav clicks ───────────────────────────────────────────────────────
    const navLinks = document.querySelectorAll<HTMLAnchorElement>(
      'header a[href^="#"]',
    );
    const onNavClick = function (this: HTMLAnchorElement) {
      dl({
        event: 'nav_click',
        nav_item: (this.getAttribute('href') ?? '').replace('#', ''),
        nav_text: this.innerText.trim(),
      });
    };
    navLinks.forEach((link) => link.addEventListener('click', onNavClick));

    // ── Hero CTA clicks ──────────────────────────────────────────────────
    const heroButtons = document.querySelectorAll<HTMLAnchorElement>(
      '#top a.sol-btn',
    );
    const onHeroBtn = function (this: HTMLAnchorElement) {
      dl({
        event: 'hero_cta_click',
        cta_text: this.innerText.trim(),
        cta_destination: this.getAttribute('href') ?? '',
      });
    };
    heroButtons.forEach((btn) =>
      btn.addEventListener('click', onHeroBtn as EventListener),
    );

    // ── Scroll depth ─────────────────────────────────────────────────────
    const tracked = new Set<string>();
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          if (tracked.has(id)) return;
          tracked.add(id);
          dl({
            event: 'scroll_depth',
            section_id: id,
            section_order: SCROLL_SECTIONS.indexOf(id as never) + 1,
            total_sections: SCROLL_SECTIONS.length,
          });
        });
      },
      { threshold: 0.3 },
    );

    SCROLL_SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      navLinks.forEach((link) =>
        link.removeEventListener('click', onNavClick),
      );
      heroButtons.forEach((btn) =>
        btn.removeEventListener('click', onHeroBtn as EventListener),
      );
      obs.disconnect();
    };
  }, []);

  return null;
}
