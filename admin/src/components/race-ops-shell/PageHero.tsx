/**
 * F-007 BR-AF-11/12/13 — Page hero pattern with 3 variants.
 *
 *   pink     → Readiness pre-race (pink gradient bg)
 *   white    → Default neutral (Overview/Course Map/Result Kiosk/Athletes/Results/Settings)
 *   red-live → Command Center while race.status === 'live' (red top accent border 4px)
 *
 * Server Component — pure presentation.
 */

import { ReactNode } from "react";

export type PageHeroVariant = "pink" | "white" | "red-live";

export interface PageHeroProps {
  variant?: PageHeroVariant;
  eyebrow: string;
  title: string;
  meta?: string;
  action?: ReactNode;
}

function variantClasses(variant: PageHeroVariant): { wrapper: string; accent?: ReactNode } {
  switch (variant) {
    case "pink":
      return {
        wrapper:
          "relative overflow-hidden rounded-2xl border border-pink-100 bg-[linear-gradient(135deg,#fce7f3_0%,#fff_70%)] px-6 py-8 sm:px-10 sm:py-10",
      };
    case "red-live":
      return {
        wrapper:
          "relative overflow-hidden rounded-2xl border border-stone-200 bg-white px-6 py-8 sm:px-10 sm:py-10",
        accent: (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[#FF0E65]"
          />
        ),
      };
    case "white":
    default:
      return {
        wrapper:
          "relative overflow-hidden rounded-2xl border border-stone-200 bg-white px-6 py-8 sm:px-10 sm:py-10",
      };
  }
}

export function PageHero({
  variant = "white",
  eyebrow,
  title,
  meta,
  action,
}: PageHeroProps) {
  const { wrapper, accent } = variantClasses(variant);
  return (
    <header className={wrapper}>
      {accent}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            {eyebrow}
          </p>
          <h1 className="mt-2 truncate font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-[32px]">
            {title}
          </h1>
          {meta ? (
            <p className="mt-1 text-sm text-stone-500">{meta}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}
