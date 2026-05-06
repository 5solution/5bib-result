"use client";

/**
 * F-007 placeholder — Athletes tab. Full impl ships in F-012 (athlete roster
 * + bib management + chip-mapping deep-link).
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { PlaceholderPage } from "@/components/race-ops-shell/PlaceholderPage";

export default function AthletesPlaceholder() {
  const params = useParams();
  const raceId = String((params as { id?: string }).id ?? "");
  return (
    <PlaceholderPage
      eyebrow="RACE · ATHLETES"
      meta="Roster & bib management"
      featureBadge="F-012 · Sau cluster"
      comingSoonTitle="Coming soon — Athletes Roster"
      description="Tab Athletes tổng hợp roster + bib + chip mapping + ghi chú race-day. Trong khi chờ F-012, dùng Master Data và Chip Verify hiện tại."
      extra={
        <div className="mt-1 flex flex-wrap gap-2">
          <Link href={`/races/${raceId}/master-data`}>
            <Button size="sm" variant="outline">
              Master Data
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </Link>
          <Link href={`/races/${raceId}/chip-mappings`}>
            <Button size="sm" variant="outline">
              Chip Verify
            </Button>
          </Link>
        </div>
      }
    />
  );
}
