/**
 * FEATURE-027 — Promo Banner section (full-width clickable image).
 *
 * Config: { imageUrl, linkUrl, alt }
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type PromoBannerConfig = {
  imageUrl?: string;
  linkUrl?: string;
  alt?: string;
};

export function PromoBannerSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as PromoBannerConfig;
  if (!c.imageUrl) return null;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={encodeURI(c.imageUrl)}
      alt={c.alt ?? ""}
      className="block w-full"
      loading="lazy"
    />
  );

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.linkUrl ? (
          <a
            href={c.linkUrl}
            target={c.linkUrl.startsWith("http") ? "_blank" : undefined}
            rel={c.linkUrl.startsWith("http") ? "noopener noreferrer" : undefined}
            data-promo-cta
            data-promo-section-id={section._id}
            data-promo-cta-label={c.alt ?? "promo-banner"}
            data-promo-cta-url={c.linkUrl}
            className="block overflow-hidden rounded-2xl shadow-md transition-shadow hover:shadow-xl"
          >
            {img}
          </a>
        ) : (
          <div className="block overflow-hidden rounded-2xl shadow-md">{img}</div>
        )}
      </div>
    </section>
  );
}
