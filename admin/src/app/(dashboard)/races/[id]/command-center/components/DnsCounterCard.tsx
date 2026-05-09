/**
 * F-008 — DNS Counter Card (Command Center summary card slot 4).
 *
 * Server Component (presentational). Per BR-CC-01 canonical order:
 *   [1] Racekit  [2] Started  [3] Finished  [4] DNS  [5] Miss Rate  [6] Throughput
 *
 * Data shape: simple count from snapshot.dnsCount (BR-CC-02 backend formula).
 */

import type { JSX } from 'react';

interface DnsCounterCardProps {
  count: number;
}

export function DnsCounterCard({ count }: DnsCounterCardProps): JSX.Element {
  return (
    <div
      className="flex min-w-[140px] flex-col rounded-[14px] border bg-white p-4"
      style={{
        borderColor: 'var(--5s-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
      data-testid="dns-counter-card"
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded"
          style={{ background: '#78716C' }}
        />
        <div
          className="text-[10px] font-extrabold uppercase tracking-[.12em] text-stone-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          DNS
        </div>
      </div>
      <div
        className="text-2xl font-bold leading-none text-stone-900"
        style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}
        data-testid="dns-count-value"
      >
        {count.toLocaleString('vi-VN')}
      </div>
      <div className="mt-1 text-[11px] text-stone-500">
        Không xuất phát
      </div>
    </div>
  );
}
