/**
 * F-007 — Race-ops shell sticky header.
 *
 * Composition:
 *   [Breadcrumb (Races > {race.title})]   [RaceLiveTimer]
 *   [RaceTabsNav (8 tabs)]
 *
 * Renders inside the per-race layout.tsx; the parent dashboard sidebar/topbar
 * remain untouched.
 */

import { Breadcrumb } from "./Breadcrumb";
import { RaceLiveTimer, type RaceTimerInput } from "./RaceLiveTimer";
import { RaceTabsNav, type RaceState, type RaceTabsBadges } from "./RaceTabsNav";

export interface RaceOpsHeaderProps {
  race: {
    _id: string;
    title: string;
    status: RaceState;
    startedAt?: string | null;
    scheduledStartAt?: string | null;
    endedAt?: string | null;
    startDate?: string | null;
  };
  badges?: RaceTabsBadges;
}

export function RaceOpsHeader({ race, badges }: RaceOpsHeaderProps) {
  const timerInput: RaceTimerInput = {
    status: race.status,
    startedAt: race.startedAt,
    // Fall back to startDate if no scheduledStartAt (most existing races).
    scheduledStartAt: race.scheduledStartAt ?? race.startDate ?? null,
    endedAt: race.endedAt,
  };

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 pb-0 pt-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Breadcrumb
            items={[
              { label: "Races", href: "/races" },
              { label: race.title },
            ]}
          />
          <RaceLiveTimer race={timerInput} />
        </div>
        <RaceTabsNav raceId={race._id} raceStatus={race.status} badges={badges} />
      </div>
    </header>
  );
}
