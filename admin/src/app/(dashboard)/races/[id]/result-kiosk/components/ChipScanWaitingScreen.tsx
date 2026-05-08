'use client';

/**
 * F-017 Surface 2 (chip-scan primary) — fullscreen waiting screen with
 * pulsing reader icon. ChipScanInput is mounted as a sibling (headless
 * keydown listener); this screen is purely visual + provides "Nhập BIB
 * thủ công" fallback CTA.
 */

import { Volume2, VolumeX, Radio } from 'lucide-react';
import { useKioskContext } from './KioskModeProvider';
import { ChipScanInput } from './ChipScanInput';
import { KioskExitButton } from './KioskExitButton';
import { KIOSK_COPY } from '../kiosk.microcopy';
import { KIOSK_CONFIG } from '../kiosk.constant';

interface Props {
  raceTitle: string;
  courseName?: string;
  onChipScanned: (chipId: string) => void;
  onFallback: () => void;
}

export function ChipScanWaitingScreen({
  raceTitle,
  courseName,
  onChipScanned,
  onFallback,
}: Props) {
  const ctx = useKioskContext();

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-white"
      data-testid="kiosk-chip-scan-screen"
    >
      <ChipScanInput onScan={onChipScanned} disabled={ctx.loading} />

      <header className="flex items-center justify-between p-4 sm:p-6">
        <div className="text-sm font-medium text-stone-500" data-testid="kiosk-chip-race-line">
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
          >
            {ctx.soundEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </button>
          <KioskExitButton onClick={() => void ctx.exitKiosk()} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 text-center">
        <div
          className="motion-safe:animate-pulse rounded-full bg-rose-50 p-12"
          data-testid="kiosk-chip-pulse"
        >
          <Radio className="h-32 w-32 text-[#FF0E65]" aria-hidden />
        </div>
        <h1 className="mt-10 text-3xl font-bold text-stone-900" data-testid="kiosk-chip-title">
          {KIOSK_COPY.chip.waitingTitle}
        </h1>
        <p className="mt-3 text-base text-stone-500">{KIOSK_COPY.chip.waitingHint}</p>

        <button
          type="button"
          onClick={onFallback}
          className="mt-12 rounded-xl border-2 border-stone-300 bg-white px-6 py-4 font-bold text-stone-700 transition-transform active:scale-95"
          style={{
            minHeight: `${KIOSK_CONFIG.TAP_TARGET_MIN_PX}px`,
            touchAction: 'manipulation',
          }}
          data-testid="kiosk-chip-fallback-cta"
        >
          {KIOSK_COPY.chip.fallbackCta}
        </button>

        {ctx.loading && (
          <div className="mt-6 text-sm text-stone-500" data-testid="kiosk-chip-loading">
            Đang tra cứu...
          </div>
        )}
      </main>

      <footer className="p-4 text-center text-xs text-stone-400">
        {KIOSK_COPY.input.poweredBy}
      </footer>
    </div>
  );
}
