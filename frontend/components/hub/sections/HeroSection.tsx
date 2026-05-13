/**
 * FEATURE-027 — Hero section (full-bleed hero w/ bg image + CTA).
 *
 * Config shape: { title, subtitle, backgroundImage, ctaLabel, ctaUrl, align }
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type HeroConfig = {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  align?: "left" | "center" | "right";
};

export function HeroSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as HeroConfig;
  const alignCls =
    c.align === "left" ? "items-start text-left" : c.align === "right" ? "items-end text-right" : "items-center text-center";

  return (
    <section
      className={`relative flex min-h-[60vh] flex-col justify-center px-6 py-20 ${alignCls}`}
      style={
        c.backgroundImage
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.65)), url(${encodeURI(c.backgroundImage)})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              color: "white",
            }
          : { background: "linear-gradient(135deg, var(--promo-primary), var(--promo-secondary))", color: "white" }
      }
    >
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)] w-full">
        {c.title && (
          <h1
            className="font-[var(--promo-font)] text-4xl font-black tracking-tight md:text-6xl"
          >
            {c.title}
          </h1>
        )}
        {c.subtitle && (
          <p className="mt-4 max-w-2xl text-base font-medium opacity-90 md:text-lg">
            {c.subtitle}
          </p>
        )}
        {c.ctaLabel && c.ctaUrl && (
          <div className="mt-8">
            <a
              href={c.ctaUrl}
              target={c.ctaUrl.startsWith("http") ? "_blank" : undefined}
              rel={c.ctaUrl.startsWith("http") ? "noopener noreferrer" : undefined}
              data-promo-cta
              data-promo-section-id={section._id}
              data-promo-cta-label={c.ctaLabel}
              data-promo-cta-url={c.ctaUrl}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-black transition-transform hover:scale-105"
            >
              {c.ctaLabel}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
