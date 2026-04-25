'use client';

/**
 * Floating Action Bar — shows after user scrolls past 360px.
 * 3 quick actions: back to ranking, share, jump-to-certificate.
 *
 * Rendered as fixed-positioned pill centred on the viewport. Uses a scroll
 * listener wrapped in rAF to avoid layout thrash, and respects
 * `prefers-reduced-motion` (transform disabled via CSS media query — see
 * globals.css `.fab` rule).
 *
 * `hasCertificate` gates the certificate CTA — DNF/DSQ athletes see only
 * ranking + share.
 */

import { useEffect, useState } from 'react';
import { BarChart3, ImageDown, Award, Link2, Check } from 'lucide-react';

interface Props {
  bib: string | number;
  name: string;
  rankingHref: string;
  onShare: () => void;
  onResultImage?: () => void;
  onCertificate?: () => void;
  hasCertificate?: boolean;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

const SCROLL_THRESHOLD = 360;

export function FloatingActionBar({
  bib,
  name,
  rankingHref,
  onShare,
  onResultImage,
  onCertificate,
  hasCertificate,
  onCopyLink,
  linkCopied,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setVisible(window.scrollY >= SCROLL_THRESHOLD);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Centering strategy (bulletproof):
  //  - Outer wrapper: `fixed inset-x-0` spans the full viewport width,
  //    then `pointer-events-none` so the empty gutters around the pill
  //    don't eat clicks.
  //  - Inner pill: `mx-auto` with a capped `max-width` and `w-fit` so the
  //    pill is always dead-centre regardless of content width.
  //  - No `left-1/2 + -translate-x-1/2` (that was ending up off-centre
  //    when ancestor `transform`/`isolate` created a containing block
  //    that wasn't the viewport).
  //  - BIB / name labels dropped — they made the pill visually lopsided
  //    (`justify-between` with mismatched block widths). The 3 quick
  //    actions are the only job of this bar.
  //  - Bottom offset respects `env(safe-area-inset-bottom)` for iOS Safari
  //    / Android gesture area — stops the pill vanishing behind the home
  //    bar on phones.
  // Outer wrapper spans inset-x-0 (bulletproof centering, no ancestor-
  // transform interference). Inner pill is `w-fit mx-auto` so it shrinks
  // to content and sits dead-centre. All items are in ONE flex row —
  // no justify-between — so BIB+name+buttons cluster naturally in the
  // middle with no empty gutter splitting them.
  return (
    <div
      className={`fab fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none ${
        visible ? 'fab-visible' : 'fab-hidden'
      }`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      role="toolbar"
      aria-hidden={!visible}
    >
      <div className="pointer-events-auto flex w-fit max-w-[min(calc(100vw-2rem),560px)] items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/92 py-2 pl-2 pr-2 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.4)] backdrop-blur-md">

        {/* BIB + name — desktop only, inline with the buttons */}
        <span
          className="hidden shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wide sm:inline-block"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          BIB · {bib}
        </span>
        <span className="hidden max-w-[140px] truncate text-xs font-semibold text-white/80 sm:inline-block lg:max-w-[200px]">
          {name}
        </span>

        {/* Thin vertical divider between identity and actions */}
        <span className="mx-1 hidden h-4 w-px bg-white/25 sm:inline-block" aria-hidden />

        {/* Actions — always visible on all screen sizes */}
        <a
          href={rankingHref}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold transition hover:bg-white/20"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">BXH</span>
        </a>
        {onResultImage && (
          <button
            type="button"
            onClick={onResultImage}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold transition hover:bg-white/20"
          >
            <ImageDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ảnh KQ</span>
          </button>
        )}
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold transition hover:bg-white/20"
        >
          {/* Facebook icon */}
          <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span className="hidden sm:inline">Chia sẻ</span>
        </button>
        {onCopyLink && (
          <button
            type="button"
            onClick={onCopyLink}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold transition hover:bg-white/20"
          >
            {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          </button>
        )}
        {hasCertificate && onCertificate && (
          <button
            type="button"
            onClick={onCertificate}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 text-[12px] font-bold text-slate-900 shadow-sm transition hover:shadow-md"
          >
            <Award className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cert</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default FloatingActionBar;
