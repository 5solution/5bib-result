'use client';

/**
 * F-015 — QR scanner overlay using `@zxing/browser` (dynamic import).
 *
 * Renders a fullscreen-modal video panel + Cancel button. Camera permission
 * prompt fires natively when start() runs (on Surface 2 "Quét QR" button
 * click — user-gesture-bound).
 *
 * BR-AF-23 verbatim port pattern reference: chip-verify-public client at
 * `frontend/app/chip-verify/[token]/components/ChipVerifyKioskClient.tsx`
 * — but F-015 uses webcam QR instead of chip-ID (different use case).
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CHECKIN_COPY } from '../checkin.microcopy';
import { useQRScanner } from '../hooks/useQRScanner';

interface QRScannerProps {
  onResult: (text: string) => void;
  onClose: () => void;
}

export function QRScanner({ onResult, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { scanning, start, stop, permissionDenied } = useQRScanner({
    onResult: (text) => {
      // Stop immediately to release camera before parent navigates surfaces.
      stop();
      onResult(text);
    },
  });

  useEffect(() => {
    if (videoRef.current) {
      void start(videoRef.current);
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="QR scanner"
      data-testid="qr-scanner-overlay"
    >
      <div className="flex items-center justify-between p-4">
        <span className="text-sm text-white/80">
          {permissionDenied
            ? CHECKIN_COPY.input.qrError
            : scanning
              ? CHECKIN_COPY.input.qrScanning
              : CHECKIN_COPY.input.qrHint}
        </span>
        <button
          type="button"
          onClick={() => {
            stop();
            onClose();
          }}
          className="flex items-center gap-2 rounded-md border-2 border-white/40 px-3 py-2 text-sm font-bold text-white"
          data-testid="qr-cancel"
        >
          <X className="h-4 w-4" aria-hidden />
          {CHECKIN_COPY.input.qrCancel}
        </button>
      </div>
      <div className="mx-auto flex flex-1 w-full max-w-2xl items-center justify-center p-4">
        <video
          ref={videoRef}
          className="aspect-square w-full max-w-md rounded-2xl bg-black object-cover"
          muted
          playsInline
          autoPlay
          data-testid="qr-video-stream"
        />
      </div>
    </div>
  );
}
