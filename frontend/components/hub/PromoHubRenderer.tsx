/**
 * FEATURE-027 — PromoHubRenderer (Server Component dispatcher).
 *
 * Maps section.type → section component. All sections are Server
 * Components để SSR HTML đầy đủ cho SEO + Lighthouse. Client interactivity
 * (click tracking) delegated qua PromoHubTracker (sibling Client Component
 * dùng event delegation đọc `data-promo-cta-*` attributes).
 *
 * Section type không support → skip (forward-compat khi backend thêm type
 * mới mà frontend chưa update).
 */

import type { SectionResponseDto } from "@/lib/api-generated";
import { HeroSection } from "./sections/HeroSection";
import { RaceCalendarSection } from "./sections/RaceCalendarSection";
import { FeaturedRacesSection } from "./sections/FeaturedRacesSection";
import { PromoBannerSection } from "./sections/PromoBannerSection";
import { CtaButtonsSection } from "./sections/CtaButtonsSection";
import { SponsorsSection } from "./sections/SponsorsSection";
import { StatsSection } from "./sections/StatsSection";
import { RichTextSection } from "./sections/RichTextSection";
import { RecentResultsSection } from "./sections/RecentResultsSection";

export function PromoHubRenderer({ sections }: { sections: SectionResponseDto[] }) {
  return (
    <div className="promo-hub-sections">
      {sections.map((section, i) => {
        const key = section._id ?? `section-${i}`;
        switch (section.type) {
          case "hero":
            return <HeroSection key={key} section={section} />;
          case "race_calendar":
            return <RaceCalendarSection key={key} section={section} />;
          case "featured_races":
            return <FeaturedRacesSection key={key} section={section} />;
          case "promo_banner":
            return <PromoBannerSection key={key} section={section} />;
          case "cta_buttons":
            return <CtaButtonsSection key={key} section={section} />;
          case "sponsors":
            return <SponsorsSection key={key} section={section} />;
          case "stats":
            return <StatsSection key={key} section={section} />;
          case "rich_text":
            return <RichTextSection key={key} section={section} />;
          case "recent_results":
            return <RecentResultsSection key={key} section={section} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
