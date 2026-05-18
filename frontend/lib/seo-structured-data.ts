/**
 * FEATURE-036 — JSON-LD structured data builders (BR-25, BR-26).
 *
 * SportsEvent + BreadcrumbList for /giai-chay/[slug] pages.
 * Reuse same pattern as F-027 hub `seo.structuredData`.
 */

import type { Race } from "./seo-api";
import { buildSellingWebUrl } from "./selling-web-url";

type EventStatus =
  | "https://schema.org/EventScheduled"
  | "https://schema.org/EventPostponed"
  | "https://schema.org/EventInProgress"
  | "https://schema.org/EventEnded";

function mapEventStatus(status: Race["status"]): EventStatus {
  switch (status) {
    case "live":
      return "https://schema.org/EventInProgress";
    case "ended":
      return "https://schema.org/EventEnded";
    case "pre_race":
    default:
      return "https://schema.org/EventScheduled";
  }
}

export function buildSportsEventJsonLd(race: Race): Record<string, unknown> {
  const raceId = race.id ?? race._id ?? "";
  const slug = race.slug ?? "";
  const canonicalUrl = `https://5bib.com/giai-chay/${slug}`;
  const isActive = race.status === "pre_race" || race.status === "live";

  const result: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: race.title,
    sport: "Running",
    eventStatus: mapEventStatus(race.status),
    url: canonicalUrl,
  };

  if (race.startDate) result.startDate = race.startDate;
  if (race.endDate) result.endDate = race.endDate;
  if (race.bannerUrl ?? race.imageUrl) result.image = race.bannerUrl ?? race.imageUrl;
  if (race.description) result.description = race.description;

  if (race.location || race.province) {
    result.location = {
      "@type": "Place",
      name: race.location ?? race.province ?? race.title,
      address: {
        "@type": "PostalAddress",
        addressLocality: race.province ?? "",
        addressCountry: "VN",
      },
    };
  }

  result.organizer = {
    "@type": "Organization",
    name: race.organizer ?? "5BIB",
    url: "https://5bib.com",
  };

  if (isActive && raceId) {
    result.offers = {
      "@type": "Offer",
      priceCurrency: "VND",
      url: buildSellingWebUrl(slug || null, raceId),
      availability: "https://schema.org/InStock",
    };
  }

  return result;
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
