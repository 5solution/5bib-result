"use client";

/**
 * F-062 Wave 3-1 NEW — Shared filter bar for Analytics Dashboard layout.
 *
 * BR-SA-13/14/14b v3 — Header bar combines 3 NEW Wave 1 components:
 *   GranularityToggle → PeriodSelector → CompareSelector
 *
 * State managed via URL searchParams (next/navigation) so:
 *   - Filter persists across tab navigation (BR-SA-13 mandate)
 *   - Deep-linkable / shareable URLs
 *   - SSR-compatible (each page reads searchParams independently)
 *
 * Pages read filter context via `useSearchParams()`. Convention:
 *   ?granularity=daily|weekly|monthly
 *   ?period=7d|30d|quarter|year|rolling12m|custom
 *   ?compare=none|prev|wow|mom|yoy
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD (when period=custom)
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { GranularityToggle } from "./GranularityToggle";
import { PeriodSelector } from "./PeriodSelector";
import { CompareSelector } from "./CompareSelector";
import type {
  GranularityKind,
  PeriodKind,
  CompareKind,
} from "@/lib/analytics-labels";

export function AnalyticsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const granularity = (searchParams.get("granularity") as GranularityKind) || "daily";
  const period = (searchParams.get("period") as PeriodKind) || "30d";
  const compare = (searchParams.get("compare") as CompareKind) || "mom";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <GranularityToggle
        value={granularity}
        onChange={(v) => updateParam("granularity", v)}
      />
      <PeriodSelector
        value={period}
        onChange={(v) => updateParam("period", v)}
        customFrom={from ?? ""}
        customTo={to ?? ""}
        onCustomRangeChange={(f, t) => {
          const params = new URLSearchParams(searchParams.toString());
          if (f) params.set("from", f);
          else params.delete("from");
          if (t) params.set("to", t);
          else params.delete("to");
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }}
      />
      <CompareSelector
        value={compare}
        onChange={(v) => updateParam("compare", v)}
      />
    </div>
  );
}
