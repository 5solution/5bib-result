/**
 * F-009 CourseMapFullpageLinkCard — Settings tab additive nav card.
 *
 * Inserted ABOVE legacy CourseDialog trigger (settings/page.tsx line 1145)
 * per BR-AF-23 byte-for-byte preserve. Pattern carryover from F-008 v2
 * SettingsLinkCardsSection.
 *
 * Server Component — no client hooks. `raceId` required to build href.
 */

import Link from 'next/link';
import { ChevronRight, Map } from 'lucide-react';

export interface CourseMapFullpageLinkCardProps {
  raceId: string;
}

export function CourseMapFullpageLinkCard({
  raceId,
}: CourseMapFullpageLinkCardProps) {
  return (
    <Link
      href={`/races/${raceId}/course-map`}
      className="group mb-4 flex items-start gap-3 rounded-[14px] border bg-white p-4 transition-all hover:border-[#FF0E65] hover:shadow-md"
      style={{ borderColor: 'var(--5s-border, #e7e5e4)' }}
      data-testid="course-map-fullpage-link-card"
    >
      <div
        className="grid size-10 shrink-0 place-items-center rounded-md"
        style={{ background: 'var(--5s-surface, #F3F0EB)' }}
      >
        <Map className="h-5 w-5 text-stone-700" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3
            className="text-sm font-bold tracking-tight text-stone-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Mở Course Map fullpage
          </h3>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
        <p className="mt-1 text-xs text-stone-600">
          Trang bản đồ độc lập theo Canvas 02 — course pills, polyline magenta,
          checkpoint grid + drag mode. Modal Cự ly bên dưới sẽ được retire trong
          30 ngày.
        </p>
      </div>
    </Link>
  );
}
