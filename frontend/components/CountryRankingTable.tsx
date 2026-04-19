'use client';

/**
 * F-04 — Country Ranking Table.
 *
 * Collapsible ranking table showing top countries by finisher count on a
 * course, with best chip time per country. Renders inline in the ranking page.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Globe2, Loader2 } from 'lucide-react';
import { countryToFlag } from '@/lib/country-flags';
import { useCountryStats } from '@/lib/api-hooks';

interface Props {
  courseId: string;
  initialOpen?: boolean;
  topN?: number;
  /** Hide section entirely if total countries <= this value. Default 1 (only
   *  useful when there are 2+ nationalities to compare). */
  hideBelow?: number;
}

export function CountryRankingTable({
  courseId,
  initialOpen = false,
  topN = 10,
  hideBelow = 1,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(initialOpen);
  const [showAll, setShowAll] = useState(false);
  // Prefetch always so we can decide whether to render the section at all.
  // Data is tiny (top-N aggregate) and cached 120s server-side.
  const { data, isLoading, error } = useCountryStats(courseId, {
    enabled: !!courseId,
  });

  const countries = useMemo(() => {
    const list = data?.countries ?? [];
    return showAll ? list : list.slice(0, topN);
  }, [data, showAll, topN]);

  const totalCountries = data?.totalCountries ?? 0;

  // Hide the entire section when:
  //  - still resolving first fetch (avoid empty flash)
  //  - fetch errored (fail silently — supplementary section)
  //  - not enough countries to rank against each other
  if (isLoading && !data) return null;
  if (error) return null;
  if (totalCountries <= hideBelow) return null;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-stone-600" />
          <h3 className="font-heading text-lg font-semibold text-stone-900">
            {t('ranking.countryRanking.title')}
          </h3>
          {totalCountries > 0 && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-600">
              {totalCountries}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-stone-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-stone-500" />
        )}
      </button>

      {open && (
        <div className="border-t border-stone-200 px-5 py-4">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          )}

          {error && (
            <div className="py-4 text-center text-sm text-red-600">
              {t('common.error')}
            </div>
          )}

          {!isLoading && !error && countries.length === 0 && (
            <div className="py-6 text-center text-sm text-stone-500">
              {t('ranking.countryRanking.empty')}
            </div>
          )}

          {!isLoading && countries.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                      <th className="py-2 pr-3 text-left font-medium">#</th>
                      <th className="py-2 pr-3 text-left font-medium">
                        {t('ranking.countryRanking.country')}
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        {t('ranking.countryRanking.finishers')}
                      </th>
                      <th className="py-2 pl-3 text-right font-medium">
                        {t('ranking.countryRanking.bestTime')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {countries.map((c, idx) => {
                      const flag = countryToFlag(c.iso2 || c.nationality);
                      return (
                        <tr
                          key={`${c.nationality}-${idx}`}
                          className="border-b border-stone-100 last:border-0"
                        >
                          <td className="py-2.5 pr-3 font-mono text-stone-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center gap-2">
                              {flag && <span className="text-base">{flag}</span>}
                              <span className="font-medium text-stone-900">
                                {c.nationality}
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-stone-900">
                            {c.count}
                          </td>
                          <td className="py-2.5 pl-3 text-right font-mono text-stone-900">
                            {c.bestTime}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalCountries > topN && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAll((s) => !s)}
                    className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                  >
                    {showAll
                      ? t('ranking.countryRanking.showLess')
                      : t('ranking.countryRanking.showAll', {
                          count: totalCountries,
                        })}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default CountryRankingTable;
