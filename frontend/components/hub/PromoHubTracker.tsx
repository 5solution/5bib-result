"use client";

/**
 * FEATURE-027 — PromoHubTracker (Client Component).
 *
 * Responsibilities:
 *   1. Fire `view` event on mount (POST /api/promo-hub-analytics/track-view)
 *      — Backend rate-limits 1 view per IP per slug per 5min (BR-PH-09).
 *   2. Event delegation cho click tracking: listen click trên document,
 *      check target có `data-promo-cta` attributes → fire `track-click`.
 *
 * Why event delegation (vs onClick handler trong mỗi section):
 *   - Sections là Server Components — không thể attach event handler trực tiếp
 *   - Delegation pattern works dù sections render server-side
 *   - Single listener cleanup khi component unmount
 *
 * Errors silently ignored — analytics failure KHÔNG impact UX.
 */

import { useEffect } from "react";

const TRACK_VIEW_URL = "/api/promo-hub-analytics/track-view";
const TRACK_CLICK_URL = "/api/promo-hub-analytics/track-click";

export function PromoHubTracker({
  hubId,
  slug,
}: {
  hubId: string;
  slug: string;
}) {
  useEffect(() => {
    // 1. Fire view event on mount.
    const fireView = async () => {
      try {
        await fetch(TRACK_VIEW_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hubId, slug }),
          keepalive: true,
        });
      } catch {
        /* silent */
      }
    };
    fireView();

    // 2. Click delegation. Listen on the hub root.
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Walk up to find closest [data-promo-cta] anchor
      const cta = target.closest<HTMLElement>("[data-promo-cta]");
      if (!cta) return;

      const sectionId = cta.dataset.promoSectionId;
      const ctaId = cta.dataset.promoCtaId;
      const label = cta.dataset.promoCtaLabel ?? cta.textContent?.trim() ?? "";
      const url = cta.dataset.promoCtaUrl ?? (cta as HTMLAnchorElement).href ?? "";
      if (!sectionId) return;

      // Fire async — do not block navigation
      fetch(TRACK_CLICK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hubId,
          sectionId,
          ctaId,
          label,
          url,
        }),
        keepalive: true,
      }).catch(() => {
        /* silent */
      });
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  }, [hubId, slug]);

  return null;
}
