'use client';

/**
 * F-019 — Awards Age Group Podium + Anomaly Warnings tab.
 *
 * Replaces F-008v2 placeholder PodiumTab body with full AG podium grid +
 * anomaly drawer + state machine controls + PDF export.
 *
 * BR-AF-23 honored: orchestrator structure (PageHero + sections) preserved
 * from F-008v2 placeholder. Legacy `getPodium()` simple top-finishers list
 * removed in favor of richer AG podium documents.
 *
 * Race Ops Cluster #9 #2 — extends F-008v2 (Awards tab placeholder).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHero } from '@/components/race-ops-shell/PageHero';
import { AGPodiumGrid } from './components/AGPodiumGrid';
import { OverallPodiumCard } from './components/OverallPodiumCard';
import { AnomalyWarningsBanner } from './components/AnomalyWarningsBanner';
import { AnomalyInbox } from './components/AnomalyInbox';
import { PredictedRankList } from './components/PredictedRankList';
import { AGPresetPicker } from './components/AGPresetPicker';
import { FilterBar } from './components/FilterBar';
import { BracketSourceBanner } from './components/BracketSourceBanner';
import { CompoundingModeSelector, type CompoundingMode } from './components/CompoundingModeSelector';
import { useRecompute } from './hooks/useRecompute';
import { useAgPodium } from './hooks/useAgPodium';
import { useAnomalyWarnings } from './hooks/useAnomalyWarnings';
import { useAgEligibility } from '../readiness/hooks/useAgEligibility';
import { Button } from '@/components/ui/button';
import { VN } from './awards.microcopy';
import type { PodiumState, PresetKey } from './awards.constant';

interface RaceMeta {
  title: string;
  status: 'draft' | 'pre_race' | 'live' | 'ended';
  awardsCompoundingMode?: CompoundingMode;
  courses?: Array<{
    courseId: string;
    name: string;
    distanceKm?: number;
    courseType?: string;
    ageGroupPreset?: PresetKey;
  }>;
}

export default function AwardsPage() {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? '');
  const { token } = useAuth();
  const [race, setRace] = useState<RaceMeta | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterCourseId, setFilterCourseId] = useState<string | undefined>();
  const [filterGender, setFilterGender] = useState<'M' | 'F' | undefined>();
  const [filterState, setFilterState] = useState<PodiumState | undefined>();

  const recompute = useRecompute(raceId);

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

  const courseOptions = useMemo(
    () => race?.courses?.map((c) => ({ courseId: c.courseId, name: c.name })) ?? [],
    [race],
  );

  const filter = useMemo(
    () => ({ courseId: filterCourseId, gender: filterGender, state: filterState }),
    [filterCourseId, filterGender, filterState],
  );

  if (!raceId) return <Skeleton className="h-[600px] w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <PageHero
        variant={race?.status === 'live' ? 'red-live' : 'white'}
        eyebrow="RACE · TRAO GIẢI"
        title={race?.title || '...'}
        meta="Lễ trao giải theo nhóm tuổi (AG) + cảnh báo bất thường — BTC chuẩn bị podium 14:00"
      />

      {/* F-019 v2 — bracket source banner (Independent calc + 2-layer verify). */}
      {raceId && <V2BracketSourceBannerWrapper raceId={raceId} />}

      {/* F-019 v2.1 — compounding mode selector (VN amateur convention). */}
      {raceId && (
        <CompoundingModeSelector
          raceId={raceId}
          current={race?.awardsCompoundingMode ?? 'mutually_exclusive'}
          onChanged={(next) =>
            setRace((r) => (r ? { ...r, awardsCompoundingMode: next } : r))
          }
        />
      )}

      <AnomalyWarningsBanner
        raceId={raceId}
        courseId={filterCourseId}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar
          courseOptions={courseOptions}
          selectedCourseId={filterCourseId}
          onCourseChange={setFilterCourseId}
          selectedGender={filterGender}
          onGenderChange={setFilterGender}
          selectedState={filterState}
          onStateChange={setFilterState}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={recompute.isPending}
          title={VN.RECOMPUTE_TOOLTIP}
          onClick={() => recompute.mutate({ courseId: filterCourseId })}
        >
          {recompute.isPending ? '...' : VN.RECOMPUTE_BUTTON}
        </Button>
      </div>

      {race?.status === 'pre_race' || race?.status === 'draft' ? (
        <div className="rounded-md border border-stone-200 bg-stone-50 p-6 text-sm text-stone-600">
          {VN.EMPTY_RACE_NOT_ENDED}
        </div>
      ) : (
        <>
          <PredictedRankList raceId={raceId} />
          {/* F-020 BR-AG-49 — Top Chung Cuộc section render đầu trang. */}
          <OverallPodiumGrid raceId={raceId} filter={filter} />
          <AGPodiumGrid raceId={raceId} filter={filter} />
        </>
      )}

      {drawerOpen && (
        <div className="fixed inset-y-0 right-0 z-30 w-full max-w-2xl overflow-y-auto bg-white p-4 shadow-2xl">
          <AnomalyInbox raceId={raceId} courseId={filterCourseId} onClose={() => setDrawerOpen(false)} />
        </div>
      )}

      {race?.courses && race.courses.length > 0 && (
        <AGPresetPicker
          raceId={raceId}
          courses={race.courses.map((c) => ({
            courseId: c.courseId,
            name: c.name,
            ageGroupPreset: c.ageGroupPreset,
          }))}
        />
      )}
    </div>
  );
}

/**
 * F-020 — OverallPodiumGrid inline component (giữ Scope Lock 9 file count).
 *
 * Fetch list podium qua hook `useAgPodium` (đã có F-019), filter client-side
 * `podiumType === 'OVERALL'`, render stack vertical 1 card per course.
 * Hidden khi không có OVERALL podium nào (khi recompute chưa chạy hoặc race
 * legacy có podium trước F-020 ship — Mongoose default 'AG' cho doc cũ).
 */
function OverallPodiumGrid({
  raceId,
  filter,
}: {
  raceId: string;
  filter: { courseId?: string; gender?: 'M' | 'F'; state?: PodiumState };
}) {
  // Bỏ qua filter gender ở đây — OVERALL không có gender (mixed).
  const { data, isLoading } = useAgPodium(raceId, {
    courseId: filter.courseId,
    state: filter.state,
  });
  const { data: anomalies } = useAnomalyWarnings(raceId, {
    courseId: filter.courseId,
  });
  if (isLoading || !data) return null;
  const overall = data.items.filter((p) => p.podiumType === 'OVERALL');
  if (overall.length === 0) return null;
  const blocking = anomalies?.blockingCount ?? 0;
  const blockingMessage =
    blocking > 0 ? VN.LOCK_DISABLED_TIP(blocking) : undefined;
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wide text-stone-500">
        {VN.OVERALL_SECTION_HINT}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {overall.map((p) => (
          <OverallPodiumCard
            key={p.id}
            podium={p}
            raceId={raceId}
            blockingMessage={blockingMessage}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * F-019 v2 — Wrapper component fetching eligibility report → render banner.
 * Inline component để tránh tạo file riêng cho 1 wrapper nhỏ; data flow:
 *   useAgEligibility → bracketSource + coverage → BracketSourceBanner.
 */
function V2BracketSourceBannerWrapper({ raceId }: { raceId: string }) {
  const { data } = useAgEligibility(raceId);
  if (!data) return null;
  return (
    <BracketSourceBanner
      bracketSource={data.bracketSource}
      coverage={data.coverage}
    />
  );
}
