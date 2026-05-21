/**
 * FEATURE-056 — Recap Action Bar.
 *
 * Server Component — primary CTA + secondary CSV/Share buttons.
 * Renders anchor tags (no client handlers); URLs are pre-computed server-side.
 */

export interface RecapActionBarProps {
  fullResultsHref: string;
  csvHref?: string;
  shareHref?: string;
}

export default function RecapActionBar({
  fullResultsHref,
  csvHref,
  shareHref,
}: RecapActionBarProps) {
  return (
    <nav
      className="inline-flex flex-wrap items-center gap-2"
      aria-label="Recap actions"
    >
      <a
        href={fullResultsHref}
        className="inline-flex items-center rounded-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-body font-bold transition-all duration-150"
        style={{ fontSize: 13 }}
      >
        Kết quả đầy đủ →
      </a>

      {csvHref ? (
        <a
          href={csvHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 font-body font-bold text-stone-700 hover:bg-stone-100 transition-all duration-150"
          style={{ fontSize: 13 }}
        >
          <svg
            aria-hidden
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          CSV
        </a>
      ) : null}

      {shareHref ? (
        <a
          href={shareHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 font-body font-bold text-stone-700 hover:bg-stone-100 transition-all duration-150"
          style={{ fontSize: 13 }}
        >
          <svg
            aria-hidden
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </a>
      ) : null}
    </nav>
  );
}
