/**
 * F-008 v2 BR-CC2-29 — Settings tab additive 2 link cards.
 *
 * Inserted ABOVE legacy 1678-line settings editor (BR-AF-23 byte-for-byte
 * preserve). Provides quick navigation from Settings tab to:
 *   1. Timing Alert config page (`/timing-alerts/config`)
 *   2. Poll logs page (`/timing-alerts/poll-logs`)
 *
 * Server Component — no client hooks. `raceId` is required to build href.
 */

import Link from 'next/link';
import { ChevronRight, Settings, FileText } from 'lucide-react';

export interface SettingsLinkCardsSectionProps {
  raceId: string;
}

export function SettingsLinkCardsSection({
  raceId,
}: SettingsLinkCardsSectionProps) {
  return (
    <section
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      data-testid="settings-link-cards-section"
    >
      <Link
        href={`/races/${raceId}/timing-alerts/config`}
        className="group flex items-start gap-3 rounded-[14px] border bg-white p-4 transition-all hover:border-[#FF0E65] hover:shadow-md"
        style={{ borderColor: 'var(--5s-border)' }}
      >
        <div
          className="grid size-10 shrink-0 place-items-center rounded-md"
          style={{ background: 'var(--5s-surface, #F3F0EB)' }}
        >
          <Settings className="h-5 w-5 text-stone-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className="text-sm font-bold tracking-tight text-stone-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Cấu hình Timing Alert
            </h3>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5" />
          </div>
          <p className="mt-1 text-xs text-stone-600">
            Bật/tắt monitoring, đặt poll interval, ngưỡng overdue, và top N
            CRITICAL.
          </p>
        </div>
      </Link>

      <Link
        href={`/races/${raceId}/timing-alerts/poll-logs`}
        className="group flex items-start gap-3 rounded-[14px] border bg-white p-4 transition-all hover:border-[#FF0E65] hover:shadow-md"
        style={{ borderColor: 'var(--5s-border)' }}
      >
        <div
          className="grid size-10 shrink-0 place-items-center rounded-md"
          style={{ background: 'var(--5s-surface, #F3F0EB)' }}
        >
          <FileText className="h-5 w-5 text-stone-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className="text-sm font-bold tracking-tight text-stone-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Poll logs
            </h3>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5" />
          </div>
          <p className="mt-1 text-xs text-stone-600">
            Lịch sử các lần poll RR API — debug khi alerts không lên đúng.
          </p>
        </div>
      </Link>
    </section>
  );
}
