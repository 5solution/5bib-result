/**
 * FEATURE-027 Phase B — Form Embed section.
 *
 * Config: { title, description, provider ('iframe'|'link'), embedUrl }
 *
 * 2 modes:
 *   - iframe — nhúng Google Form / Tally / external form
 *   - link — CTA button mở form external (an toàn hơn iframe khi không trust)
 *
 * Whitelist iframe hosts cho security defense.
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type FormEmbedConfig = {
  title?: string;
  description?: string;
  provider?: "iframe" | "link";
  embedUrl?: string;
};

const ALLOWED_FORM_HOSTS = [
  "docs.google.com",
  "forms.gle",
  "tally.so",
  "form.5bib.com",
  "forms.office.com",
];

function isSafeFormUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ALLOWED_FORM_HOSTS.includes(u.host) && u.protocol === "https:";
  } catch {
    return false;
  }
}

export function FormEmbedSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as FormEmbedConfig;
  if (!c.embedUrl) return null;
  const provider = c.provider ?? "iframe";

  return (
    <section className="bg-stone-50 px-6 py-14">
      <div className="mx-auto max-w-[min(var(--promo-max-width,1200px),720px)] text-center">
        {c.title && (
          <h2 className="font-[var(--promo-font)] text-2xl font-bold tracking-tight md:text-3xl">
            {c.title}
          </h2>
        )}
        {c.description && (
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            {c.description}
          </p>
        )}
        <div className="mt-8">
          {provider === "iframe" && isSafeFormUrl(c.embedUrl) ? (
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <iframe
                src={c.embedUrl}
                title={c.title || "Form"}
                className="block min-h-[500px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <a
              href={c.embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-promo-cta
              data-promo-section-id={section._id}
              data-promo-cta-label={c.title ?? "Mở form"}
              data-promo-cta-url={c.embedUrl}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--promo-primary)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
            >
              {c.title || "Mở form đăng ký"}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
