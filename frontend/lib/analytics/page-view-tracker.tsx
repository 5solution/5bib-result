'use client';

/**
 * F-041 PageViewTracker — SPA pageview hybrid (BR-41-07).
 *
 * GA4 Enhanced Measurement auto fires `page_view` on history change.
 * THIS component emits CONTEXT events with entity params for dashboard segmentation:
 *
 *   `/`                                     → (no extra — Enhanced page_view covers homepage)
 *   `/calendar`                             → view_race_calendar
 *   `/giai-chay` + `/giai-chay/[...]`       → view_race_directory (+ city_slug if present)
 *   `/races/[slug]`                         → view_race (race_slug)
 *   `/races/[slug]/ranking/[courseId]`      → view_ranking (race_slug, course_id)
 *   `/races/[slug]/[bib]`                   → view_athlete (race_slug, bib, from_route: 'direct')
 *   `/hub/[slug]`                           → view_hub (hub_slug)
 *
 * NOT fired here: context events that have other natural trigger points (vd:
 * `view_race` fired inside race page useEffect with already-resolved params).
 * This tracker is FALLBACK for routes that don't have explicit per-page wiring.
 *
 * Mount once trong `(main)/layout.tsx`. Listens `usePathname()` change.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useGAEvent } from './useGAEvent';
import { EVENTS } from './events';
import { useTranslation } from 'react-i18next';

export default function PageViewTracker() {
  const pathname = usePathname();
  const gaEvent = useGAEvent();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'vi') as 'vi' | 'en';

  useEffect(() => {
    if (!pathname) return;

    // Calendar page
    if (pathname === '/calendar') {
      gaEvent(EVENTS.VIEW_RACE_CALENDAR, { lang });
      return;
    }

    // Race directory (`/giai-chay` or `/giai-chay/thanh-pho/[citySlug]` or `/giai-chay/[raceSlug]`)
    if (pathname.startsWith('/giai-chay')) {
      const citySlugMatch = pathname.match(/^\/giai-chay\/thanh-pho\/([^/]+)/);
      gaEvent(EVENTS.VIEW_RACE_DIRECTORY, {
        lang,
        ...(citySlugMatch ? { city_slug: citySlugMatch[1] } : {}),
      });
      return;
    }

    // Athlete profile: `/races/[slug]/[bib]` (bib = numeric-ish string, NOT `ranking` / `compare`)
    const athleteMatch = pathname.match(/^\/races\/([^/]+)\/(?!ranking|compare|components)([^/]+)$/);
    if (athleteMatch) {
      gaEvent(EVENTS.VIEW_ATHLETE, {
        race_slug: athleteMatch[1],
        bib: athleteMatch[2],
        from_route: 'direct',
        lang,
      });
      return;
    }

    // Course ranking: `/races/[slug]/ranking/[courseId]`
    const rankingMatch = pathname.match(/^\/races\/([^/]+)\/ranking\/([^/]+)$/);
    if (rankingMatch) {
      gaEvent(EVENTS.VIEW_RANKING, {
        race_slug: rankingMatch[1],
        course_id: rankingMatch[2],
        lang,
      });
      return;
    }

    // Race detail: `/races/[slug]` (and NOT a deeper route)
    const raceMatch = pathname.match(/^\/races\/([^/]+)\/?$/);
    if (raceMatch) {
      gaEvent(EVENTS.VIEW_RACE, {
        race_slug: raceMatch[1],
        from_route: 'direct',
        lang,
      });
      return;
    }

    // Hub: `/hub/[slug]`
    const hubMatch = pathname.match(/^\/hub\/([^/]+)/);
    if (hubMatch) {
      gaEvent(EVENTS.VIEW_HUB, { hub_slug: hubMatch[1], lang });
      return;
    }
  }, [pathname, lang, gaEvent]);

  return null;
}
