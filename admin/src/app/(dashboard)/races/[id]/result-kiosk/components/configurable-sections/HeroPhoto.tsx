'use client';

import Image from 'next/image';
import type { AthleteDetailData } from '../../kiosk.types';

interface Props {
  data: AthleteDetailData;
  themeColor: string;
}

export function HeroPhoto({ data, themeColor }: Props) {
  const avatarUrl = (data as Record<string, unknown>).avatarUrl as string | undefined;
  return (
    <div
      className="flex flex-col items-center justify-center rounded-3xl p-6 text-center"
      style={{ borderColor: themeColor, borderWidth: 2 }}
      data-testid="hero-photo"
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={data.name || 'Athlete'}
          width={200}
          height={200}
          className="h-48 w-48 rounded-full object-cover"
          unoptimized
        />
      ) : (
        <div
          className="flex h-48 w-48 items-center justify-center rounded-full text-5xl font-bold"
          style={{ backgroundColor: themeColor + '20', color: themeColor }}
        >
          {(data.name || '?').charAt(0).toUpperCase()}
        </div>
      )}
      <div className="mt-4 text-2xl font-bold text-stone-800">{data.name || '—'}</div>
    </div>
  );
}
