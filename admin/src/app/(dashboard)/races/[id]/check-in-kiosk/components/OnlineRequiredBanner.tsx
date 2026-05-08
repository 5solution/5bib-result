'use client';

/**
 * F-015 — Phase 1 explicit "online required" banner.
 *
 * BA Recommendation CK-03 LOCKED: offline mode deferred to Phase 2.
 * This banner is the single point of communication telling BTC the kiosk
 * needs realtime connectivity. TD-F015-03 (offline+SSE-reconnect retry)
 * tracks the upgrade path.
 */

import { Wifi } from 'lucide-react';
import { CHECKIN_COPY } from '../checkin.microcopy';

interface OnlineRequiredBannerProps {
  visible: boolean;
}

export function OnlineRequiredBanner({ visible }: OnlineRequiredBannerProps) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
      data-testid="online-required-banner"
    >
      <Wifi className="size-4 shrink-0" aria-hidden />
      <span>{CHECKIN_COPY.banners.onlineRequired}</span>
    </div>
  );
}
