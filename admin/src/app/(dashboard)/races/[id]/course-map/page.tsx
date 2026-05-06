"use client";

/**
 * F-007 placeholder — Course Map tab (Canvas 02). Full impl ships in F-009 as
 * a standalone page (replaces the F-006 CourseDialog modal).
 *
 * BR-AF-22: F-006 modal is kept alive parallel during transition; today users
 * still configure courses via Settings → Cự ly until F-009 lands.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { PlaceholderPage } from "@/components/race-ops-shell/PlaceholderPage";

export default function CourseMapPlaceholder() {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? "");
  return (
    <PlaceholderPage
      variant="white"
      eyebrow="RACE · COURSE MAP"
      meta="Cấu hình route & checkpoints"
      featureBadge="F-009 · Sau F-008"
      comingSoonTitle="Coming soon — Standalone Course Map"
      description="Trang bản đồ độc lập theo Canvas 02: course pills 5K/10K/21K/42K, polyline magenta, checkpoint right panel, elevation profile. Đến khi F-009 ship, dùng tab Settings → Cự ly để cấu hình courses & GPX."
      extra={
        <Link href={`/races/${raceId}/settings`}>
          <Button size="sm" variant="outline" className="mt-1">
            Đi tới Settings · Cự ly
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        </Link>
      }
    />
  );
}
