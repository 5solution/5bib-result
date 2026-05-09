"use client";

/**
 * F-007 — Race-ops shell layout.
 *
 * Wraps every nested race page with:
 *   - Sticky RaceOpsHeader (breadcrumb + RACE LIVE timer + 8-tab nav)
 *   - Race-scoped content area
 *
 * Architectural fidelity gate (PRD §8.5): 8 tabs ordered match canvas, with
 * Course Map / Command Center as TOP-LEVEL race-ops tabs (placeholders are OK).
 *
 * Client component because the existing race detail SDK pipeline is browser-only
 * (`/api/[...proxy]` proxies the auth header at runtime).
 */

import { ReactNode, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { racesControllerGetRaceById } from "@/lib/api-generated";
import { RaceOpsHeader } from "@/components/race-ops-shell/RaceOpsHeader";
import { Skeleton } from "@/components/ui/skeleton";
import type { RaceState } from "@/components/race-ops-shell/RaceTabsNav";

interface RaceMeta {
  _id: string;
  title: string;
  status: RaceState;
  startedAt?: string | null;
  scheduledStartAt?: string | null;
  endedAt?: string | null;
  startDate?: string | null;
}

export default function RaceOpsLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? "");
  const { token } = useAuth();

  const [race, setRace] = useState<RaceMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token || !raceId) return;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await racesControllerGetRaceById({
          path: { id: raceId },
          ...authHeaders(token),
        });
        if (error) throw new Error("Race not found");
        const body = data as { data?: RaceMeta } | RaceMeta;
        const raceData = ((body as { data?: RaceMeta })?.data ?? (body as RaceMeta)) as RaceMeta;
        if (!cancelled) setRace(raceData);
      } catch {
        if (!cancelled) setRace(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, raceId]);

  return (
    <div className="flex min-h-screen flex-col bg-stone-50/40">
      {race ? (
        <RaceOpsHeader race={race} />
      ) : (
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 pb-3 pt-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            <div className="flex gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-md" />
              ))}
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {loading && !race ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
