/**
 * Big square monogram (40×40px-style scaled up) + top-3 name-prefix chips.
 * Shown above athlete grid when `?letter=` filter is active.
 * RSC, pure-presentational.
 */

import type { AthleteSummary } from './types';

interface Props {
  letter: string;
  /** athletes on current page — used to derive top-3 family-name prefixes */
  athletes: AthleteSummary[];
}

/** Extract top-3 distinct family-name (last token before given name) prefixes */
function derivePrefixes(athletes: AthleteSummary[]): string[] {
  const counts = new Map<string, number>();
  for (const a of athletes) {
    const parts = a.canonicalName.trim().split(/\s+/);
    // VN naming: family-name = first token (e.g., "NGUYỄN THỊ ANH" → "NGUYỄN")
    const family = parts[0]?.toUpperCase();
    if (!family) continue;
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
}

export default function LetterMonogramHeader({ letter, athletes }: Props) {
  const prefixes = derivePrefixes(athletes);

  return (
    <div className="flex items-center gap-4 mb-6">
      {/* Big square monogram */}
      <div
        className="shrink-0 flex items-center justify-center rounded-lg text-white font-heading font-black"
        style={{
          width: 56,
          height: 56,
          background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
          fontSize: 28,
          letterSpacing: '-0.04em',
        }}
        aria-label={`Vần ${letter}`}
      >
        {letter}
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-mono font-bold uppercase text-[10px] tracking-[0.2em] text-stone-500 mb-1">
          Họ phổ biến vần {letter}
        </div>
        <div className="font-heading font-black uppercase text-stone-900 text-[18px] truncate">
          {prefixes.length > 0 ? (
            prefixes.map((p, i) => (
              <span key={p}>
                {p}
                {i < prefixes.length - 1 ? (
                  <span className="text-stone-300 mx-2">·</span>
                ) : null}
              </span>
            ))
          ) : (
            <span className="text-stone-400 italic font-normal">
              Chưa có VĐV ở vần này
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
