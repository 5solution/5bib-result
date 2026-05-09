'use client';

import { Trophy } from 'lucide-react';
import type { AthleteDetailData } from '../../kiosk.types';
import { KIOSK_COPY } from '../../kiosk.microcopy';

interface Props {
  data: AthleteDetailData;
  themeColor: string;
}

export function HeroRank({ data, themeColor }: Props) {
  const rank = data.overallRank || KIOSK_COPY.result.rankPlaceholder;
  return (
    <div
      className="flex flex-col items-center justify-center rounded-3xl p-6 text-center"
      style={{ backgroundColor: themeColor + '10', borderColor: themeColor }}
      data-testid="hero-rank"
    >
      <Trophy className="h-12 w-12" style={{ color: themeColor }} aria-hidden />
      <div className="mt-2 text-xs uppercase tracking-wide text-stone-500">
        {KIOSK_COPY.result.overallRankLabel}
      </div>
      <div
        className="font-mono text-7xl font-bold tabular-nums"
        style={{ color: themeColor }}
      >
        {rank}
      </div>
    </div>
  );
}
