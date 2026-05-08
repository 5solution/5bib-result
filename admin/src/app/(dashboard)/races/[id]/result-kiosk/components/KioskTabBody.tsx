'use client';

/**
 * F-013 Surface 1 — Admin tab body (kiosk OFF).
 *
 * Reads race meta directly via the SDK (race shell layout doesn't expose race
 * via context) so we can run BR-RK-07 status-aware guard:
 *   - status === 'draft' → empty state, "Bật chế độ Kiosk" hidden
 *   - status ∈ {pre_race, live, ended} → CTA visible
 *
 * On CTA click → KioskModeProvider.enterKiosk() (user-gesture-bound for both
 * Web Audio + Fullscreen API per Manager STOP triggers).
 */

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { PageHero } from '@/components/race-ops-shell/PageHero';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useKioskContext } from './KioskModeProvider';
import { KIOSK_COPY } from '../kiosk.microcopy';

interface RaceMeta {
  _id: string;
  title: string;
  status: 'draft' | 'pre_race' | 'live' | 'ended';
  courses?: Array<{ name?: string; courseId?: string }>;
}

interface KioskTabBodyProps {
  raceId: string;
}

export function KioskTabBody({ raceId }: KioskTabBodyProps) {
  const { token } = useAuth();
  const ctx = useKioskContext();
  const [race, setRace] = useState<RaceMeta | null>(null);
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
        if (error) throw new Error('Race not found');
        const body = data as { data?: RaceMeta } | RaceMeta;
        const raceData = ((body as { data?: RaceMeta })?.data ?? (body as RaceMeta)) as RaceMeta;
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

  const isDraft = race?.status === 'draft';

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={KIOSK_COPY.tab.eyebrow}
        title={KIOSK_COPY.tab.title}
        meta={KIOSK_COPY.tab.meta}
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : isDraft ? (
            <div className="text-center" data-testid="kiosk-draft-empty">
              <div className="text-lg font-bold text-stone-700">
                {KIOSK_COPY.tab.draftEmpty}
              </div>
              <div className="mt-2 text-sm text-stone-500">
                {KIOSK_COPY.tab.draftEmptyHint}
              </div>
            </div>
          ) : (
            <>
              <p className="text-base text-stone-700">{KIOSK_COPY.tab.description}</p>
              <Button
                type="button"
                onClick={() => void ctx.enterKiosk()}
                className="bg-[#FF0E65] px-6 py-6 text-lg font-bold text-white hover:bg-[#FF0E65]/90"
                data-testid="kiosk-enter-button"
              >
                <Sparkles className="mr-2 h-5 w-5" aria-hidden />
                {KIOSK_COPY.tab.enterButton}
              </Button>
              <p className="text-xs text-stone-500">{KIOSK_COPY.tab.enterHint}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
