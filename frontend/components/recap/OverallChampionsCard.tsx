/**
 * FEATURE-056 — Overall Champions Card (Variation B Dashboard right rail).
 *
 * Server Component — dark navy card displaying male + female winners.
 */

export interface OverallChampionsCardProps {
  courseLabel: string;
  male?: {
    name: string;
    bib?: string;
    chipTime: string;
    city?: string;
  };
  female?: {
    name: string;
    bib?: string;
    chipTime: string;
    city?: string;
  };
  ctaHref?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function WinnerRow({
  label,
  athlete,
}: {
  label: string;
  athlete: NonNullable<OverallChampionsCardProps['male']>;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div
        className="rounded-full flex items-center justify-center shrink-0 font-mono font-bold"
        style={{
          width: 48,
          height: 48,
          border: '2px solid #ea580c',
          background: '#0F172A',
          color: '#FED7AA',
          fontSize: 14,
        }}
        aria-hidden
      >
        {initials(athlete.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-mono uppercase tracking-widest"
          style={{ fontSize: 10, color: '#FB923C' }}
        >
          {label}
        </div>
        <div className="font-bold text-white truncate" style={{ fontSize: 15 }}>
          {athlete.name}
        </div>
        <div className="text-slate-400" style={{ fontSize: 12 }}>
          {athlete.bib ? `BIB ${athlete.bib}` : ''}
          {athlete.bib && athlete.city ? ' · ' : ''}
          {athlete.city ?? ''}
        </div>
      </div>
      <div
        className="font-mono font-bold shrink-0"
        style={{
          fontSize: 18,
          color: '#FB923C',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {athlete.chipTime}
      </div>
    </div>
  );
}

export default function OverallChampionsCard({
  courseLabel,
  male,
  female,
  ctaHref,
}: OverallChampionsCardProps) {
  return (
    <article className="bg-slate-900 text-white rounded-2xl p-6 md:p-8">
      <header>
        <div
          className="font-mono uppercase tracking-widest text-slate-400"
          style={{ fontSize: 10 }}
        >
          WINNERS · {courseLabel}
        </div>
        <h3
          className="font-heading font-bold mt-1"
          style={{ fontSize: 22 }}
        >
          Overall champions
        </h3>
      </header>

      <div className="mt-4">
        {male ? (
          <div className="border-b border-slate-800">
            <WinnerRow label="NAM · WINNER" athlete={male} />
          </div>
        ) : null}
        {female ? <WinnerRow label="NỮ · WINNER" athlete={female} /> : null}
      </div>

      {ctaHref ? (
        <a
          href={ctaHref}
          className="block text-center rounded-full border border-slate-700 px-4 py-2.5 mt-4 hover:bg-slate-800 transition-colors"
          style={{ fontSize: 13 }}
        >
          Xem full podium Nam/Nữ + Top AG →
        </a>
      ) : null}
    </article>
  );
}
