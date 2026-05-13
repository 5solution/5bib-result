/**
 * FEATURE-027 — Stats section (3-4 number cards).
 *
 * Config: { title, items: [{ label, value }] }
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type StatsConfig = {
  title?: string;
  items?: { label: string; value: string }[];
};

export function StatsSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as StatsConfig;
  const items = c.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)] text-center">
        {c.title && (
          <h2 className="mb-10 font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {c.title}
          </h2>
        )}
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          {items.map((it, i) => (
            <div
              key={i}
              className="rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="font-mono text-4xl font-black tracking-tight text-[var(--promo-primary)] md:text-5xl">
                {it.value}
              </div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
                {it.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
