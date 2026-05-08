'use client';

/**
 * F-015 Surface 3 — fullscreen result + confirm.
 *
 * Surface lifecycle:
 *  - found → show preview + confirm CTA
 *  - already-picked → BR-CK-03 read-only warning, "Quay lại" only
 *  - submitting → preview + spinner button
 *  - success → 1.5s success animation → auto-redirect to lookup (handled by
 *    parent useEffect on confirm.kind === 'success')
 *  - conflict → 3s cooldown banner before re-enable input
 */

import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { CHECKIN_COPY } from '../checkin.microcopy';
import { CHECKIN_CONFIG } from '../checkin.constant';
import { useCheckInContext } from './CheckInModeProvider';
import { AthleteCheckInCard } from './AthleteCheckInCard';
import { ConfirmPickupButton } from './ConfirmPickupButton';
import { CheckInExitButton } from './CheckInExitButton';
import { MultiStationStatusBar } from './MultiStationStatusBar';
import type { CheckInStatsPayload } from '../checkin.types';

interface CheckInResultScreenProps {
  stats: CheckInStatsPayload | null;
  connected: boolean;
  fallbackPolling: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CheckInResultScreen({
  stats,
  connected,
  fallbackPolling,
  onConfirm,
  onCancel,
}: CheckInResultScreenProps) {
  const ctx = useCheckInContext();
  const athlete = ctx.selectedAthlete;
  const submitting = ctx.confirm.kind === 'submitting';
  const isSuccess = ctx.confirm.kind === 'success';
  const isAlready = athlete?.racekitReceived === true;
  const isConflict = ctx.confirm.kind === 'conflict';

  // Auto-return to lookup screen after success (BR-CK-04).
  useEffect(() => {
    if (!isSuccess) return;
    const t = window.setTimeout(() => ctx.goToLookup(), CHECKIN_CONFIG.SUCCESS_AUTO_RESET_MS);
    return () => window.clearTimeout(t);
  }, [isSuccess, ctx]);

  // Auto-return on 409 conflict after cooldown (BR-CK-05).
  useEffect(() => {
    if (!isConflict) return;
    const t = window.setTimeout(() => ctx.goToLookup(), CHECKIN_CONFIG.CONFLICT_COOLDOWN_MS);
    return () => window.clearTimeout(t);
  }, [isConflict, ctx]);

  if (!athlete) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-white"
      data-testid="check-in-result-screen"
    >
      <header className="flex items-center justify-between p-4 sm:p-6">
        <div className="text-sm font-medium text-stone-500">
          {CHECKIN_COPY.input.raceLine('', ctx.stationId)}
        </div>
        <CheckInExitButton onClick={() => void ctx.exitKiosk()} />
      </header>

      <MultiStationStatusBar
        stationId={ctx.stationId}
        stats={stats}
        connected={connected}
        fallbackPolling={fallbackPolling}
      />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-8 pt-4">
        {isSuccess ? (
          <div
            role="status"
            className="mb-4 flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4"
            data-testid="confirm-success-banner"
          >
            <CheckCircle2 className="size-6 text-emerald-700" aria-hidden />
            <div>
              <div className="text-lg font-bold text-emerald-900">
                {CHECKIN_COPY.result.successTitle}
              </div>
              <div className="text-sm text-emerald-800">
                {CHECKIN_COPY.result.successHint(Math.ceil(CHECKIN_CONFIG.SUCCESS_AUTO_RESET_MS / 1000))}
              </div>
            </div>
          </div>
        ) : null}

        {isConflict ? (
          <div
            role="alert"
            className="mb-4 flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-4"
            data-testid="confirm-conflict-banner"
          >
            <AlertTriangle className="size-6 text-amber-700" aria-hidden />
            <div>
              <div className="text-lg font-bold text-amber-900">
                {CHECKIN_COPY.result.conflictTitle}
              </div>
              <div className="text-sm text-amber-800">{CHECKIN_COPY.result.conflictHint}</div>
            </div>
          </div>
        ) : null}

        {ctx.confirm.kind === 'network-error' ? (
          <div
            role="alert"
            className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            data-testid="confirm-network-error"
          >
            <div className="text-base font-bold">{CHECKIN_COPY.result.networkErrorTitle}</div>
            <div>{CHECKIN_COPY.result.networkErrorHint}</div>
            <button
              type="button"
              className="mt-2 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-bold text-white"
              onClick={onConfirm}
              data-testid="retry-button"
            >
              {CHECKIN_COPY.result.retry}
            </button>
          </div>
        ) : null}

        <AthleteCheckInCard athlete={athlete} />

        {isAlready ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4"
            data-testid="already-picked-banner"
          >
            <div className="text-lg font-bold text-amber-900">{CHECKIN_COPY.result.alreadyTitle}</div>
            <div className="mt-1 text-sm text-amber-800">
              {CHECKIN_COPY.result.alreadyHint(
                athlete.racekitReceivedAt ?? '—',
                athlete.pickedUpAtStation ?? '—',
              )}
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800"
              data-testid="back-to-input"
            >
              {CHECKIN_COPY.result.backToInput}
            </button>
          </div>
        ) : !isSuccess && !isConflict ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <ConfirmPickupButton onClick={onConfirm} submitting={submitting} />
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-stone-500 underline"
              data-testid="cancel-link"
            >
              {CHECKIN_COPY.result.cancelButton}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
