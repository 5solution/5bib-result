'use client';

/**
 * F-015 — Multi-input single-screen lookup (BA Reco CK-01).
 *
 * Layout: Big "Quét QR" CTA → "hoặc" divider → BIB number pad → collapsed
 * "Nhập 4 số cuối CMND/CCCD" link expanding inline to 4-digit pad.
 *
 * Priority: QR > BIB > CMND. All 3 modes coexist on one screen — BTC chooses
 * whichever input is fastest given athlete's available info.
 */

import { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { CHECKIN_CONFIG } from '../checkin.constant';
import { CHECKIN_COPY } from '../checkin.microcopy';
import { useCheckInContext } from './CheckInModeProvider';
import { QRScanner } from './QRScanner';
import { CMNDLastFourInput } from './CMNDLastFourInput';

interface MultiInputLookupProps {
  loading: boolean;
  onSubmitBib: () => void;
  onSubmitCmnd: () => void;
  onScannedQr: (payload: string) => void;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function MultiInputLookup({
  loading,
  onSubmitBib,
  onSubmitCmnd,
  onScannedQr,
}: MultiInputLookupProps) {
  const ctx = useCheckInContext();
  const [scanning, setScanning] = useState(false);

  return (
    <div className="flex flex-col gap-6" data-testid="multi-input-lookup">
      {scanning ? (
        <QRScanner
          onResult={(text) => {
            setScanning(false);
            onScannedQr(text);
          }}
          onClose={() => setScanning(false)}
        />
      ) : null}

      {/* QR primary CTA */}
      <button
        type="button"
        onClick={() => setScanning(true)}
        disabled={loading}
        className="flex h-[120px] w-full max-w-md items-center justify-center gap-3 self-center rounded-2xl bg-[#FF0E65] text-2xl font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
        style={{ minWidth: '320px' }}
        data-testid="qr-primary-cta"
      >
        <ScanLine className="h-7 w-7" aria-hidden />
        {CHECKIN_COPY.input.qrButton}
      </button>

      {/* OR divider */}
      <div className="flex items-center gap-3 text-sm text-stone-500">
        <div className="h-px flex-1 bg-stone-300" />
        <span>{CHECKIN_COPY.input.orDivider}</span>
        <div className="h-px flex-1 bg-stone-300" />
      </div>

      {/* BIB pad */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm" data-testid="bib-pad-section">
        <h2 className="mb-3 text-lg font-bold text-stone-900">{CHECKIN_COPY.input.bibPadTitle}</h2>
        <div
          className="mb-3 min-h-[64px] rounded-lg border-2 border-stone-200 bg-stone-50 p-3 text-center font-mono text-4xl font-bold tabular-nums text-stone-900"
          aria-live="polite"
          data-testid="bib-readout"
        >
          {ctx.bibInput || <span className="opacity-30">{CHECKIN_COPY.input.bibPlaceholder}</span>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DIGITS.map((d) => (
            <button
              key={d}
              type="button"
              disabled={loading || ctx.bibInput.length >= CHECKIN_CONFIG.BIB_MAX_LENGTH}
              onClick={() => ctx.appendBibDigit(d)}
              aria-label={CHECKIN_COPY.input.digitLabel(parseInt(d, 10))}
              className="rounded-md bg-stone-50 py-3 font-mono text-xl font-bold text-stone-900 active:scale-95 disabled:opacity-40"
              data-testid={`bib-digit-${d}`}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={ctx.clearBib}
            disabled={loading || ctx.bibInput.length === 0}
            className="rounded-md bg-stone-100 py-3 text-sm font-bold text-stone-700 disabled:opacity-40"
            data-testid="bib-clear"
          >
            {CHECKIN_COPY.input.clearLabel}
          </button>
          <button
            key="0"
            type="button"
            disabled={loading || ctx.bibInput.length >= CHECKIN_CONFIG.BIB_MAX_LENGTH}
            onClick={() => ctx.appendBibDigit('0')}
            aria-label={CHECKIN_COPY.input.digitLabel(0)}
            className="rounded-md bg-stone-50 py-3 font-mono text-xl font-bold text-stone-900 active:scale-95 disabled:opacity-40"
            data-testid="bib-digit-0"
          >
            0
          </button>
          <button
            type="button"
            onClick={ctx.bibBackspace}
            disabled={loading || ctx.bibInput.length === 0}
            className="rounded-md bg-stone-100 py-3 text-sm font-bold text-stone-700 disabled:opacity-40"
            data-testid="bib-backspace"
          >
            {CHECKIN_COPY.input.backspaceLabel}
          </button>
        </div>
        <button
          type="button"
          onClick={onSubmitBib}
          disabled={loading || ctx.bibInput.length === 0}
          className="mt-3 w-full rounded-md bg-[#FF0E65] py-3 text-base font-bold text-white disabled:bg-stone-300"
          data-testid="bib-submit"
        >
          {CHECKIN_COPY.input.bibSubmit}
        </button>
      </div>

      {/* CMND collapsible */}
      <div className="rounded-2xl border border-stone-200 bg-white p-3" data-testid="cmnd-section">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-medium text-stone-700 hover:underline"
          onClick={ctx.toggleCmndExpand}
          data-testid="cmnd-expand-toggle"
        >
          {ctx.cmndExpanded ? CHECKIN_COPY.input.cmndCollapse : CHECKIN_COPY.input.cmndExpand}
        </button>
        {ctx.cmndExpanded ? (
          <div className="mt-3">
            <CMNDLastFourInput
              value={ctx.cmndInput}
              onAppend={ctx.appendCmndDigit}
              onBackspace={ctx.cmndBackspace}
              onClear={ctx.clearCmnd}
              onSubmit={onSubmitCmnd}
              disabled={loading}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
