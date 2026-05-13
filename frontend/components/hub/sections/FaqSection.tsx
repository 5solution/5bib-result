/**
 * FEATURE-027 Phase B — FAQ accordion section.
 *
 * Config: { title, items: [{ question, answer }] }
 *
 * Uses native <details>/<summary> — no JS required, full SSR + a11y.
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type FaqConfig = {
  title?: string;
  items?: Array<{ question: string; answer: string }>;
};

export function FaqSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as FaqConfig;
  const items = (c.items ?? []).filter((q) => q.question);
  if (items.length === 0) return null;

  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-[min(var(--promo-max-width,1200px),800px)]">
        {c.title && (
          <h2 className="mb-8 text-center font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {c.title}
          </h2>
        )}
        <div className="space-y-2">
          {items.map((q, i) => (
            <details
              key={i}
              className="group rounded-lg border bg-white shadow-sm transition-shadow open:shadow-md"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-left font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{q.question}</span>
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--promo-primary)] text-white transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="border-t bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">
                {q.answer.split("\n").map((line, k) => (
                  <p key={k} className="mb-2 last:mb-0">
                    {line}
                  </p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
