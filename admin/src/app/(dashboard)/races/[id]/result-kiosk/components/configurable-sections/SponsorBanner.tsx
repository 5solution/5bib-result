'use client';

import Image from 'next/image';

interface Props {
  logos: string[];
}

export function SponsorBanner({ logos }: Props) {
  if (!logos || logos.length === 0) return null;
  return (
    <div
      className="flex items-center justify-center gap-6 rounded-xl border border-stone-200 bg-white p-4"
      data-testid="sponsor-banner"
    >
      {logos.map((url) => (
        <div key={url} className="relative h-12 w-24">
          <Image
            src={url}
            alt="Sponsor logo"
            fill
            sizes="96px"
            className="object-contain"
            unoptimized
          />
        </div>
      ))}
    </div>
  );
}
