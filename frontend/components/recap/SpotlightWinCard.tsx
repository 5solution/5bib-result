/**
 * FEATURE-056 — Spotlight Win Card (Variation A "Editorial Magazine" Hero).
 *
 * Server Component — pure render, no client state.
 * Big gold gradient card showcasing the overall winner.
 * PAUSE-56-12 D: NO "Δ vs record" field — vendor data lacks course record reliability.
 */

export interface SpotlightWinCardProps {
  courseLabel: string;
  name: string;
  bib: string;
  city?: string;
  ageGroup?: string;
  chipTime: string;
  pace?: string;
  splits?: string;
  trophy?: boolean;
}

export default function SpotlightWinCard({
  courseLabel,
  name,
  bib,
  city,
  ageGroup,
  chipTime,
  pace,
  splits,
  trophy = true,
}: SpotlightWinCardProps) {
  return (
    <article
      className="relative overflow-hidden p-8 md:p-10 rounded-3xl"
      style={{
        background:
          'linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #EAB308 100%)',
      }}
    >
      {trophy ? (
        <svg
          aria-hidden
          className="absolute left-6 top-6 w-12 h-12"
          viewBox="0 0 24 24"
          fill="#7C2D12"
        >
          <path d="M7 4h10v2h3v3a4 4 0 0 1-4 4h-.35A5.99 5.99 0 0 1 13 16.91V19h3v2H8v-2h3v-2.09A5.99 5.99 0 0 1 7.35 13H7a4 4 0 0 1-4-4V6h3V4h1zm10 4v1a2 2 0 0 0 2-2V8h-2zm-12 0v1a2 2 0 0 0 2 2V8H5z" />
        </svg>
      ) : null}

      <div className="relative" style={{ paddingLeft: trophy ? 64 : 0 }}>
        <div
          className="font-mono uppercase tracking-widest"
          style={{ fontSize: 11, color: '#78350F' }}
        >
          {courseLabel}
        </div>

        <h2
          className="font-heading font-black uppercase mt-3"
          style={{
            fontSize: 'clamp(28px, 4vw, 48px)',
            color: '#451A03',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          {name}
        </h2>

        <div
          className="font-body mt-2"
          style={{ color: 'rgba(120, 53, 15, 0.85)', fontSize: 14 }}
        >
          BIB {bib}
          {city ? ` · ${city}` : ''}
          {ageGroup ? ` · ${ageGroup}` : ''}
        </div>

        <div
          className="font-mono font-black mt-6"
          style={{
            fontSize: 'clamp(48px, 8vw, 88px)',
            color: '#451A03',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {chipTime}
        </div>

        <div className="grid grid-cols-2 gap-6 mt-8">
          {pace ? (
            <div>
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  color: 'rgba(120, 53, 15, 0.75)',
                }}
              >
                PACE
              </div>
              <div
                className="font-mono font-bold mt-1"
                style={{
                  fontSize: 18,
                  color: '#451A03',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {pace}
              </div>
            </div>
          ) : null}
          {splits ? (
            <div>
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  color: 'rgba(120, 53, 15, 0.75)',
                }}
              >
                SPLITS
              </div>
              <div
                className="font-mono font-bold mt-1"
                style={{
                  fontSize: 18,
                  color: '#451A03',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {splits}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
