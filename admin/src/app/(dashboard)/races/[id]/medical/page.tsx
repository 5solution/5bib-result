'use client';

/**
 * F-018 — Medical Incident Tracker tab page.
 *
 * Wraps `MedicalTabBody` and resolves race meta (status drives empty state +
 * SSE enable). Race shell layout / RaceTabsNav already provides the tab
 * navigation chrome.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { MedicalTabBody } from './components/MedicalTabBody';

type RaceStatus = 'draft' | 'pre_race' | 'live' | 'ended';

export default function MedicalIncidentsPage() {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? '');
  const { token } = useAuth();
  const [raceStatus, setRaceStatus] = useState<RaceStatus>('pre_race');

  useEffect(() => {
    let cancelled = false;
    if (!token || !raceId) return;
    (async () => {
      try {
        const { data, error } = await racesControllerGetRaceById({
          path: { id: raceId },
          ...authHeaders(token),
        });
        if (error) return;
        const body = data as
          | { data?: { status?: RaceStatus } }
          | { status?: RaceStatus };
        const status =
          (body as { data?: { status?: RaceStatus } }).data?.status ??
          (body as { status?: RaceStatus }).status ??
          'pre_race';
        if (!cancelled && status) setRaceStatus(status);
      } catch {
        /* ignore — fall back to default status */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, raceId]);

  if (!raceId) return null;

  return <MedicalTabBody raceId={raceId} raceStatus={raceStatus} />;
}
