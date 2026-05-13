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
// Phase B — landing-page expansion (10)
import { LinkGridSection } from "./sections/LinkGridSection";
import { SocialLinksSection } from "./sections/SocialLinksSection";
import { FaqSection } from "./sections/FaqSection";
import { CountdownSection } from "./sections/CountdownSection";
import { VideoEmbedSection } from "./sections/VideoEmbedSection";
import { ImageGallerySection } from "./sections/ImageGallerySection";
import { TestimonialSection } from "./sections/TestimonialSection";
import { MapEmbedSection } from "./sections/MapEmbedSection";
import { ScheduleTimelineSection } from "./sections/ScheduleTimelineSection";
import { FormEmbedSection } from "./sections/FormEmbedSection";

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
          // Phase B
          case "link_grid":
            return <LinkGridSection key={key} section={section} />;
          case "social_links":
            return <SocialLinksSection key={key} section={section} />;
          case "faq":
            return <FaqSection key={key} section={section} />;
          case "countdown":
            return <CountdownSection key={key} section={section} />;
          case "video_embed":
            return <VideoEmbedSection key={key} section={section} />;
          case "image_gallery":
            return <ImageGallerySection key={key} section={section} />;
          case "testimonial":
            return <TestimonialSection key={key} section={section} />;
          case "map_embed":
            return <MapEmbedSection key={key} section={section} />;
          case "schedule_timeline":
            return <ScheduleTimelineSection key={key} section={section} />;
          case "form_embed":
            return <FormEmbedSection key={key} section={section} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
