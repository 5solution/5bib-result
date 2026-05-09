'use client';

/**
 * F-014 — Athletes tab orchestrator (replaces F-007 41-LOC placeholder).
 *
 * Responsibilities:
 *   1. Fetch race title + status + courses[] (cached via TanStack Query).
 *   2. Pass to <AthletesTabBody /> which owns all athlete-list state.
 *   3. F-011 status-aware guard delegated to AthletesTabBody — page-level
 *      shell stays thin.
 *
 * NO client-side data wrangling here — keep < 200 LOC composer per
 * Manager plan.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { Skeleton } from '@/components/ui/skeleton';
import { AthletesTabBody } from './components/AthletesTabBody';

interface RaceShellMeta {
  title: string;
  status: string;
  courses: Array<{ courseId: string; name: string }>;
}

export default function AthletesPage() {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? '');
  const { token } = useAuth();
  const [meta, setMeta] = useState<RaceShellMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token || !raceId) return;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await racesControllerGetRaceById({
          path: { id: raceId },
          ...authHeaders(token),
        });
        if (error) throw error;
        const body = data as
          | { data?: { title?: string; status?: string; courses?: Array<{ courseId: string; name: string }> } }
          | { title?: string; status?: string; courses?: Array<{ courseId: string; name: string }> };
        const race =
          (body as { data?: { title?: string; status?: string; courses?: Array<{ courseId: string; name: string }> } })
            ?.data ?? (body as { title?: string; status?: string; courses?: Array<{ courseId: string; name: string }> });
        if (cancelled) return;
        setMeta({
          title: race?.title ?? '',
          status: race?.status ?? 'draft',
          courses: (race?.courses ?? []).map((c) => ({
            courseId: c.courseId,
            name: c.name,
          })),
        });
      } catch {
        if (!cancelled) {
          setMeta({ title: '', status: 'draft', courses: [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, raceId]);

  if (loading || !meta) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <AthletesTabBody
      raceId={raceId}
      raceStatus={meta.status}
      raceTitle={meta.title}
      courses={meta.courses}
    />
  );
}
