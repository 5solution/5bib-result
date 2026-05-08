/**
 * F-008 v2 BR-CC2-19 — Race status pill rendered inline above SummaryCardsRow.
 *
 * Distinct from F-007 RaceLiveTimer (sticky shell header running clock):
 * this is a status badge only — DRAFT / PRE-RACE / LIVE / ENDED — for body
 * context. Live status pulses magenta (BR-CC2 inherit canvas pattern).
 *
 * Server Component compatible — no client hooks. Receives `status` as prop.
 */

import { vnLabel } from '@/lib/vn-microcopy';

export interface RaceStatusPillProps {
  status: 'draft' | 'pre_race' | 'live' | 'ended' | string;
}

interface PillStyle {
  bg: string;
  fg: string;
  border: string;
  pulse: boolean;
}

const STATUS_STYLE: Record<string, PillStyle> = {
  live: { bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5', pulse: true },
  ended: { bg: '#E7E5E4', fg: '#44403C', border: '#D6D3D1', pulse: false },
  pre_race: { bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D', pulse: false },
  draft: { bg: '#F3F0EB', fg: '#44403C', border: '#D6D3D1', pulse: false },
};

const FALLBACK: PillStyle = {
  bg: '#F3F0EB',
  fg: '#44403C',
  border: '#D6D3D1',
  pulse: false,
};

export function RaceStatusPill({ status }: RaceStatusPillProps) {
  const style = STATUS_STYLE[status] ?? FALLBACK;
  const label = vnLabel(status, status.toUpperCase());
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider"
      style={{
        background: style.bg,
        color: style.fg,
        borderColor: style.border,
      }}
      data-testid="race-status-pill"
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: style.fg,
          animation: style.pulse ? 'ro-blink 1.4s infinite' : 'none',
        }}
      />
      {label}
    </span>
  );
}
