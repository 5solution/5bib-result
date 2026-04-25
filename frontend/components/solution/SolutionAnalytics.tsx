'use client';

/**
 * SolutionAnalytics — mounts once per page, attaches all DOM-level GTM tracking.
 * Renders null. Section-specific events (form, tabs) are handled in their own components.
 *
 * Events covered here:
 *   4.1  nav_click
 *   4.2  hero_cta_click
 *   4.3  counter_visible        (fired after CountUpStat finishes)
 *   4.6  pricing_plan_view      (via IntersectionObserver)
 *   4.6  pricing_cta_click
 *   4.9  scroll_depth
 *   4.10 back_to_top_click
 */

import * as React from 'react';
import { dl } from '@/lib/gtm';

export default function SolutionAnalytics() {
  React.useEffect(() => {
    // ── 4.1 Nav clicks ──────────────────────────────────────────────────────
    const navLinks = document.querySelectorAll<HTMLAnchorElement>('header a[href^="#"]');
    const onNavClick = function (this: HTMLAnchorElement) {
      dl({
        event: 'nav_click',
        nav_item: (this.getAttribute('href') ?? '').replace('#', ''),
        nav_text: this.innerText.trim(),
      });
    };
    navLinks.forEach(link => link.addEventListener('click', onNavClick));

    // ── 4.2 Hero CTA clicks ─────────────────────────────────────────────────
    // Hero section has id="top"
    const heroButtons = document.querySelectorAll<HTMLButtonElement>('#top button');
    const onHeroBtn = function (this: HTMLButtonElement) {
      dl({
        event: 'hero_cta_click',
        cta_text: this.innerText.trim(),
        cta_location: 'hero',
      });
    };
    heroButtons.forEach(btn => btn.addEventListener('click', onHeroBtn));

    // ── 4.6 Pricing CTA clicks ──────────────────────────────────────────────
    const pricingButtons = document.querySelectorAll<HTMLButtonElement>('#pricing button');
    const onPricingBtn = function (this: HTMLButtonElement) {
      dl({
        event: 'pricing_cta_click',
        cta_text: this.innerText.trim(),
        cta_location: 'pricing',
      });
    };
    pricingButtons.forEach(btn => btn.addEventListener('click', onPricingBtn));

    // ── 4.10 Back-to-top button ─────────────────────────────────────────────
    const backTop = document.getElementById('backTop');
    const onBackTop = () => dl({ event: 'back_to_top_click', trigger_location: 'floating_button' });
    backTop?.addEventListener('click', onBackTop);

    // ── 4.9 Scroll depth + section-entry events ─────────────────────────────
    // Maps to sections that have id attributes on this page.
    // Sections without an id (e.g. vnpay, ecosystem) are gracefully skipped.
    const scrollSections = ['top', 'features', 'customers', 'pricing', 'faq', 'contact'];
    const scrollTracked = new Set<string>();

    const scrollObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          if (scrollTracked.has(id)) return;
          scrollTracked.add(id);

          dl({
            event: 'scroll_depth',
            section_id: id,
            section_order: scrollSections.indexOf(id) + 1,
            total_sections: scrollSections.length,
          });

          // Fire supplementary section-view events
          if (id === 'pricing') {
            dl({ event: 'pricing_plan_view', section: 'pricing' });
          }
        });
      },
      { threshold: 0.3 },
    );

    scrollSections.forEach(id => {
      const el = document.getElementById(id);
      if (el) scrollObserver.observe(el);
    });

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      navLinks.forEach(link => link.removeEventListener('click', onNavClick));
      heroButtons.forEach(btn => btn.removeEventListener('click', onHeroBtn));
      pricingButtons.forEach(btn => btn.removeEventListener('click', onPricingBtn));
      backTop?.removeEventListener('click', onBackTop);
      scrollObserver.disconnect();
    };
  }, []);

  return null;
}
