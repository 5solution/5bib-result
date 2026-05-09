"use client";

/**
 * F-007 placeholder — Readiness tab (Canvas 01). Full impl ships in F-010.
 * F-019 v2 — extends placeholder với AGEligibilityCard (DOB coverage report)
 *   theo PAUSE-MGR-V2-03 LOCKED: nhúng vào tab Readiness existing, KHÔNG tạo tab mới.
 */

import { useParams } from "next/navigation";
import { PlaceholderPage } from "@/components/race-ops-shell/PlaceholderPage";
import { AGEligibilityCard } from "./components/AGEligibilityCard";

export default function ReadinessPlaceholder() {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? "");

  return (
    <div className="space-y-6">
      {raceId && (
        <div className="px-6 pt-6">
          <AGEligibilityCard raceId={raceId} />
        </div>
      )}
      <PlaceholderPage
        variant="pink"
        eyebrow="RACE · PRE-RACE READINESS"
        meta="Pre-race operations checklist"
        featureBadge="F-010 · Sprint sắp tới"
        comingSoonTitle="Coming soon — Readiness Checklist"
        description="Hệ thống checklist 2 cột (automated + manual) với progress 6/8, badge NOT READY/READY. Wire dữ liệu chip mapping, master-data, certificates, và dashboard live cho team BTC."
      />
    </div>
  );
}
