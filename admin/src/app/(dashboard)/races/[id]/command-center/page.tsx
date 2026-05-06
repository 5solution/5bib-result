"use client";

/**
 * F-007 placeholder — Command Center tab (Canvas 03). Full impl ships in F-008
 * (Health Matrix + 6 cards + Export CSV).
 *
 * Transition: BR-AF-21 — old `/timing-alerts/cockpit` route 301-redirects here
 * via middleware.ts (30-day deprecation). Until F-008 lands the placeholder
 * deep-links to the existing F-005 sub-page tree.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { racesControllerGetRaceById } from "@/lib/api-generated";
import { PageHero } from "@/components/race-ops-shell/PageHero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

interface RaceMeta {
  title: string;
  status: "draft" | "pre_race" | "live" | "ended";
}

export default function CommandCenterPlaceholder() {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? "");
  const { token } = useAuth();
  const [race, setRace] = useState<RaceMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token || !raceId) return;
    (async () => {
      try {
        const { data } = await racesControllerGetRaceById({
          path: { id: raceId },
          ...authHeaders(token),
        });
        const body = data as { data?: RaceMeta } | RaceMeta;
        const r = (body as { data?: RaceMeta })?.data ?? (body as RaceMeta);
        if (!cancelled && r) setRace(r);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, raceId]);

  const variant = race?.status === "live" ? "red-live" : "white";

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        variant={variant}
        eyebrow="RACE · COMMAND CENTER"
        title={race?.title || "..."}
        meta={race?.status === "live" ? "RACE LIVE — Operations cockpit" : "Race-day operations cockpit"}
      />
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-10">
          {!race ? <Skeleton className="h-5 w-48" /> : null}
          <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600">
            F-008 · Sprint sắp tới
          </span>
          <h2 className="font-display text-xl font-bold text-stone-900">Coming soon — Command Center refactor</h2>
          <p className="max-w-prose text-sm text-stone-600">
            Theo Canvas 03: Health Matrix toàn checkpoint, 6 summary card có throughput sparkline,
            Athlete Flow, Live Leaderboard, Timing Alerts feed, Export CSV full data. Đến khi F-008
            ship, dùng F-005 sub-page tree hiện tại.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link href={`/races/${raceId}/timing-alerts/cockpit`}>
              <Button size="sm" variant="outline">
                Tới F-005 cockpit
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </Link>
            <Link href={`/races/${raceId}/timing-alerts/alerts`}>
              <Button size="sm" variant="outline">
                Alerts feed
              </Button>
            </Link>
            <Link href={`/races/${raceId}/timing-alerts/podium`}>
              <Button size="sm" variant="outline">
                Podium
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
