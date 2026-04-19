'use client';

/**
 * F-04 — Country Rank Badge ("Đồng Hương").
 *
 * Shows an athlete's rank among same-nationality finishers on this course.
 * Option A behaviour: when the athlete is DNF (rank === null), the badge
 * is hidden entirely — we never show a DNF "sub-rank".
 */

import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { countryToFlag } from '@/lib/country-flags';
import { useCountryRank } from '@/lib/api-hooks';

interface Props {
  raceId: string;
  bib: string;
  /** Hide when total is 1 (unique country on course) to avoid noise. */
  hideIfAlone?: boolean;
}

export function CountryBadge({ raceId, bib, hideIfAlone = true }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useCountryRank(raceId, bib);

  if (isLoading || !data) return null;
  if (data.rank === null) return null; // Option A: DNF → hide
  if (hideIfAlone && data.total <= 1) return null;

  const flag = countryToFlag(data.iso2 || data.nationality);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm shadow-sm">
      <Users className="h-3.5 w-3.5 text-stone-500" />
      <span className="font-medium text-stone-700">
        {t('athlete.countryRank.label')}
      </span>
      {flag && <span className="text-base leading-none">{flag}</span>}
      <span className="font-mono text-stone-900">
        <strong>#{data.rank}</strong>
        <span className="text-stone-500">/{data.total}</span>
      </span>
    </div>
  );
}

export default CountryBadge;
