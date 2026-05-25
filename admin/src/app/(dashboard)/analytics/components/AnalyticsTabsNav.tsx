"use client";

/**
 * F-062 Wave 3-1 NEW — Multi-tab horizontal navigation for Sales Analytics Dashboard.
 *
 * BR-SA-12 v3 — 5 sub-tab architecture:
 *   - /analytics            → Tổng quan
 *   - /analytics/races      → Hiệu suất Race
 *   - /analytics/merchants  → Merchant
 *   - /analytics/runners    → Runner
 *   - /analytics/funnel     → Funnel
 *
 * Preserves URL search params (period/granularity/compare/from/to) across tab nav
 * — BR-SA-13 Manager Adjustment #3 mandate (filter context persists).
 */

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

const TABS: Array<{ href: string; label: string }> = [
  { href: "/analytics", label: "Tổng quan" },
  { href: "/analytics/races", label: "Hiệu suất Race" },
  { href: "/analytics/merchants", label: "Merchant" },
  { href: "/analytics/runners", label: "Runner" },
  { href: "/analytics/funnel", label: "Funnel" },
];

export function AnalyticsTabsNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <nav
      role="tablist"
      aria-label="Analytics dashboard tabs"
      className="flex items-center gap-1 border-b border-stone-200 overflow-x-auto scrollbar-hide"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={`${t.href}${suffix}`}
            role="tab"
            aria-selected={active}
            className={`
              relative px-4 py-3 text-sm font-medium whitespace-nowrap
              transition-colors
              ${
                active
                  ? "text-blue-700 border-b-2 border-blue-700 -mb-px"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
              }
            `}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
