'use client';

/**
 * F-015 Surface 2 — fullscreen lookup screen.
 *
 * Wraps `<MultiInputLookup>` with header (race line + station), exit button,
 * sound toggle, multi-station status bar, and SSE-disconnect / outside-window
 * banners.
 */

import { Volume2, VolumeX } from 'lucide-react';
import { CHECKIN_COPY } from '../checkin.microcopy';
import { SHARED_KIOSK_CONFIG } from '@/lib/kiosk';
import { useCheckInContext } from './CheckInModeProvider';
import { CheckInExitButton } from './CheckInExitButton';
import { MultiInputLookup } from './MultiInputLookup';
import { MultiStationStatusBar } from './MultiStationStatusBar';
import { OnlineRequiredBanner } from './OnlineRequiredBanner';
import type { CheckInStatsPayload, ResultKind } from '../checkin.types';

interface CheckInBibInputScreenProps {
  raceTitle: string;
  loading: boolean;
  stats: CheckInStatsPayload | null;
  connected: boolean;
  fallbackPolling: boolean;
  windowClosed?: { start: string; end: string } | null;
  onSubmitBib: () => void;
  onSubmitCmnd: () => void;
  onScannedQr: (text: string) => void;
  /** Result feedback inline on Surface 2 (not-found banner / multi-candidate list). */
  inlineResult: ResultKind | null;
  onPickCandidate: (idx: number) => void;
}

export function CheckInBibInputScreen({
  raceTitle,
  loading,
  stats,
  connected,
  fallbackPolling,
  windowClosed,
  onSubmitBib,
  onSubmitCmnd,
  onScannedQr,
  inlineResult,
  onPickCandidate,
}: CheckInBibInputScreenProps) {
  const ctx = useCheckInContext();

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-white"
      data-testid="check-in-bib-input-screen"
    >
      <header className="flex items-center justify-between p-4 sm:p-6">
        <div className="text-sm font-medium text-stone-500" data-testid="check-in-race-line">
          {CHECKIN_COPY.input.raceLine(raceTitle, ctx.stationId)}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={ctx.toggleSound}
            aria-label={ctx.soundEnabled ? CHECKIN_COPY.input.soundOn : CHECKIN_COPY.input.soundOff}
            aria-pressed={ctx.soundEnabled}
            className="flex items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-700 transition-transform active:scale-95"
            style={{
              minHeight: `${SHARED_KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
              minWidth: `${SHARED_KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
              touchAction: 'manipulation',
            }}
            data-testid="check-in-sound-toggle"
          >
            {ctx.soundEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </button>
          <CheckInExitButton onClick={() => void ctx.exitKiosk()} />
        </div>
      </header>

      <MultiStationStatusBar
        stationId={ctx.stationId}
        stats={stats}
        connected={connected}
        fallbackPolling={fallbackPolling}
      />

      <OnlineRequiredBanner visible={!connected && !fallbackPolling} />

      {/* Outside-window banner (BR-CK-06) */}
      {windowClosed ? (
        <div
          role="status"
          className="border-b border-stone-300 bg-stone-100 p-4 text-center text-sm text-stone-700"
          data-testid="outside-window-banner"
        >
          <div className="text-base font-bold text-stone-900">{CHECKIN_COPY.input.closedTitle}</div>
          <div className="mt-1">
            {CHECKIN_COPY.input.closedSubtitle(windowClosed.start, windowClosed.end)}
          </div>
        </div>
      ) : null}

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4">
        <h1 className="mb-4 text-2xl font-bold text-stone-900">{CHECKIN_COPY.input.title}</h1>

        {/* Inline result feedback (BR-CK-02 not-found / multi-candidate). */}
        {inlineResult?.kind === 'not-found' ? (
          <div
            role="alert"
            className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
            data-testid="not-found-banner"
          >
            {CHECKIN_COPY.input.notFound(inlineResult.query)}
          </div>
        ) : null}
        {inlineResult?.kind === 'multi-candidate' ? (
          <div
            className="mb-4 rounded-md border border-stone-200 bg-stone-50 p-3"
            data-testid="multi-candidate-list"
          >
            <div className="mb-2 text-sm font-bold text-stone-900">
              {CHECKIN_COPY.input.cmndMultiCandidate(inlineResult.payloads.length)}
            </div>
            <ul className="space-y-2">
              {inlineResult.payloads.map((p, i) => (
                <li key={`${p.athleteId}-${p.bib}`}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-stone-200 bg-white p-3 text-left hover:border-[#FF0E65]"
                    onClick={() => onPickCandidate(i)}
                    data-testid={`candidate-${i}`}
                  >
                    <span className="block font-mono text-lg font-bold text-stone-900">
                      BIB {p.bib}
                    </span>
                    <span className="block text-sm text-stone-700">{p.name}</span>
                    {p.course ? (
                      <span className="block text-xs text-stone-500">{p.course}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {inlineResult?.kind === 'network-error' ? (
          <div
            role="alert"
            className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
          >
            {CHECKIN_COPY.input.networkError}
          </div>
        ) : null}

        <MultiInputLookup
          loading={loading}
          onSubmitBib={onSubmitBib}
          onSubmitCmnd={onSubmitCmnd}
          onScannedQr={onScannedQr}
        />
      </main>
    </div>
  );
}
