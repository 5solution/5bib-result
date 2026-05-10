"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { dashboardControllerGetUpcomingRaces } from "@/lib/api-generated/sdk.gen";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * F-023 BR-DASH-10/11/12 — Upcoming Races (4-6 trong 30d), grid 2 cột.
 */
type UpcomingRace = {
  raceId: string;
  title: string;
  slug?: string;
  province?: string;
  startDate?: string;
  daysRemaining?: number;
  athleteCount: number;
  readinessPercent: number | null;
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function UpcomingRacesList() {
  const { token } = useAuth();
  const router = useRouter();
  const [races, setRaces] = useState<UpcomingRace[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    async function load() {
      try {
        const res = await dashboardControllerGetUpcomingRaces({
          ...authHeaders(token),
        });
        const payload = res.data as unknown as { races?: UpcomingRace[] };
        if (!cancelled) setRaces(payload?.races ?? []);
      } catch {
        if (!cancelled) setRaces([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!races || races.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-stone-500">
          Không có giải sắp diễn ra trong 30 ngày tới
        </CardContent>
      </Card>
    );
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-stone-900">
        Giải sắp diễn ra
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {races.map((r) => (
          <button
            key={r.raceId}
            type="button"
            onClick={() => router.push(`/races/${r.raceId}`)}
            className="group rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 font-display text-sm font-semibold text-stone-900 group-hover:text-blue-700">
                {r.title}
              </h3>
              {typeof r.daysRemaining === "number" ? (
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-mono tabular-nums text-stone-600">
                  còn {r.daysRemaining}d
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {formatDate(r.startDate)}
              {r.province ? ` · ${r.province}` : null}
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-stone-600">
              <span>
                <span className="font-mono font-semibold tabular-nums text-stone-900">
                  {r.athleteCount}
                </span>
                {" VĐV"}
              </span>
              <span>
                Sẵn sàng:{" "}
                <span className="font-mono font-semibold tabular-nums">
                  {r.readinessPercent === null
                    ? "—"
                    : `${r.readinessPercent}%`}
                </span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
