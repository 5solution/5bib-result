"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { dashboardControllerGetLiveRaces } from "@/lib/dashboard-sdk-shim";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle } from "lucide-react";

/**
 * F-023 BR-DASH-06/07/08/09 — Live Races highlight.
 *
 * - Magenta dot pulsing (live indicator).
 * - 1 race → full-width, ≥2 → grid 2 cột wrap.
 * - hasCriticalAlert → border đỏ + dot pulse nhanh hơn.
 * - Click "Mở Command Center" → `/races/:id/command-center`.
 */
type LiveRace = {
  raceId: string;
  title: string;
  slug?: string;
  province?: string;
  activeCourseName?: string;
  progressPercent: number;
  runnersOnCourse: number;
  alertsCount: number;
  hasCriticalAlert: boolean;
};

export function LiveRacesSection() {
  const { token } = useAuth();
  const router = useRouter();
  const [races, setRaces] = useState<LiveRace[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    async function load() {
      setLoading(true);
      try {
        const res = await dashboardControllerGetLiveRaces({
          ...authHeaders(token),
        });
        const payload = res.data as unknown as { races?: LiveRace[] };
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
    return <Skeleton className="h-32 w-full" />;
  }

  if (!races || races.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-stone-500">
          Không có giải đang diễn ra
        </CardContent>
      </Card>
    );
  }

  const gridClass =
    races.length === 1 ? "grid grid-cols-1 gap-4" : "grid gap-4 lg:grid-cols-2";

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="relative inline-flex size-2 items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-pink-500 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-pink-600" />
        </span>
        <h2 className="font-display text-lg font-semibold text-stone-900">
          Đang diễn ra
        </h2>
        <span className="text-xs text-stone-500">
          ({races.length} giải)
        </span>
      </div>
      <div className={gridClass}>
        {races.map((r) => (
          <Card
            key={r.raceId}
            className={
              r.hasCriticalAlert
                ? "border-rose-400 ring-1 ring-rose-200"
                : "border-stone-200"
            }
          >
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-base font-semibold text-stone-900">
                    {r.title}
                  </h3>
                  {r.activeCourseName ? (
                    <p className="text-xs text-stone-500">
                      Cự ly: {r.activeCourseName}
                      {r.province ? ` · ${r.province}` : null}
                    </p>
                  ) : null}
                </div>
                {r.hasCriticalAlert ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    <AlertTriangle className="size-3" />
                    {r.alertsCount}
                  </span>
                ) : null}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-stone-600">
                  <span>Tiến độ checkpoint</span>
                  <span className="font-mono tabular-nums">
                    {r.progressPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${Math.min(100, r.progressPercent)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600">
                  VĐV trên course:{" "}
                  <span className="font-mono font-semibold tabular-nums text-stone-900">
                    {r.runnersOnCourse}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    router.push(`/races/${r.raceId}/command-center`)
                  }
                >
                  Mở Command Center
                  <ArrowRight className="ml-1 size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
