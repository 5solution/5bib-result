/**
 * FEATURE-027 Phase B — Schedule Timeline section.
 *
 * Config: { title, items: [{ time, title, description }] }
 * Use case: race day schedule (4h00 mat-bib → 5h30 line-up → 6h00 start → ...).
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type ScheduleTimelineConfig = {
  title?: string;
  items?: Array<{ time: string; title: string; description?: string }>;
};

export function ScheduleTimelineSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as ScheduleTimelineConfig;
  const items = (c.items ?? []).filter((it) => it.title || it.time);
  if (items.length === 0) return null;

  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-[min(var(--promo-max-width,1200px),800px)]">
        {c.title && (
          <h2 className="mb-8 text-center font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {c.title}
          </h2>
        )}
        <ol className="relative space-y-6 border-l-2 border-[var(--promo-primary)] pl-8">
          {items.map((it, i) => (
            <li key={i} className="relative">
              <span
                aria-hidden
                className="absolute -left-[37px] top-1.5 grid size-4 place-items-center rounded-full bg-[var(--promo-primary)] ring-4 ring-white"
              />
              {it.time && (
                <div className="font-mono text-sm font-bold text-[var(--promo-primary)]">
                  {it.time}
                </div>
              )}
              <div className="mt-0.5 text-lg font-semibold">{it.title}</div>
              {it.description && (
                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                  {it.description}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
