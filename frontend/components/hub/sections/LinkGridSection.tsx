/**
 * FEATURE-027 Phase B — Link Grid section.
 *
 * Config: { title, columns, items: [{ imageUrl, title, url }] }
 * Use case: product showcase / shop link grid / external resource grid.
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type LinkGridConfig = {
  title?: string;
  columns?: number;
  items?: Array<{ imageUrl: string; title: string; url: string }>;
};

const colsClass: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 md:grid-cols-3",
  4: "sm:grid-cols-2 md:grid-cols-4",
};

export function LinkGridSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as LinkGridConfig;
  const items = (c.items ?? []).filter((i) => i.url || i.imageUrl || i.title);
  if (items.length === 0) return null;
  const cols = colsClass[c.columns ?? 3] ?? colsClass[3];

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.title && (
          <h2 className="mb-8 font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {c.title}
          </h2>
        )}
        <div className={`grid gap-4 ${cols}`}>
          {items.map((it, i) => (
            <a
              key={i}
              href={it.url || "#"}
              target={it.url?.startsWith("http") ? "_blank" : undefined}
              rel={it.url?.startsWith("http") ? "noopener noreferrer" : undefined}
              data-promo-cta
              data-promo-section-id={section._id}
              data-promo-cta-label={it.title}
              data-promo-cta-url={it.url}
              className="group block overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              {it.imageUrl && (
                <div
                  className="aspect-square bg-stone-200 bg-cover bg-center"
                  style={{ backgroundImage: `url(${encodeURI(it.imageUrl)})` }}
                />
              )}
              {it.title && (
                <div className="p-3">
                  <div className="text-sm font-semibold transition-colors group-hover:text-[var(--promo-primary)]">
                    {it.title}
                  </div>
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
