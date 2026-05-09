'use client';

/**
 * F-017 Phase 1 — placeholder. Real QR generation deferred to Phase 2 because
 * Manager STOP trigger forbids `npm install` (qrcode lib gap noted in
 * PAUSE-CODER-09 → TD-F017-QR-PHASE2). The placeholder still respects the
 * visibleSections.qrShare flag so admin can preview the layout slot.
 */

import { QrCode } from 'lucide-react';

interface Props {
  bib?: string | number;
  raceId?: string;
  themeColor: string;
}

export function QrShareSection({ themeColor }: Props) {
  return (
    <div
      className="flex flex-col items-center rounded-xl border border-stone-200 bg-white p-4"
      data-testid="qr-share-section"
    >
      <QrCode className="h-16 w-16" style={{ color: themeColor }} aria-hidden />
      <div className="mt-2 text-sm font-medium text-stone-600">QR coming Phase 2</div>
      <div className="text-xs text-stone-400">TD-F017-QR-PHASE2</div>
    </div>
  );
}
