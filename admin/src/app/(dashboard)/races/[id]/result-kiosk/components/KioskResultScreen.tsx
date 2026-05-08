'use client';

/**
 * F-013 Surface 3 — Result display wrapper.
 *
 * Composes:
 *   - KioskResultCard (FIN/DNS/DNF/DSQ/LIVE variants)
 *   - "Tìm BIB khác" CTA → resetToInput()
 *   - 5s auto-reset bar for not-found (BR-RK-02)
 *   - 60s idle timer + last-10s countdown overlay (BR-RK-06)
 *   - Network-error / data-error fallback panels (BR-RK-09 / BR-RK-11)
 */

import { useEffect } from 'react';
import { Volume2, VolumeX, RotateCcw, AlertCircle } from 'lucide-react';
import { useKioskContext } from './KioskModeProvider';
import { KioskResultCard } from './KioskResultCard';
import { KioskExitButton } from './KioskExitButton';
import { KioskIdleOverlay } from './KioskIdleOverlay';
import { useKioskIdle } from '../hooks/useKioskIdle';
import { KIOSK_COPY } from '../kiosk.microcopy';
import { KIOSK_CONFIG } from '../kiosk.constant';

export function KioskResultScreen() {
  const ctx = useKioskContext();

  // BR-RK-06: 60s idle reset to input. Pause-on-non-result kinds where a
  // 5s auto-reset already runs (BR-RK-02 not-found).
  const { idleSecondsRemaining, reset: resetIdle } = useKioskIdle({
    enabled: ctx.resultKind === 'found',
    onIdle: () => ctx.resetToInput(),
  });

  // BR-RK-02: not-found auto-reset after 5s.
  useEffect(() => {
    if (ctx.resultKind !== 'not-found') return;
    const t = setTimeout(() => ctx.resetToInput(), KIOSK_CONFIG.NOT_FOUND_AUTO_RESET_MS);
    return () => clearTimeout(t);
  }, [ctx.resultKind, ctx]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-white" data-testid="kiosk-result-screen">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <button
          type="button"
          onClick={ctx.resetToInput}
          aria-label={KIOSK_COPY.result.lookupAnother}
          className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 font-bold text-stone-700 transition-transform active:scale-95"
          style={{
            minHeight: `${KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
            touchAction: 'manipulation',
          }}
          data-testid="kiosk-lookup-another"
        >
          <RotateCcw className="h-5 w-5" aria-hidden />
          <span>{KIOSK_COPY.result.lookupAnother}</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={ctx.toggleSound}
            aria-label={ctx.soundEnabled ? KIOSK_COPY.input.soundOn : KIOSK_COPY.input.soundOff}
            aria-pressed={ctx.soundEnabled}
            className="flex items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-700 transition-transform active:scale-95"
            style={{
              minHeight: `${KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
              minWidth: `${KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
              touchAction: 'manipulation',
            }}
            data-testid="kiosk-sound-toggle-result"
          >
            {ctx.soundEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </button>
          <KioskExitButton onClick={() => void ctx.exitKiosk()} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4">
        {ctx.resultKind === 'found' && ctx.result?.data && (
          <KioskResultCard data={ctx.result.data} />
        )}

        {ctx.resultKind === 'not-found' && (
          <div className="rounded-3xl border-2 border-rose-300 bg-rose-50 p-8 text-center" data-testid="kiosk-not-found">
            <AlertCircle className="mx-auto h-12 w-12 text-rose-500" aria-hidden />
            <div className="mt-4 text-2xl font-bold text-rose-700">
              {KIOSK_COPY.result.notFound}
            </div>
            <div className="mt-2 font-mono text-6xl font-bold text-rose-900">
              {ctx.bib || '—'}
            </div>
            <div className="mt-6 text-sm text-rose-600">
              {KIOSK_COPY.result.notFoundHint(KIOSK_CONFIG.NOT_FOUND_AUTO_RESET_MS / 1000)}
            </div>
          </div>
        )}

        {ctx.resultKind === 'data-error' && (
          <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-8 text-center" data-testid="kiosk-data-error">
            <AlertCircle className="mx-auto h-12 w-12 text-amber-500" aria-hidden />
            <div className="mt-4 text-2xl font-bold text-amber-800">
              {KIOSK_COPY.result.dataError}
            </div>
            <button
              type="button"
              onClick={ctx.resetToInput}
              className="mt-6 rounded-xl bg-[#FF0E65] px-6 py-3 font-bold text-white transition-transform active:scale-95"
              data-testid="kiosk-data-error-retry"
            >
              {KIOSK_COPY.input.retry}
            </button>
          </div>
        )}
      </main>

      <KioskIdleOverlay secondsRemaining={idleSecondsRemaining} onDismiss={resetIdle} />
    </div>
  );
}
