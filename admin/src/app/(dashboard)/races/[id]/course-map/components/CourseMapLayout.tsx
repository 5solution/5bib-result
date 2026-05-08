'use client';

/**
 * F-009 CourseMapLayout — Client orchestrator wiring 6 sections.
 *
 * Sections (per Canvas 02 + BR-CM2-01..32):
 *   1. AimsItraDisclaimerBanner (BR-CM2-30)
 *   2. CourseDistancePicker pills + status badges (BR-CM2-04 + URL `?course=`)
 *   3. GpxUploadSection (BR-CM2-08 state machine)
 *   4. CourseMapFullView (verbatim port — BR-AF-23 7th port)
 *   5. CheckpointConfigGrid (READ-ONLY distance per BR-CM2-10)
 *   6. ManualDragModeButton (lightweight toast — PAUSE-CM2-04 divergence)
 *      + AutoSnapButton (MEDIUM modal — override warning)
 *
 * Reuses F-006 hooks (useCourseMapData) — NO modify F-006 lib.
 * Reuses F-008 v2 CheckpointDiscoveryDialog wrapper (closes TD-F008-V2-01).
 */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ElevationChart } from '@/components/course-map/ElevationChart';
import { useCourseMapData } from '@/lib/course-map-hooks';
import type { CourseMapDataDto, GpxParsedDto } from '@/lib/course-map-api';
import { Search } from 'lucide-react';
import { CheckpointDiscoveryDialog } from '../../command-center/components/CheckpointDiscoveryDialogWrapper';
import { AimsItraDisclaimerBanner } from './AimsItraDisclaimerBanner';
import {
  CourseDistancePicker,
  type CourseStatus,
  type CoursePickerEntry,
} from './CourseDistancePicker';
import { GpxUploadSection } from './GpxUploadSection';
import { CheckpointConfigGrid } from './CheckpointConfigGrid';
import { ManualDragModeButton } from './ManualDragModeButton';

// Dynamic import — Leaflet requires `window`.
const CourseMapFullView = dynamic(() => import('./CourseMapFullView'), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full animate-pulse rounded-2xl bg-stone-100" />
  ),
});

export interface CourseMapLayoutProps {
  raceId: string;
  /** Pre-fetched course list from page-level RSC fetch. */
  courses: CoursePickerEntry[];
  /** Initial course id from `?course=` searchParam (server-resolved). */
  initialCourseId: string;
}

function profileFromGpxParsed(
  parsed: GpxParsedDto | undefined,
): { distanceKm: number; elevation: number }[] {
  if (!parsed) return [];
  const min = parsed.minElevation;
  const max = parsed.maxElevation;
  if (typeof min !== 'number' || typeof max !== 'number') return [];
  return [
    { distanceKm: 0, elevation: min },
    { distanceKm: parsed.totalDistanceKm, elevation: max },
  ];
}

function deriveStatus(data: CourseMapDataDto | null | undefined): CourseStatus {
  if (!data || !data.hasGpx) return 'no-gpx';
  const cps = data.checkpoints ?? [];
  const hasUnpositioned = cps.some(
    (cp) => typeof cp.lat !== 'number' || typeof cp.lng !== 'number',
  );
  return hasUnpositioned ? 'partial' : 'complete';
}

export function CourseMapLayout({
  raceId,
  courses,
  initialCourseId,
}: CourseMapLayoutProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCourseId = searchParams?.get('course') ?? initialCourseId;
  // Validate query against known courses; fallback to first course.
  const validCourseId =
    courses.find((c) => c.courseId === queryCourseId)?.courseId ??
    courses[0]?.courseId ??
    '';

  const [manualMode, setManualMode] = React.useState(false);
  const [discoveryOpen, setDiscoveryOpen] = React.useState(false);

  const mapData = useCourseMapData(raceId, validCourseId || null);
  const data = mapData.data;

  // Compute status map for picker (single course query is enough — other
  // courses' status is derived heuristically from the courses[] meta until
  // the user clicks them; status shown in pill is best-effort).
  // For the active course we have authoritative data; for inactive ones we
  // mark 'no-gpx' as conservative default.
  const statusByCourse = React.useMemo<Record<string, CourseStatus>>(() => {
    const map: Record<string, CourseStatus> = {};
    for (const c of courses) {
      map[c.courseId] = c.courseId === validCourseId ? deriveStatus(data) : 'no-gpx';
    }
    return map;
  }, [courses, validCourseId, data]);

  // When manualMode is on but user switches course → reset toggle to OFF
  // so a fresh course doesn't accidentally inherit drag-active state.
  React.useEffect(() => {
    setManualMode(false);
  }, [validCourseId]);

  // BR-CM2-25 — Discovery dialog course selector pre-fills with current `?course=`
  const activeCourse = courses.find((c) => c.courseId === validCourseId);
  const handleOpenDiscovery = React.useCallback(() => {
    setDiscoveryOpen(true);
  }, []);

  if (!validCourseId) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <p
          className="text-sm font-semibold text-stone-700"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Race chưa có cự ly
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Vào tab Settings → Cự ly để tạo cự ly trước.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => router.push(`/races/${raceId}/settings`)}
        >
          Đi tới Settings
        </Button>
      </div>
    );
  }

  const checkpoints = data?.checkpoints ?? [];
  const unmatchedKeys = checkpoints
    .filter((cp) => typeof cp.lat !== 'number' || typeof cp.lng !== 'number')
    .map((cp) => cp.key);
  const hasGpx = Boolean(data?.hasGpx);

  return (
    <div className="flex flex-col gap-4">
      {/* Section 1 — AIMS/ITRA disclaimer */}
      <AimsItraDisclaimerBanner />

      {/* Section 2 — course pills */}
      <section
        className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4"
        aria-label="Chọn cự ly"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            className="text-sm font-bold tracking-tight text-stone-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Cự ly
          </h2>
          {activeCourse ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenDiscovery}
              title="Discover checkpoint keys từ RR API"
            >
              <Search className="mr-1.5 size-3.5" aria-hidden="true" />
              Discover RR API
            </Button>
          ) : null}
        </div>
        <CourseDistancePicker
          courses={courses}
          statusByCourse={statusByCourse}
          selectedCourseId={validCourseId}
        />
      </section>

      {/* Section 3 — GPX upload */}
      <GpxUploadSection
        raceId={raceId}
        courseId={validCourseId}
        mapData={data}
        isLoading={mapData.isLoading}
        hasNoCheckpointsConfigured={checkpoints.length === 0}
      />

      {/* Section 4 — toolbar + map fullpage */}
      <section
        className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4"
        aria-label="Bản đồ cự ly"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              className="text-sm font-bold tracking-tight text-stone-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Bản đồ
            </h2>
            <p className="text-xs text-stone-500">
              Polyline magenta + numbered markers. Pan/zoom bị giới hạn trong race
              bounds (BR-CM-13 sovereignty safeguard).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ManualDragModeButton
              enabled={manualMode}
              onToggle={setManualMode}
              disabled={!hasGpx}
            />
          </div>
        </div>

        {mapData.isLoading && (
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        )}

        {!mapData.isLoading && hasGpx && data?.gpxSimplifiedUrl && data.bounds && (
          <CourseMapFullView
            raceId={raceId}
            courseId={validCourseId}
            gpxSimplifiedUrl={data.gpxSimplifiedUrl}
            geoJson={
              (data.geoJson ?? null) as Record<string, unknown> | null
            }
            bounds={data.bounds}
            totalDistanceKm={data.gpxParsed?.totalDistanceKm}
            checkpoints={checkpoints}
            manualMode={manualMode}
            unmatchedKeys={unmatchedKeys}
          />
        )}

        {!mapData.isLoading && !hasGpx && (
          <div
            className="flex h-[260px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 text-center"
            data-testid="map-empty-state"
          >
            <p
              className="text-sm font-semibold text-stone-700"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Cự ly chưa có GPX
            </p>
            <p className="max-w-md text-xs text-stone-500">
              Vui lòng upload file .gpx hoặc .kml ở section &quot;File GPX / KML&quot;
              ở trên để hiển thị bản đồ.
            </p>
          </div>
        )}

        {hasGpx && data?.gpxParsed && (
          <div className="mt-2">
            <ElevationChart
              elevationProfile={profileFromGpxParsed(data.gpxParsed)}
              checkpoints={checkpoints
                .filter((cp) => typeof cp.distanceKm === 'number')
                .map((cp) => ({
                  distanceKm: cp.distanceKm as number,
                  name: cp.key,
                }))}
              height={140}
            />
          </div>
        )}
      </section>

      {/* Section 5 — checkpoint grid */}
      <CheckpointConfigGrid
        checkpoints={checkpoints}
        manualMode={manualMode}
        noGpx={!hasGpx}
      />

      {/* Section 6 — discovery dialog (course-scoped, closes TD-F008-V2-01) */}
      {activeCourse && (
        <CheckpointDiscoveryDialog
          raceId={raceId}
          courseId={validCourseId}
          courseName={activeCourse.name}
          open={discoveryOpen}
          onOpenChange={setDiscoveryOpen}
        />
      )}
    </div>
  );
}
