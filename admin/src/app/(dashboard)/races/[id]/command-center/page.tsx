'use client';

/**
 * F-008 — Command Center page (was F-007 placeholder).
 *
 * Architectural shape per BR-CC-27 LOCK:
 *   /admin/races/[id]/command-center → tab body inside F-007 8-tab race-ops
 *   shell (RaceOpsHeader + RaceLiveTimer + Breadcrumb + RaceTabsNav already
 *   global trong [id]/layout.tsx). This file ONLY renders the tab body —
 *   PageHero (variant per race.status) + CommandCenterLayout orchestrator.
 *
 * NOT modal, NOT drawer, NOT sub-page. NO chrome re-implementation.
 *
 * Per BR-CC-22 — PageHero variant `red-live` khi race.status === 'live',
 * else `white`. Race meta fetched via existing SDK racesControllerGetRaceById.
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { PageHero } from '@/components/race-ops-shell/PageHero';
import { Skeleton } from '@/components/ui/skeleton';
import { CommandCenterLayout } from './components/CommandCenterLayout';

interface RaceMeta {
  title: string;
  status: 'draft' | 'pre_race' | 'live' | 'ended';
  slug?: string;
}

type ViewMode = 'dashboard' | 'alerts';

export default function CommandCenterPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const raceId = String((params as { id?: string }).id ?? '');
  const { token } = useAuth();
  const [race, setRace] = useState<RaceMeta | null>(null);

  // F-008 v2 BR-CC2-32 — `?view=alerts` triggers drill-in render in Layout.
  const viewParam = searchParams?.get('view');
  const viewMode: ViewMode = viewParam === 'alerts' ? 'alerts' : 'dashboard';

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

  // BR-CC-22 — variant red-live khi race.status === 'live', else white.
  const variant = race?.status === 'live' ? 'red-live' : 'white';

  if (!raceId) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        variant={variant}
        eyebrow="RACE · COMMAND CENTER"
        title={race?.title || '...'}
        // F-011 BR-PB-08 — VN microcopy mandate: "Race Command Center" canonical
        // brand term replaces previous English subtitle (per Danny chốt #3).
        meta={
          race?.status === 'live'
            ? 'RACE LIVE — Race Command Center'
            : 'Race Command Center'
        }
      />
      <CommandCenterLayout
        raceId={raceId}
        raceSlug={race?.slug}
        viewMode={viewMode}
        raceTitle={race?.title}
        raceStatus={race?.status}
      />
    </div>
  );
}
