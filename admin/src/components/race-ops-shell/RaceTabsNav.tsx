"use client";

/**
 * F-007 BR-AF-01/02/04/05/17/18/26/27 — 8-tab race-ops navigation.
 *
 * Locked tab order (BR-AF-01):
 *   Overview / Readiness / Course Map / Command Center / Result Kiosk /
 *   Athletes / Results / Settings
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
  { key: "athletes", segment: "athletes", label: "Athletes", tooltip: "Vận động viên", enabledIn: ["pre_race", "live", "ended"] },
  { key: "results", segment: "results", label: "Results", tooltip: "Kết quả", enabledIn: ["ended"] },
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
