/** Infinite marquee with race brands. CSS-driven, no JS. */
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
          <span key={i}>
            {r.name.split(r.acc)[0]}
            <span className="acc">{r.acc}</span>
            {r.name.split(r.acc)[1]}
            <span style={{ marginLeft: 56, color: 'var(--s2-magenta)' }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
