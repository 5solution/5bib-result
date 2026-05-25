/**
 * F-062 Wave 3-1 NEW — Shared Analytics Dashboard layout.
 *
 * BR-SA-12 v3 — Multi-tab architecture (5 sub-tab):
 *   - Page heading + brief description
 *   - AnalyticsTabsNav (horizontal tabs, preserves URL searchParams)
 *   - AnalyticsFilterBar (granularity + period + compare — URL-driven)
 *   - {children} from each sub-route (page.tsx)
 *
 * Wave 3-2/3 sẽ refactor children to consume filter context from URL + wire 17
 * NEW Wave 2 backend endpoints via generated SDK.
 */

import { Suspense } from "react";
import { AnalyticsTabsNav } from "./components/AnalyticsTabsNav";
import { AnalyticsFilterBar } from "./components/AnalyticsFilterBar";

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h1
          className="text-2xl font-bold tracking-tight text-stone-900"
          style={{ fontFamily: "var(--font-display, inherit)" }}
        >
          Sales Analytics
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Dashboard tổng hợp doanh thu, hiệu suất race, merchant, runner và funnel —
          F-062 BR-SA v3 (5 sub-tab + filter context persists across tab nav).
        </p>
      </header>

      <Suspense fallback={<div className="h-10 animate-pulse bg-stone-100 rounded" />}>
        <AnalyticsTabsNav />
      </Suspense>

      <Suspense fallback={<div className="h-12 animate-pulse bg-stone-100 rounded" />}>
        <AnalyticsFilterBar />
      </Suspense>

      <div>{children}</div>
    </div>
  );
}
