'use client';

/**
 * FEATURE-056 Phase 4 — Recap Story Card (client island).
 *
 * Expandable card teaser per Danny mandate 2026-05-21 "section card + Đọc tiếp →".
 * Default: show title + summary + meta. Click "Đọc tiếp →" → expand body inline
 * (HTML from backend, already sanitized server-side).
 */

import { useState } from 'react';

export interface RecapStoryCardProps {
  slug: string;
  title: string;
  summary: string;
  category:
    | 'race-narrative'
    | 'winner-profile'
    | 'pacing'
    | 'course-difficulty'
    | 'age-group'
    | 'pace-distribution';
  readMinutes: number;
  html: string;
  source: 'auto' | 'admin';
  publishedAt: string;
}

const CATEGORY_LABEL: Record<RecapStoryCardProps['category'], string> = {
  'race-narrative': 'TỔNG QUAN',
  'winner-profile': 'WINNER',
  pacing: 'PACING',
  'course-difficulty': 'CỰ LY',
  'age-group': 'AGE GROUP',
  'pace-distribution': 'PHÂN BỐ PACE',
};

const CATEGORY_ACCENT: Record<RecapStoryCardProps['category'], string> = {
  'race-narrative': '#1d4ed8',
  'winner-profile': '#D97706',
  pacing: '#166534',
  'course-difficulty': '#7C3AED',
  'age-group': '#EA580C',
  'pace-distribution': '#0891B2',
};

export default function RecapStoryCard({
  title,
  summary,
  category,
  readMinutes,
  html,
  source,
}: RecapStoryCardProps) {
  const [open, setOpen] = useState(false);
  const accent = CATEGORY_ACCENT[category];

  return (
    <article
      className="bg-white border border-stone-200 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      <div className="p-5 md:p-6">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-3">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono font-extrabold uppercase text-[10px] tracking-[0.18em] text-white"
            style={{ background: accent }}
          >
            {CATEGORY_LABEL[category]}
          </span>
          <span
            className="font-mono font-semibold text-[10px] tracking-wide text-stone-500"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {readMinutes} MIN READ
          </span>
          {source === 'auto' ? (
            <span
              className="font-mono font-semibold text-[10px] tracking-wide text-stone-400 ml-auto"
              title="Bài viết được hệ thống tự tổng hợp"
            >
              ✦ AUTO
            </span>
          ) : (
            <span
              className="font-mono font-semibold text-[10px] tracking-wide text-stone-700 ml-auto"
              title="Bài viết do 5BIB Editorial Team biên tập"
            >
              EDITORIAL
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className="font-heading font-bold text-stone-900 m-0"
          style={{
            fontSize: 'clamp(17px, 1.6vw, 21px)',
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h3>

        {/* Summary teaser (hidden when expanded — body has its own intro) */}
        {!open ? (
          <p
            className="font-body text-stone-600 mt-3"
            style={{ fontSize: 14, lineHeight: 1.55 }}
          >
            {summary}
          </p>
        ) : null}

        {/* Expanded body (server-rendered sanitized HTML) */}
        {open ? (
          <div
            className="recap-story-body mt-4 font-body text-stone-700"
            style={{ fontSize: 15, lineHeight: 1.7 }}
            // HTML pre-sanitized server-side per RecapArticleGenerator allowlist.
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}

        {/* CTA */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-4 inline-flex items-center gap-1.5 font-mono font-bold text-[12px] tracking-wider uppercase transition-colors duration-150 cursor-pointer hover:opacity-80"
          style={{ color: accent }}
        >
          {open ? (
            <>
              Thu gọn <span aria-hidden>↑</span>
            </>
          ) : (
            <>
              Đọc tiếp <span aria-hidden>→</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}
