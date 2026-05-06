"use client";

/**
 * F-007 — Race detail root = Overview tab content (PAUSE-MGR-01).
 *
 * Renders Overview directly at `/races/[id]` (no redirect flash). The legacy
 * 6-tab race detail editor (Thông tin / Cự ly / Branding / Features / Sponsors /
 * Certificates) has moved to `/races/[id]/settings/page.tsx` per BR-AF-23.
 *
 * Future F-014 will redesign Settings shape; F-007 simply preserves byte-for-byte
 * the existing surface so BTC config flows keep working through the transition.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { racesControllerGetRaceById } from "@/lib/api-generated";
import { PageHero } from "@/components/race-ops-shell/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Pencil, Settings as SettingsIcon, Activity } from "lucide-react";

interface OverviewRace {
  _id: string;
  title: string;
  slug: string;
  status: "draft" | "pre_race" | "live" | "ended";
  province?: string;
  location?: string;
  organizer?: string;
  startDate?: string;
  endDate?: string;
  raceType?: string;
  courses?: Array<{ courseId: string; name: string; distance?: string }>;
}

const STATUS_LABEL: Record<OverviewRace["status"], string> = {
  draft: "Nháp",
  pre_race: "Chuẩn bị",
  live: "Đang diễn ra",
  ended: "Đã kết thúc",
};

const STATUS_TONE: Record<OverviewRace["status"], string> = {
  draft: "bg-yellow-100 text-yellow-800 ring-yellow-200",
  pre_race: "bg-blue-100 text-blue-800 ring-blue-200",
  live: "bg-green-100 text-green-800 ring-green-200",
  ended: "bg-stone-200 text-stone-700 ring-stone-300",
};

export default function RaceOverviewPage() {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? "");
  const { token } = useAuth();
  const [race, setRace] = useState<OverviewRace | null>(null);
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
        const body = data as { data?: OverviewRace } | OverviewRace;
        const raceData = ((body as { data?: OverviewRace })?.data ?? (body as OverviewRace)) as OverviewRace;
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

  if (loading || !race) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        variant="white"
        eyebrow="RACE · OVERVIEW"
        title={race.title}
        meta={[race.province, race.location, race.organizer].filter(Boolean).join(" · ") || undefined}
        action={
          <>
            <Link href={`/races/${race._id}/settings`}>
              <Button variant="outline" size="sm">
                <SettingsIcon className="mr-1.5 size-4" />
                Settings
              </Button>
            </Link>
            <Link href={`/races/${race._id}/command-center`}>
              <Button size="sm" className="bg-[#FF0E65] text-white hover:bg-[#d9094f]">
                <Activity className="mr-1.5 size-4" />
                Command Center
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Trạng thái
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${STATUS_TONE[race.status]}`}
            >
              {STATUS_LABEL[race.status]}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Cự ly
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-stone-900">
              {race.courses?.length ?? 0}
            </p>
            <p className="text-xs text-stone-500">course{(race.courses?.length ?? 0) === 1 ? "" : "s"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Loại giải
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-semibold text-stone-900">{race.raceType ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Slug
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate font-mono text-sm text-stone-700" title={race.slug}>
              {race.slug}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liên kết nhanh</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href={`/races/${race._id}/settings`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1.5 size-4" />
              Chỉnh sửa cấu hình
            </Button>
          </Link>
          <Link href={`/races/${race._id}/master-data`}>
            <Button variant="outline" size="sm">
              Master Data
            </Button>
          </Link>
          <Link href={`/races/${race._id}/chip-mappings`}>
            <Button variant="outline" size="sm">
              Chip Verify
            </Button>
          </Link>
          <Link href={`/races/${race._id}/results`}>
            <Button variant="outline" size="sm">
              Sửa kết quả
            </Button>
          </Link>
        </CardContent>
      </Card>

      {race.courses && race.courses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cự ly</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {race.courses.map((c) => (
              <span
                key={c.courseId}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-sm text-stone-700"
              >
                <span className="font-semibold">{c.distance ?? c.courseId}</span>
                <span className="text-stone-500">{c.name}</span>
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
