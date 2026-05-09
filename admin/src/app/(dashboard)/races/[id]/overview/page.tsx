"use client";

/**
 * F-007 — `/races/[id]/overview` resolves to the same view as `/races/[id]`.
 *
 * Per PAUSE-MGR-01 the root page.tsx already renders Overview content directly
 * (no redirect flash). This page simply forwards to root so that bookmarks /
 * shared links explicitly using the `/overview` segment land on the same view.
 */

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewAliasPage() {
  const params = useParams();
  const router = useRouter();
  const raceId = String((params as { id?: string }).id ?? "");

  useEffect(() => {
    if (raceId) router.replace(`/races/${raceId}`);
  }, [raceId, router]);

  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
