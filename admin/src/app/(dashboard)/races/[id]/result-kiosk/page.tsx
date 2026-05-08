'use client';

/**
 * F-013 Result Kiosk standalone tab — replaces the F-007 placeholder.
 *
 * Architectural shape (PRD §1):
 *   - Surface 1 (admin shell ON):  KioskTabBody — settings card + status-aware
 *     guard + "Bật chế độ Kiosk" CTA
 *   - Surface 2 (admin shell OFF): KioskBibInputScreen — BIB pad fullscreen
 *   - Surface 3 (admin shell OFF): KioskResultScreen — result card / not-found
 *     / data-error
 *
 * Single state machine in KioskModeProvider drives which surface renders.
 * Fullscreen primitive (`body[data-fullscreen="true"]`) is toggled by the
 * provider's `enterKiosk` / `exitKiosk` handlers via `useKioskFullscreen`.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { KioskModeProvider, useKioskContext } from './components/KioskModeProvider';
import { KioskTabBody } from './components/KioskTabBody';
import { KioskBibInputScreen } from './components/KioskBibInputScreen';
import { KioskResultScreen } from './components/KioskResultScreen';

function KioskSurfaceSwitch({ raceId, raceTitle }: { raceId: string; raceTitle: string }) {
  const ctx = useKioskContext();
  if (ctx.mode === 'admin') {
    return <KioskTabBody raceId={raceId} />;
  }
  if (ctx.mode === 'bib-input') {
    return <KioskBibInputScreen raceTitle={raceTitle} />;
  }
  return <KioskResultScreen />;
}

export default function ResultKioskPage() {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? '');
  const { token } = useAuth();
  const [raceTitle, setRaceTitle] = useState<string>('');

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
        const body = data as { data?: { title?: string } } | { title?: string };
        const title =
          ((body as { data?: { title?: string } })?.data?.title) ??
          ((body as { title?: string })?.title) ??
          '';
        if (!cancelled) setRaceTitle(title);
      } catch {
        /* ignore — title is decorative */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, raceId]);

  return (
    <KioskModeProvider raceId={raceId}>
      <KioskSurfaceSwitch raceId={raceId} raceTitle={raceTitle} />
    </KioskModeProvider>
  );
}
