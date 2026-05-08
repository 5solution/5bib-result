"use client";

/**
 * F-007 BR-AF-01/02/04/05/17/18/26/27 — race-ops navigation.
 *
 * F-008 v2 BR-CC2-33 EXTEND: 8 → 9 tabs. Awards (Trao giải) inserted slot 6
 * between Result Kiosk and Athletes ("post-race output" group). Manager
 * partial-unlock pre-approved per 02-manager-plan.md.
 *
 * F-015 EXTEND: 9 → 10 tabs. Check-In Kiosk inserted before Settings.
 * BREAKS F-008v2's 8-tab lock — sets Cluster #9 precedent (Manager Plan §4
 * LOCKED). "More" dropdown refactor when shell >12 tabs (Danny policy A).
 *
 * Locked tab order:
 *   Overview / Readiness / Course Map / Command Center / Result Kiosk /
 *   Trao giải / Athletes / Results / Check-In / Settings
 *
 * - English labels match canvas (BR-AF-02). Vietnamese tooltip via title attr.
 * - Disabled matrix per race state (BR-AF-04). Disabled tab renders gray + cursor-not-allowed.
 * - Active tab indicator dot (BR-AF-17): Command Center red when live, Readiness amber when fail>0,
 *   Result Kiosk blue when unverified>0.
 * - Tab badge (BR-AF-18): Readiness "{N} fail" pill.
 * - Mobile (BR-AF-26): horizontal scroll < 768px with right-edge fade.
 * - Touch target 44px min (BR-AF-27).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type RaceState = "draft" | "pre_race" | "live" | "ended";

export interface RaceTabsBadges {
  /** Readiness automated/manual checks failing (drives amber dot + "{n} fail" pill). */
  readinessFailCount?: number;
  /** Result Kiosk unverified results count (drives blue dot). */
  kioskUnverifiedCount?: number;
  /** F-015 BR-CK pickup completion ratio (0..1). Drives blue dot when 0 < rate < 1. */
  checkInPickupRate?: number;
}

export interface RaceTabsNavProps {
  raceId: string;
  raceStatus: RaceState;
  badges?: RaceTabsBadges;
}

interface TabSpec {
  key: string;
  segment: string;
  label: string;
  /** Vietnamese tooltip fallback (BR-AF-02). */
  tooltip: string;
  /** States in which tab is enabled (BR-AF-04). */
  enabledIn: ReadonlyArray<RaceState>;
}

const TABS: ReadonlyArray<TabSpec> = [
  { key: "overview", segment: "overview", label: "Overview", tooltip: "Tổng quan", enabledIn: ["draft", "pre_race", "live", "ended"] },
  { key: "readiness", segment: "readiness", label: "Readiness", tooltip: "Sẵn sàng", enabledIn: ["draft", "pre_race", "live", "ended"] },
  { key: "course-map", segment: "course-map", label: "Course Map", tooltip: "Bản đồ đường đua", enabledIn: ["draft", "pre_race", "live", "ended"] },
  { key: "command-center", segment: "command-center", label: "Command Center", tooltip: "Trung tâm điều hành", enabledIn: ["pre_race", "live", "ended"] },
  { key: "result-kiosk", segment: "result-kiosk", label: "Result Kiosk", tooltip: "Kiosk kết quả", enabledIn: ["live", "ended"] },
  // F-008 v2 BR-CC2-33 — Awards (Trao giải) slot 6, post-race output group.
  // Awards data depends on finishers, so enable only when race has gone live.
  { key: "awards", segment: "awards", label: "Trao giải", tooltip: "Trao giải / Top finishers", enabledIn: ["live", "ended"] },
  { key: "athletes", segment: "athletes", label: "Athletes", tooltip: "Vận động viên", enabledIn: ["pre_race", "live", "ended"] },
  { key: "results", segment: "results", label: "Results", tooltip: "Kết quả", enabledIn: ["ended"] },
  // F-015 Check-In Kiosk REMOVED 2026-05-08 — duplicate of ORG.5bib.com pickup module.
  // Restored to 9-tab shell (post F-008v2).
  { key: "settings", segment: "settings", label: "Settings", tooltip: "Cài đặt", enabledIn: ["draft", "pre_race", "live", "ended"] },
] as const;

interface DotSpec {
  color: string;
  label: string;
}

function dotFor(tabKey: string, raceStatus: RaceState, badges?: RaceTabsBadges): DotSpec | null {
  if (tabKey === "command-center" && raceStatus === "live") {
    return { color: "bg-[#FF0E65]", label: "Race is live" };
  }
  if (tabKey === "readiness" && (badges?.readinessFailCount ?? 0) > 0) {
    return { color: "bg-amber-500", label: `${badges?.readinessFailCount} readiness fail` };
  }
  if (tabKey === "result-kiosk" && (badges?.kioskUnverifiedCount ?? 0) > 0) {
    return { color: "bg-blue-600", label: `${badges?.kioskUnverifiedCount} unverified results` };
  }
  // F-015 check-in dot REMOVED 2026-05-08 — Check-In Kiosk feature scrapped.
  return null;
}

export function RaceTabsNav({ raceId, raceStatus, badges }: RaceTabsNavProps) {
  const pathname = usePathname() ?? "";

  return (
    <div
      role="tablist"
      aria-label="Race tabs"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0"
    >
      {TABS.map((tab) => {
        const enabled = tab.enabledIn.includes(raceStatus);
        const href = `/races/${raceId}/${tab.segment}`;
        const isActive =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          // Root /races/[id] aliases Overview (PAUSE-MGR-01).
          (tab.segment === "overview" && pathname === `/races/${raceId}`);

        const dot = dotFor(tab.key, raceStatus, badges);
        const showFailBadge =
          tab.key === "readiness" && (badges?.readinessFailCount ?? 0) > 0;

        const baseClass = cn(
          "group relative inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "border-[#FF0E65] text-stone-900"
            : "border-transparent text-stone-600 hover:text-stone-900",
          !enabled && "cursor-not-allowed text-stone-400 hover:text-stone-400",
        );

        if (!enabled) {
          return (
            <span
              key={tab.key}
              role="tab"
              aria-disabled
              aria-selected={false}
              className={baseClass}
              title={`${tab.tooltip} — Available when race is later than '${raceStatus}'`}
            >
              <span>{tab.label}</span>
            </span>
          );
        }

        return (
          <Link
            key={tab.key}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={baseClass}
            title={tab.tooltip}
          >
            <span>{tab.label}</span>
            {dot ? (
              <span
                aria-label={dot.label}
                className={cn("size-1.5 rounded-full", dot.color)}
              />
            ) : null}
            {showFailBadge ? (
              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-rose-700">
                {badges?.readinessFailCount} fail
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export const __RACE_OPS_TABS = TABS;
