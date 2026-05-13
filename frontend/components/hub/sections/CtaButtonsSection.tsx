/**
 * FEATURE-027 — CTA Buttons section.
 *
 * Config: { title, buttons: [{ label, url, variant }] }
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type CtaButton = {
  label: string;
  url: string;
  variant?: "primary" | "secondary" | "outline";
};
type CtaButtonsConfig = {
  title?: string;
  buttons?: CtaButton[];
};

const variantClass: Record<NonNullable<CtaButton["variant"]>, string> = {
  primary:
    "bg-[var(--promo-primary)] text-white hover:opacity-90",
  secondary:
    "bg-[var(--promo-secondary)] text-white hover:opacity-90",
  outline:
    "border-2 border-[var(--promo-primary)] text-[var(--promo-primary)] hover:bg-[var(--promo-primary)] hover:text-white",
};

export function CtaButtonsSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as CtaButtonsConfig;
  const buttons = c.buttons ?? [];
  if (buttons.length === 0) return null;

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)] text-center">
        {c.title && (
          <h2 className="mb-6 font-[var(--promo-font)] text-2xl font-bold tracking-tight">
            {c.title}
          </h2>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {buttons.map((btn, i) => {
            const cls = variantClass[btn.variant ?? "primary"] ?? variantClass.primary;
            return (
              <a
                key={i}
                href={btn.url || "#"}
                target={btn.url?.startsWith("http") ? "_blank" : undefined}
                rel={btn.url?.startsWith("http") ? "noopener noreferrer" : undefined}
                data-promo-cta
                data-promo-section-id={section._id}
                data-promo-cta-label={btn.label}
                data-promo-cta-url={btn.url}
                className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all ${cls}`}
              >
                {btn.label}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
