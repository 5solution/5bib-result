'use client';

/** Infinite marquee with race brands. CSS-driven loop + small running mascot
 *  inserted between every couple items. */
import { S2MascotInline } from './s2-mascot-runner';

const RACES = [
  { name: 'VnExpress Marathon', acc: 'Marathon' },
  { name: 'VTV-LPBank Marathon', acc: 'LPBank' },
  { name: 'Race Jungle Series', acc: 'Jungle' },
  { name: 'Color Run Vietnam', acc: 'Color' },
  { name: 'TNG Trail', acc: 'TNG' },
  { name: 'UBND Cát Hải Run', acc: 'Cát Hải' },
];

export function S2Marquee() {
  // Duplicate for seamless loop
  const items = [...RACES, ...RACES];
  return (
    <div className="s2-marquee" aria-hidden="true">
      <div className="s2-marquee-track">
        {items.map((r, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 28 }}>
            <span>
              {r.name.split(r.acc)[0]}
              <span className="acc">{r.acc}</span>
              {r.name.split(r.acc)[1]}
            </span>
            {i % 2 === 0 ? (
              <S2MascotInline size={56} style={{ marginLeft: 16 }} />
            ) : (
              <span style={{ color: 'var(--s2-magenta)' }}>✦</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
