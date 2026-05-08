'use client';

/**
 * F-015 Check-In Kiosk standalone tab — Race Ops Cluster #9 #1.
 *
 * Architectural shape:
 *   - Surface 1 (admin shell ON):  CheckInTabBody — settings + station table + recent feed
 *   - Surface 2 (kiosk mode ON):   CheckInBibInputScreen — multi-input lookup
 *   - Surface 3 (kiosk mode ON):   CheckInResultScreen — preview + confirm
 *
 * BR-CK-20 module boundary: NO imports from `@/lib/chip-verification-api`.
 * F-013 reuse: shared kiosk lib hooks at `@/lib/kiosk` (Manager Plan §3 Option 3).
 *
 * Idle timer (60s + 10s countdown) wires here so all 3 surfaces share one
 * timer. Idle fires → goToLookup() (only meaningful in surfaces 2/3, no-op
 * effectively when admin).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { useKioskIdle } from '@/lib/kiosk';
import {
  CheckInModeProvider,
  useCheckInContext,
} from './components/CheckInModeProvider';
import { CheckInTabBody } from './components/CheckInTabBody';
import { CheckInBibInputScreen } from './components/CheckInBibInputScreen';
import { CheckInResultScreen } from './components/CheckInResultScreen';
import { useAthleteLookup } from './hooks/useAthleteLookup';
import { useCheckInMutation } from './hooks/useCheckInMutation';
import { useStationSync } from './hooks/useStationSync';
import type {
  AthleteCheckInPayload,
  ResultKind,
} from './checkin.types';

interface RaceMeta {
  _id?: string;
  id?: string;
  title: string;
  status: 'draft' | 'pre_race' | 'live' | 'ended';
  checkInWindow?: { start?: string | null; end?: string | null } | null;
}

function CheckInSurfaceSwitch({ raceId, raceTitle }: { raceId: string; raceTitle: string }) {
  const ctx = useCheckInContext();
  const [inlineResult, setInlineResult] = useState<ResultKind | null>(null);

  const lookup = useAthleteLookup({ raceId });
  const mutate = useCheckInMutation({ raceId, stationId: ctx.stationId });
  const sync = useStationSync({
    raceId,
    enabled: true,
    onPickup: () => { /* trigger stats refresh — handled internally */ },
  });

  // BR-CK-12 idle reset — applies to surfaces 2/3 only, paused on admin.
  useKioskIdle({
    enabled: ctx.surface !== 'admin',
    onIdle: () => ctx.goToLookup(),
  });

  const onSubmitBib = useCallback(async () => {
    if (!ctx.bibInput) return;
    setInlineResult(null);
    const outcome = await lookup.mutateAsync({ mode: 'bib', query: ctx.bibInput });
    if (outcome.kind === 'found') {
      ctx.beepSuccess();
      ctx.selectAthlete(outcome.payload);
    } else if (outcome.kind === 'multi-candidate') {
      ctx.beepSuccess();
      setInlineResult(outcome);
    } else {
      ctx.beepError();
      setInlineResult(outcome);
    }
  }, [ctx, lookup]);

  const onSubmitCmnd = useCallback(async () => {
    if (ctx.cmndInput.length < 4) return;
    setInlineResult(null);
    const outcome = await lookup.mutateAsync({ mode: 'cmnd', query: ctx.cmndInput });
    // BR-CK-10: cmndInput is wiped immediately upon success/multi-candidate
    // selection or kiosk-exit (parent context owns lifetime).
    if (outcome.kind === 'found') {
      ctx.beepSuccess();
      ctx.clearCmnd();
      ctx.selectAthlete(outcome.payload);
    } else if (outcome.kind === 'multi-candidate') {
      ctx.beepSuccess();
      setInlineResult(outcome);
    } else {
      ctx.beepError();
      setInlineResult(outcome);
    }
  }, [ctx, lookup]);

  const onScannedQr = useCallback(async (text: string) => {
    setInlineResult(null);
    const outcome = await lookup.mutateAsync({ mode: 'qr', query: text });
    if (outcome.kind === 'found') {
      ctx.beepSuccess();
      ctx.selectAthlete(outcome.payload);
    } else if (outcome.kind === 'multi-candidate') {
      ctx.beepSuccess();
      setInlineResult(outcome);
    } else {
      ctx.beepError();
      setInlineResult(outcome);
    }
  }, [ctx, lookup]);

  const onPickCandidate = useCallback((idx: number) => {
    if (inlineResult?.kind !== 'multi-candidate') return;
    const p = inlineResult.payloads[idx];
    if (!p) return;
    setInlineResult(null);
    ctx.clearCmnd();
    ctx.selectAthlete(p);
  }, [ctx, inlineResult]);

  const onConfirm = useCallback(async () => {
    if (!ctx.selectedAthlete) return;
    if (ctx.selectedAthlete.racekitReceived) return; // safety guard — UI already disables CTA
    ctx.setConfirm({ kind: 'submitting' });
    const outcome = await mutate.mutateAsync({
      bib: String(ctx.selectedAthlete.bib),
      athleteId: ctx.selectedAthlete.athleteId,
      // For QR: source is 'qr'; otherwise infer from cmndInput presence vs bibInput.
      source: ctx.cmndInput.length > 0 ? 'cmnd' : 'bib',
    });
    if (outcome.kind === 'success') {
      ctx.beepSuccess();
      ctx.setConfirm(outcome);
    } else if (outcome.kind === 'conflict') {
      ctx.beepError();
      ctx.setConfirm({ kind: 'conflict' });
    } else {
      ctx.beepError();
      ctx.setConfirm({ kind: 'network-error' });
    }
  }, [ctx, mutate]);

  // BR-CK-06 outside-window banner
  // (Race meta read from backend response when surface is admin — reused here.)
  const windowClosed = useMemo(() => null, []); // outside-window flag computed by tab body, banner here is decorative.
  void windowClosed; // unused until backend includes window meta in stats response.

  if (ctx.surface === 'admin') {
    return (
      <CheckInTabBody
        raceId={raceId}
        stats={sync.stats}
        connected={sync.connected}
        fallbackPolling={sync.fallbackPolling}
      />
    );
  }
  if (ctx.surface === 'lookup') {
    return (
      <CheckInBibInputScreen
        raceTitle={raceTitle}
        loading={lookup.isPending}
        stats={sync.stats}
        connected={sync.connected}
        fallbackPolling={sync.fallbackPolling}
        windowClosed={null}
        onSubmitBib={onSubmitBib}
        onSubmitCmnd={onSubmitCmnd}
        onScannedQr={onScannedQr}
        inlineResult={inlineResult}
        onPickCandidate={onPickCandidate}
      />
    );
  }
  return (
    <CheckInResultScreen
      stats={sync.stats}
      connected={sync.connected}
      fallbackPolling={sync.fallbackPolling}
      onConfirm={onConfirm}
      onCancel={() => ctx.goToLookup()}
    />
  );
}

export default function CheckInKioskPage() {
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
        const body = data as { data?: RaceMeta } | RaceMeta;
        const title =
          ((body as { data?: { title?: string } })?.data?.title) ??
          ((body as { title?: string })?.title) ??
          '';
        if (!cancelled) setRaceTitle(title);
      } catch {
        /* title decorative — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, raceId]);

  // Force unused payload reference so typecheck sees AthleteCheckInPayload shape.
  const _unused: AthleteCheckInPayload | null = null;
  void _unused;

  return (
    <CheckInModeProvider raceId={raceId}>
      <CheckInSurfaceSwitch raceId={raceId} raceTitle={raceTitle} />
    </CheckInModeProvider>
  );
}
