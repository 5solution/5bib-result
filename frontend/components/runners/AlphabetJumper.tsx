/**
 * Horizontal A→Z letter jumper pills with athlete counts per letter.
 * RSC, link-based. Clicking a letter navigates to /runners?letter=X&page=1
 * preserving other filters via searchParams pass-through.
 */

import Link from 'next/link';

import type { RunnersSearchParams } from './types';

interface Props {
  /** byLetter map from /athletes endpoint */
  byLetter: Record<string, number>;
  /** currently selected letter (from URL ?letter) */
  active?: string;
  /** full searchParams object — used to preserve province/gender/etc. */
  searchParams: RunnersSearchParams;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Build href preserving filters but resetting page + setting/removing letter */
function buildHref(
  sp: RunnersSearchParams,
  letter: string | null,
): string {
  const params = new URLSearchParams();
  // pass through non-letter, non-page filters
  if (sp.province) params.set('province', sp.province);
  if (sp.gender) params.set('gender', sp.gender);
  if (sp.ageGroup) params.set('ageGroup', sp.ageGroup);
  if (sp.specialty) params.set('specialty', sp.specialty);
  if (sp.minRaces) params.set('minRaces', sp.minRaces);
  if (sp.maxRaces) params.set('maxRaces', sp.maxRaces);
  if (sp.sort) params.set('sort', sp.sort);
  if (letter) params.set('letter', letter);
  params.set('page', '1');
  const qs = params.toString();
  return qs ? `/runners?${qs}` : '/runners';
}

export default function AlphabetJumper({
  byLetter,
  active,
  searchParams,
}: Props) {
  const allCount = Object.values(byLetter).reduce((s, n) => s + n, 0);

  return (
    <nav
      aria-label="Lọc theo chữ cái đầu"
      className="bg-white border-y border-stone-200"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-5 md:py-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
          {/* All / A→Z reset */}
          <Link
            href={buildHref(searchParams, null)}
            className={`shrink-0 px-3 py-2 rounded-md font-mono font-bold text-[11px] uppercase tracking-[0.15em] border transition-colors ${
              !active
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
            }`}
            title={`Hiển thị tất cả ${allCount.toLocaleString('vi-VN')} VĐV`}
          >
            A→Z
          </Link>

          {/* 26 letter pills */}
          {LETTERS.map((L) => {
            const count = byLetter[L] ?? 0;
            const isActive = active === L;
            const isEmpty = count === 0;
            return (
              <Link
                key={L}
                href={isEmpty ? '#' : buildHref(searchParams, L)}
                aria-disabled={isEmpty}
                tabIndex={isEmpty ? -1 : undefined}
                className={`shrink-0 inline-flex flex-col items-center justify-center w-12 h-14 rounded-md border transition-colors ${
                  isActive
                    ? 'bg-blue-700 text-white border-blue-700 ring-2 ring-blue-700 ring-offset-2'
                    : isEmpty
                      ? 'bg-stone-50 text-stone-300 border-stone-200 cursor-not-allowed pointer-events-none'
                      : 'bg-white text-stone-900 border-stone-300 hover:border-blue-600 hover:bg-blue-50'
                }`}
                title={`${L} · ${count.toLocaleString('vi-VN')} VĐV`}
              >
                <span
                  className="font-heading font-black text-[16px] leading-none"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {L}
                </span>
                <span
                  className={`font-mono text-[9px] mt-1 leading-none ${
                    isActive
                      ? 'text-white/80'
                      : isEmpty
                        ? 'text-stone-300'
                        : 'text-stone-500'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {count > 999 ? `${Math.round(count / 1000)}k` : count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
