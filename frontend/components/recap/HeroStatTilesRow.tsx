/**
 * FEATURE-056 — Hero Stat Tiles Row.
 *
 * Server Component — 4 colored-accent stat tiles below the hero block.
 * Shared between Variation A (Editorial Magazine) and Variation B (Dashboard).
 */

const ACCENT_COLOR: Record<NonNullable<HeroStatTile['accent']>, string> = {
  blue: '#1d4ed8',
  magenta: '#FF0E65',
  orange: '#ea580c',
  green: '#166534',
};

export interface HeroStatTile {
  label: string;
  value: string;
  meta?: string;
  accent?: 'blue' | 'magenta' | 'orange' | 'green';
}

export interface HeroStatTilesRowProps {
  tiles: HeroStatTile[];
}

export default function HeroStatTilesRow({ tiles }: HeroStatTilesRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {tiles.map((tile, idx) => {
        const color = tile.accent ? ACCENT_COLOR[tile.accent] : '#1d4ed8';
        return (
          <article
            key={`${tile.label}-${idx}`}
            className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
            style={{ borderTop: `4px solid ${color}` }}
          >
            <div
              className="font-body font-extrabold uppercase tracking-wider text-stone-500"
              style={{ fontSize: 10 }}
            >
              {tile.label}
            </div>
            <div
              className="font-mono font-black mt-2"
              style={{
                fontSize: 'clamp(22px, 2.8vw, 32px)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                color: tile.accent ? color : '#1c1917',
              }}
            >
              {tile.value}
            </div>
            {tile.meta ? (
              <div
                className="font-body text-stone-600 mt-1"
                style={{ fontSize: 12 }}
              >
                {tile.meta}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
