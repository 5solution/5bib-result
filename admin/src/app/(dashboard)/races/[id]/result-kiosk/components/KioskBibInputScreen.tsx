'use client';

/**
 * F-013 Surface 2 — BIB input screen rendered when kiosk mode is active and
 * no result has been looked up yet (or after "Tìm BIB khác").
 *
 * Layout (centered):
 *   - Top-right: KioskExitButton + sound toggle
 *   - Top-center: race / course label (verifies BTC mounted right race)
 *   - Center: BIB input display (text-6xl mono) + BibNumberPad
 *   - Bottom: 5BIB micro-credit footer
 *
 * Idle reset wiring lives in KioskResultScreen, not here — Surface 2 is the
 * "home" already so idle reset is a no-op here. We DO mount the idle hook
 * defensively to clear any stale countdown state when transitioning back.
 */

import { Volume2, VolumeX } from 'lucide-react';
import { useKioskContext } from './KioskModeProvider';
import { BibNumberPadFallback } from './BibNumberPad';
import { KioskExitButton } from './KioskExitButton';
import { KIOSK_COPY } from '../kiosk.microcopy';
import { KIOSK_CONFIG } from '../kiosk.constant';

interface KioskBibInputScreenProps {
  raceTitle: string;
  courseName?: string;
}

export function KioskBibInputScreen({ raceTitle, courseName }: KioskBibInputScreenProps) {
  const ctx = useKioskContext();

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white" data-testid="kiosk-bib-input-screen">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <div className="text-sm font-medium text-stone-500" data-testid="kiosk-race-line">
          {KIOSK_COPY.input.raceLine(raceTitle, courseName)}
        </div>
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
            data-testid="kiosk-sound-toggle"
          >
            {ctx.soundEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </button>
          <KioskExitButton onClick={() => void ctx.exitKiosk()} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4">
        <h1 className="text-3xl font-bold text-stone-900">{KIOSK_COPY.input.title}</h1>
        <div
          className="mt-6 mb-4 min-h-[5rem] w-full rounded-2xl border-2 border-stone-200 bg-stone-50 p-4 text-center font-mono text-6xl font-bold tabular-nums text-stone-900"
          data-testid="kiosk-bib-readout"
          aria-live="polite"
        >
          {ctx.bib || <span className="opacity-30">{KIOSK_COPY.input.placeholder}</span>}
        </div>
        <BibNumberPadFallback
          value={ctx.bib}
          onAppend={ctx.appendDigit}
          onBackspace={ctx.backspace}
          onClear={ctx.clearBib}
          onSubmit={() => void ctx.submitBib()}
          disabled={ctx.loading}
        />
      </main>

      <footer className="p-4 text-center text-xs text-stone-400">
        {KIOSK_COPY.input.poweredBy}
      </footer>
    </div>
  );
}
