"use client";

/**
 * F-007 placeholder — Readiness tab (Canvas 01). Full impl ships in F-010.
 */

import { PlaceholderPage } from "@/components/race-ops-shell/PlaceholderPage";

export default function ReadinessPlaceholder() {
  return (
    <PlaceholderPage
      variant="pink"
      eyebrow="RACE · PRE-RACE READINESS"
      meta="Pre-race operations checklist"
      featureBadge="F-010 · Sprint sắp tới"
      comingSoonTitle="Coming soon — Readiness Checklist"
      description="Hệ thống checklist 2 cột (automated + manual) với progress 6/8, badge NOT READY/READY. Wire dữ liệu chip mapping, master-data, certificates, và dashboard live cho team BTC."
    />
  );
}
