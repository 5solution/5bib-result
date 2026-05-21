/**
 * FEATURE-056 — Podium Card component (Variation A "Editorial Magazine").
 *
 * Server Component — pure render, no client state.
 * DATA INTEGRITY (Danny "k nó kiện đấy"):
 *  - `chipTime` rendered AS-IS from vendor (no reformat).
 *  - `name` rendered AS-IS (no canonicalize — legal spelling).
 *  - `city` chip hidden when undefined (BR-56-21 — defamation safety).
 */
/**
 * Format vendor AG bracket "M30-39" → "Nam 30-39", "F40-49" → "Nữ 40-49".
 * Preserves unknown formats verbatim (graceful degradation).
 * Inline (vs separate util) — only used here + AGBreakdownAccordion.
 */
function formatAg(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^([MFmf])(\d+)[-–](\d+)$/);
  if (!m) return raw;
  const prefix = m[1].toUpperCase() === 'M' ? 'Nam' : 'Nữ';
  return `${prefix} ${m[2]}-${m[3]}`;
}

export interface PodiumCardProps {
  rank: 1 | 2 | 3;
  variant: 'gold' | 'silver' | 'bronze';
  size?: 'md' | 'sm';
  name: string;
  bib: string;
  chipTime: string;
  ag?: string;
  city?: string;
}

const VARIANT_ACCENT: Record<PodiumCardProps['variant'], string> = {
  gold: '#D97706',
  silver: '#94A3B8',
  bronze: '#B45309',
};

export function PodiumCard({
  rank,
  variant,
  size = 'md',
  name,
  bib,
  chipTime,
  ag,
  city,
}: PodiumCardProps) {
  const isLead = rank === 1;
  const accent = VARIANT_ACCENT[variant];
  const padding = size === 'sm' ? 'p-4' : 'p-5';
  const nameSize = isLead ? 'text-[22px] leading-tight' : 'text-[17px] leading-tight';
  const chipSize = isLead ? 'text-[28px]' : 'text-[20px]';

  // DATA INTEGRITY: city chip truncated max-14 chars (BR-56-21).
  const cityTruncated = city
    ? city.length > 14
      ? `${city.slice(0, 13)}…`
      : city
    : null;

  return (
    <article
      className={`relative ${padding} bg-white border border-stone-200 rounded-2xl flex flex-col gap-3 transition-all duration-200`}
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="font-heading font-black tracking-tight"
          style={{
            fontSize: isLead ? 28 : 22,
            color: accent,
            lineHeight: 1,
          }}
        >
          #{rank}
        </span>
        <span
          className="font-mono text-[11px] font-semibold tracking-wider text-stone-500"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          BIB {bib}
        </span>
      </div>

      <h4
        className={`font-heading font-bold uppercase tracking-tight text-stone-900 ${nameSize}`}
      >
        {name}
      </h4>

      <div className="flex items-baseline justify-between gap-3 mt-auto">
        <span
          className={`font-mono font-bold text-stone-900 ${chipSize}`}
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
        >
          {chipTime}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-1">
        {ag ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase text-stone-700"
            style={{ background: 'rgba(214,211,209,0.45)' }}
          >
            {formatAg(ag) ?? ag}
          </span>
        ) : null}
        {cityTruncated ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold font-mono text-stone-700 border border-stone-300"
            style={{ fontVariantNumeric: 'tabular-nums' }}
            title={city ?? undefined}
          >
            {cityTruncated}
          </span>
        ) : null}
      </div>

      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: accent }}
      />
    </article>
  );
}
