'use client';

/**
 * F-009 Course Map page — REPLACES F-007 placeholder.
 *
 * Architectural shape per BR-CM2-01 LOCK:
 *   /admin/races/[id]/course-map → tab body inside F-007/F-008 v2 9-tab race-ops
 *   shell (RaceOpsHeader + RaceLiveTimer + Breadcrumb + RaceTabsNav already
 *   global trong [id]/layout.tsx). This file ONLY renders the tab body —
 *   PageHero (variant white) + CourseMapLayout orchestrator.
 *
 * NOT modal, NOT drawer, NOT sub-page. NO chrome re-implementation.
 *
 * Pattern parity with F-008 v2 command-center/page.tsx:
 *   - Client Component because we need useAuth() + authHeaders for race fetch
 *   - racesControllerGetRaceById hydrates courses[] for picker
 *   - Initial course id resolved from `?course=` searchParam
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api'; // ensure client baseUrl is configured
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { PageHero } from '@/components/race-ops-shell/PageHero';
import { Skeleton } from '@/components/ui/skeleton';
import { CourseMapLayout } from './components/CourseMapLayout';
import type { CoursePickerEntry } from './components/CourseDistancePicker';

interface RawCourse {
  courseId?: string;
  name?: string;
  distance?: string;
}

interface RaceMeta {
  title: string;
  status: 'draft' | 'pre_race' | 'live' | 'ended';
  slug?: string;
  courses?: RawCourse[];
}

export default function CourseMapPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const raceId = String((params as { id?: string }).id ?? '');
  const { token } = useAuth();
  const [race, setRace] = useState<RaceMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token || !raceId) return;
    (async () => {
      try {
        const { data } = await racesControllerGetRaceById({
          path: { id: raceId },
          ...authHeaders(token),
        });
        const body = data as { data?: RaceMeta } | RaceMeta | undefined;
        const r =
          (body as { data?: RaceMeta } | undefined)?.data ??
          (body as RaceMeta | undefined);
        if (!cancelled && r) setRace(r);
      } catch {
        /* noop — empty-state UI handles missing race */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, raceId]);

  if (!raceId || loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    );
  }

  const courses: CoursePickerEntry[] = (race?.courses ?? [])
    .filter((c): c is RawCourse & { courseId: string; name: string } =>
      Boolean(c.courseId && c.name),
    )
    .map((c) => ({
      courseId: c.courseId,
      name: c.name,
      distance: c.distance,
    }));

  const initialCourseId =
    searchParams?.get('course') ?? courses[0]?.courseId ?? '';

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        variant="white"
        eyebrow="RACE · COURSE MAP"
        title={race?.title || '...'}
        meta="Cấu hình route & checkpoints — fullpage"
      />
      <CourseMapLayout
        raceId={raceId}
        courses={courses}
        initialCourseId={initialCourseId}
      />
    </div>
  );
}
