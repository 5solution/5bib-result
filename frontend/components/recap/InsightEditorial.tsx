/**
 * FEATURE-056 — 5BIB Editorial Insight block (Variation A magazine layout).
 *
 * Server Component. Renders backend-sanitized HTML via `dangerouslySetInnerHTML`.
 * DATA INTEGRITY:
 *  - HTML PRE-SANITIZED server-side via sanitize-html allowlist (BR-56-23).
 *  - Drop-cap derived from first plaintext char (no extra DOM injection).
 *  - Spotlight cards optional — hidden when array empty / undefined.
 */
import type { ReactNode } from 'react';

export interface InsightEditorialProps {
  /** Pre-rendered sanitized HTML from backend (insightHtml). */
  insightHtml: string | null;
  /** Optional editorial byline (e.g. "5BIB EDITORIAL TEAM · 03/05/2026"). */
  byline?: string | null;
  /** Optional fallback lead paragraph when no insight curated. */
  fallbackLead?: string;
  /** Optional spotlight stories rendered below insight body. */
  spotlightCards?: ReactNode;
  /** Optional CTAs (e.g. "Xem toàn bộ kết quả" + "Chia sẻ"). */
  cta?: ReactNode;
}

/** Pull first plaintext char from HTML (for drop-cap). */
function firstChar(html: string): { drop: string; rest: string } {
  // Strip leading tags to expose first char.
  const text = html.replace(/<[^>]+>/g, '');
  const trimmed = text.trimStart();
  return { drop: trimmed.charAt(0) || 'H', rest: trimmed.slice(1) };
}

/**
 * Split HTML into (leadParagraph, restHtml) — first <p>...</p> goes large italic.
 */
function splitLead(html: string): { lead: string; rest: string } {
  const m = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return { lead: '', rest: html };
  const lead = m[1];
  const rest = html.slice(0, m.index) + html.slice((m.index ?? 0) + m[0].length);
  return { lead, rest };
}

export function InsightEditorial({
  insightHtml,
  byline,
  fallbackLead,
  spotlightCards,
  cta,
}: InsightEditorialProps) {
  const html = insightHtml ?? (fallbackLead ? `<p>${fallbackLead}</p>` : null);

  if (!html) {
    return (
      <article
        className="bg-white border border-stone-200 rounded-2xl px-8 py-10 max-w-3xl mx-auto"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <p className="font-body italic text-stone-500">
          Bài phân tích từ đội ngũ 5BIB sẽ đăng sau khi race kết thúc.
        </p>
        {cta}
      </article>
    );
  }

  const { lead, rest } = splitLead(html);
  const { drop, rest: leadRest } = lead ? firstChar(lead) : { drop: '', rest: '' };

  return (
    <article
      className="relative bg-white border border-stone-200 rounded-2xl px-8 py-10 md:px-16 md:py-12 max-w-4xl mx-auto"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-8 w-1 h-20 rounded-r"
        style={{ background: 'var(--5bib-energy, #ea580c)' }}
      />
      {byline ? (
        <div
          className="font-mono font-semibold uppercase text-[11px] tracking-[0.18em] text-stone-500 mb-6"
        >
          {byline}
        </div>
      ) : null}
      {lead ? (
        <p
          className="font-heading italic font-medium text-stone-900 text-[22px] md:text-[26px] leading-[1.4]"
          style={{ letterSpacing: '-0.01em' }}
        >
          <span
            className="float-left mr-3 mt-1 font-heading font-black not-italic"
            style={{
              fontSize: 88,
              lineHeight: 0.85,
              color: 'var(--5bib-energy, #ea580c)',
            }}
          >
            {drop}
          </span>
          <span dangerouslySetInnerHTML={{ __html: leadRest }} />
        </p>
      ) : null}
      {rest ? (
        <div
          className="mt-7 font-body text-[16px] leading-[1.75] text-stone-700 prose prose-stone max-w-none"
          dangerouslySetInnerHTML={{ __html: rest }}
        />
      ) : null}
      {spotlightCards}
      {cta ? <div className="mt-8 flex flex-wrap gap-3">{cta}</div> : null}
    </article>
  );
}

/**
 * Inline sub-block — renders spotlight cards inside InsightEditorial (or
 * elsewhere) given backend-supplied list per course.
 */
export interface SpotlightCardsProps {
  groups: Array<{
    courseId: string;
    courseName: string;
    stories: Array<{
      gender: 'M' | 'F';
      winnerBib: string;
      winnerName: string;
      html: string;
      source: 'admin' | 'auto';
    }>;
  }>;
}

export function SpotlightCards({ groups }: SpotlightCardsProps) {
  if (!groups || groups.length === 0) return null;
  return (
    <section className="mt-10">
      <div
        className="font-mono font-bold uppercase text-[11px] tracking-[0.22em] text-stone-500 mb-4"
      >
        VĐV NỔI BẬT
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.flatMap((g) =>
          g.stories.map((s) => (
            <div
              key={`${g.courseId}-${s.gender}-${s.winnerBib}`}
              className="bg-stone-50 border border-stone-200 rounded-xl p-5"
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-heading font-bold uppercase text-[14px] tracking-tight text-stone-900">
                  {s.winnerName}
                </span>
                <span
                  className="font-mono text-[11px] text-stone-500"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  BIB {s.winnerBib} · {g.courseName}
                </span>
              </div>
              <div
                className="font-body text-[14px] leading-[1.65] text-stone-700"
                dangerouslySetInnerHTML={{ __html: s.html }}
              />
            </div>
          )),
        )}
      </div>
    </section>
  );
}
