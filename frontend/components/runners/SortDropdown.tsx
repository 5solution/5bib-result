'use client';

/**
 * Sort dropdown. Tiny client component — onChange replaces URL search-param
 * `sort=` and resets page=1, preserving all other params via current URL.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

import { SORT_LABEL, type SortKey } from './types';

const SORT_OPTIONS: SortKey[] = ['az', 'newest', 'mostRaces', 'fastestPR'];

export default function SortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = (sp.get('sort') as SortKey | null) ?? 'az';

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(sp.toString());
      params.set('sort', e.target.value);
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-mono font-bold uppercase text-[11px] tracking-[0.18em] text-stone-500">
        Sort
      </span>
      <select
        value={current}
        onChange={onChange}
        className="px-3 py-2 border border-stone-300 rounded-md bg-white font-body text-[13px] text-stone-900 focus:border-blue-700 focus:ring-1 focus:ring-blue-700 outline-none cursor-pointer"
        aria-label="Sắp xếp danh sách VĐV"
      >
        {SORT_OPTIONS.map((k) => (
          <option key={k} value={k}>
            {SORT_LABEL[k]}
          </option>
        ))}
      </select>
    </label>
  );
}
