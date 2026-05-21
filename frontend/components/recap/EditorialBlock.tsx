/**
 * FEATURE-056 — Editorial Block (Variation B Dashboard bottom).
 *
 * Server Component — bordered editorial card with author meta + pull-quote + CTA.
 */

export interface EditorialBlockProps {
  authorLabel?: string;
  publishedAt?: string;
  readMinutes?: number;
  authorName?: string;
  authorSubLabel?: string;
  pullQuote: string;
  body: string;
  ctaHref?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '5B';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function EditorialBlock({
  authorLabel = '5BIB EDITORIAL',
  publishedAt,
  readMinutes,
  authorName = '5BIB Editorial Team',
  authorSubLabel,
  pullQuote,
  body,
  ctaHref,
}: EditorialBlockProps) {
  return (
    <article className="rounded-2xl border-2 border-stone-200 bg-white p-8 md:p-10">
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 md:gap-8">
        <aside>
          <div
            className="font-mono uppercase tracking-widest text-stone-500"
            style={{ fontSize: 10 }}
          >
            {authorLabel}
          </div>
          {(publishedAt || readMinutes !== undefined) ? (
            <div
              className="font-mono text-stone-400 mt-1"
              style={{
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {publishedAt ?? ''}
              {publishedAt && readMinutes !== undefined ? ' · ' : ''}
              {readMinutes !== undefined ? `${readMinutes} min read` : ''}
            </div>
          ) : null}

          <div className="flex items-center gap-3 mt-4">
            <div
              className="rounded-full flex items-center justify-center font-mono font-bold"
              style={{
                width: 32,
                height: 32,
                background: '#1c1917',
                color: '#FFFFFF',
                fontSize: 11,
              }}
              aria-hidden
            >
              {initials(authorName)}
            </div>
            <div className="min-w-0">
              <div
                className="font-bold text-stone-900 truncate"
                style={{ fontSize: 13 }}
              >
                {authorName}
              </div>
              {authorSubLabel ? (
                <div
                  className="font-mono text-stone-400 truncate"
                  style={{ fontSize: 10 }}
                >
                  {authorSubLabel}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div>
          <blockquote
            className="font-heading italic text-stone-900 border-l-4 border-orange-500 pl-4"
            style={{ fontSize: 22, lineHeight: 1.35 }}
          >
            {pullQuote}
          </blockquote>
          <p
            className="font-body text-stone-600 mt-4"
            style={{ fontSize: 15, lineHeight: 1.6 }}
          >
            {body}
          </p>
          {ctaHref ? (
            <a
              href={ctaHref}
              className="inline-flex items-center rounded-full border border-stone-300 px-4 py-2 mt-6 font-bold hover:bg-stone-900 hover:text-white transition-colors"
              style={{ fontSize: 13 }}
            >
              Đọc tiếp →
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
