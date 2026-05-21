/**
 * Server-rendered link-based pagination for /runners.
 * RSC. Preserves searchParams. Max 5 visible page numbers + ellipsis on
 * either side. ← prev / [1] [2] … [N] / next →
 */

import Link from 'next/link';

import type { RunnersSearchParams } from './types';

interface Props {
  currentPage: number;
  totalPages: number;
  searchParams: RunnersSearchParams;
}

function buildHref(sp: RunnersSearchParams, page: number): string {
  const params = new URLSearchParams();
  if (sp.letter) params.set('letter', sp.letter);
  if (sp.province) params.set('province', sp.province);
  if (sp.gender) params.set('gender', sp.gender);
  if (sp.ageGroup) params.set('ageGroup', sp.ageGroup);
  if (sp.specialty) params.set('specialty', sp.specialty);
  if (sp.minRaces) params.set('minRaces', sp.minRaces);
  if (sp.maxRaces) params.set('maxRaces', sp.maxRaces);
  if (sp.sort) params.set('sort', sp.sort);
  params.set('page', String(page));
  return `/runners?${params.toString()}`;
}

/** Build page-number sequence with ellipsis (max 5 visible numbers) */
function buildSeq(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export default function Pagination({
  currentPage,
  totalPages,
  searchParams,
}: Props) {
  if (totalPages <= 1) return null;
  const seq = buildSeq(currentPage, totalPages);
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2 mt-10 flex-wrap"
    >
      {/* Prev */}
      {prevDisabled ? (
        <span
          aria-disabled
          className="px-4 py-2 font-mono font-bold uppercase text-[12px] tracking-wider text-stone-300 border border-stone-200 rounded-md cursor-not-allowed"
        >
          ← Prev
        </span>
      ) : (
        <Link
          href={buildHref(searchParams, currentPage - 1)}
          className="px-4 py-2 font-mono font-bold uppercase text-[12px] tracking-wider text-stone-700 border border-stone-300 rounded-md hover:border-blue-700 hover:text-blue-700 transition-colors"
        >
          ← Prev
        </Link>
      )}

      {/* Numbers */}
      {seq.map((tok, i) => {
        if (tok === '...') {
          return (
            <span
              key={`gap-${i}`}
              className="px-2 font-mono text-stone-400 select-none"
              aria-hidden
            >
              …
            </span>
          );
        }
        const active = tok === currentPage;
        return active ? (
          <span
            key={tok}
            aria-current="page"
            className="w-10 h-10 inline-flex items-center justify-center font-heading font-black text-[14px] bg-blue-700 text-white rounded-md"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {tok}
          </span>
        ) : (
          <Link
            key={tok}
            href={buildHref(searchParams, tok)}
            className="w-10 h-10 inline-flex items-center justify-center font-heading font-bold text-[14px] text-stone-700 border border-stone-300 rounded-md hover:border-blue-700 hover:text-blue-700 transition-colors"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {tok}
          </Link>
        );
      })}

      {/* Next */}
      {nextDisabled ? (
        <span
          aria-disabled
          className="px-4 py-2 font-mono font-bold uppercase text-[12px] tracking-wider text-stone-300 border border-stone-200 rounded-md cursor-not-allowed"
        >
          Next →
        </span>
      ) : (
        <Link
          href={buildHref(searchParams, currentPage + 1)}
          className="px-4 py-2 font-mono font-bold uppercase text-[12px] tracking-wider text-stone-700 border border-stone-300 rounded-md hover:border-blue-700 hover:text-blue-700 transition-colors"
        >
          Next →
        </Link>
      )}
    </nav>
  );
}
