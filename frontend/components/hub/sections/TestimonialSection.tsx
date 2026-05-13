/**
 * FEATURE-027 Phase B — Testimonial section.
 *
 * Config: { title, items: [{ quote, author, role, avatarUrl }] }
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type TestimonialConfig = {
  title?: string;
  items?: Array<{
    quote: string;
    author: string;
    role?: string;
    avatarUrl?: string;
  }>;
};

export function TestimonialSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as TestimonialConfig;
  const items = (c.items ?? []).filter((it) => it.quote);
  if (items.length === 0) return null;
  const cols = items.length === 1 ? "max-w-2xl mx-auto" : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="bg-stone-50 px-6 py-16">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.title && (
          <h2 className="mb-10 text-center font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {c.title}
          </h2>
        )}
        <div className={`grid gap-6 ${items.length === 1 ? "" : cols}`}>
          {items.map((it, i) => (
            <figure
              key={i}
              className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
            >
              <div className="text-[var(--promo-primary)]">
                <svg viewBox="0 0 32 32" className="size-8" fill="currentColor" aria-hidden>
                  <path d="M9.352 4C4.456 7.456 1 13.12 1 20.696c0 4.296 2.32 6.84 5.024 6.84 2.768 0 4.872-2.272 4.872-5.04 0-2.704-1.84-4.72-4.328-4.72-.464 0-1.064.08-1.224.16.4-2.72 2.984-6.072 5.624-7.832L9.352 4zm17.16 0C21.616 7.456 18.16 13.12 18.16 20.696c0 4.296 2.32 6.84 5.024 6.84 2.768 0 4.872-2.272 4.872-5.04 0-2.704-1.84-4.72-4.328-4.72-.464 0-1.064.08-1.224.16.4-2.72 2.984-6.072 5.624-7.832L26.512 4z" />
                </svg>
              </div>
              <blockquote className="flex-1 text-base italic leading-relaxed text-stone-700">
                {it.quote}
              </blockquote>
              <figcaption className="flex items-center gap-3 border-t pt-4">
                {it.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={encodeURI(it.avatarUrl)}
                    alt={it.author}
                    className="size-10 rounded-full bg-stone-200 object-cover"
                  />
                ) : (
                  <div className="grid size-10 place-items-center rounded-full bg-stone-200 font-bold text-stone-600">
                    {it.author?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div>
                  <div className="font-semibold">{it.author}</div>
                  {it.role && (
                    <div className="text-xs text-stone-500">{it.role}</div>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
