'use client';

/**
 * S5Analytics — DOM-level GTM tracking for solution.5sport.vn.
 * Renders null. Form tracking is handled in s5-lead-form.tsx.
 *
 * Events covered:
 *   nav_click          — header nav anchor clicks
 *   hero_cta_click     — CTA buttons in #top hero
 *   pricing_plan_view  — #pricing enters viewport
 *   pricing_cta_click  — buttons in #pricing
 *   ecosystem_link_click — links in #ecosystem
 *   scroll_depth       — each section crossing 30% threshold
 */

import * as React from 'react';
import { dl } from '@/lib/gtm';

export default function S5Analytics() {
  React.useEffect(() => {
    // ── Nav clicks ────────────────────────────────────────────────────────
    const navLinks = document.querySelectorAll<HTMLAnchorElement>('header a[href^="#"]');
    const onNavClick = function (this: HTMLAnchorElement) {
      dl({
        event: 'nav_click',
        nav_item: (this.getAttribute('href') ?? '').replace('#', ''),
        nav_text: this.innerText.trim(),
      });
    };
    navLinks.forEach(link => link.addEventListener('click', onNavClick));

    // ── Hero CTA clicks ──────────────────────────────────────────────────
    const heroButtons = document.querySelectorAll<HTMLButtonElement>('#top button, #top a.s5-btn');
    const onHeroBtn = function (this: HTMLButtonElement | HTMLAnchorElement) {
      dl({
        event: 'hero_cta_click',
        cta_text: this.innerText.trim(),
        cta_location: 'hero',
      });
    };
    heroButtons.forEach(btn => btn.addEventListener('click', onHeroBtn as EventListener));

    // ── Pricing CTA clicks ────────────────────────────────────────────────
    const pricingButtons = document.querySelectorAll<HTMLButtonElement>('#pricing button, #pricing a.s5-btn');
    const onPricingBtn = function (this: HTMLButtonElement | HTMLAnchorElement) {
      dl({
        event: 'pricing_cta_click',
        cta_text: this.innerText.trim(),
        cta_location: 'pricing',
      });
    };
    pricingButtons.forEach(btn => btn.addEventListener('click', onPricingBtn as EventListener));

    // ── Ecosystem link clicks ─────────────────────────────────────────────
    const ecoLinks = document.querySelectorAll<HTMLAnchorElement>('#ecosystem a');
    const onEcoLink = function (this: HTMLAnchorElement) {
      dl({
        event: 'ecosystem_link_click',
        product_name: this.innerText.trim() || this.title || 'unknown',
        destination_url: this.href,
        section: 'ecosystem',
      });
    };
    ecoLinks.forEach(link => link.addEventListener('click', onEcoLink));

    // ── Scroll depth + pricing_plan_view ─────────────────────────────────
    const scrollSections = [
      'top', 'pain', 'features', 'marketplace', 'community',
      'tournament', 'rating', 'ecosystem', 'pricing', 'faq', 'lead-form',
    ];
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

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      navLinks.forEach(link => link.removeEventListener('click', onNavClick));
      heroButtons.forEach(btn => btn.removeEventListener('click', onHeroBtn as EventListener));
      pricingButtons.forEach(btn => btn.removeEventListener('click', onPricingBtn as EventListener));
      ecoLinks.forEach(link => link.removeEventListener('click', onEcoLink));
      scrollObserver.disconnect();
    };
  }, []);

  return null;
}
