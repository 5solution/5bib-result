'use client';

import { Clock } from 'lucide-react';
import type { AthleteDetailData } from '../../kiosk.types';
import { KIOSK_COPY } from '../../kiosk.microcopy';

interface Props {
  data: AthleteDetailData;
  themeColor: string;
}

export function HeroFinishTime({ data, themeColor }: Props) {
  const time = data.chipTime || KIOSK_COPY.result.rankPlaceholder;
  return (
    <div
      className="flex flex-col items-center justify-center rounded-3xl p-6 text-center"
      style={{ backgroundColor: themeColor + '10', borderColor: themeColor }}
      data-testid="hero-finish-time"
    >
      <Clock className="h-12 w-12" style={{ color: themeColor }} aria-hidden />
      <div className="mt-2 text-xs uppercase tracking-wide text-stone-500">
        {KIOSK_COPY.result.chipTimeLabel}
      </div>
      <div
        className="font-mono text-7xl font-bold tabular-nums"
        style={{ color: themeColor }}
      >
        {time}
      </div>
    </div>
  );
}
