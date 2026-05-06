"use client";

/**
 * F-007 placeholder — Result Kiosk tab. Full impl ships in F-011.
 */

import { PlaceholderPage } from "@/components/race-ops-shell/PlaceholderPage";

export default function ResultKioskPlaceholder() {
  return (
    <PlaceholderPage
      eyebrow="RACE · RESULT KIOSK"
      meta="Verify & publish race results"
      featureBadge="F-011 · Sau cluster"
      comingSoonTitle="Coming soon — Result Kiosk"
      description="Kiosk verify-and-publish kết quả: queue chưa verify, side-by-side timing diff, publish workflow + audit trail."
    />
  );
}
