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
import { BarChart3, Share2, Award } from 'lucide-react';

interface Props {
  bib: string | number;
  name: string;
  rankingHref: string;
  onShare: () => void;
  onCertificate?: () => void;
  hasCertificate?: boolean;
}

const SCROLL_THRESHOLD = 360;

export function FloatingActionBar({
  bib,
  name,
  rankingHref,
  onShare,
  onCertificate,
  hasCertificate,
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

  // Keep the node mounted but translate off-screen — lets the spring
  // `transition` interpolate both directions without a render flash.
  return (
    <div
      className={`fab fixed bottom-5 left-1/2 z-40 w-[min(calc(100vw-1.5rem),560px)] -translate-x-1/2 ${
        visible ? 'fab-visible' : 'fab-hidden'
      }`}
      role="toolbar"
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/92 px-3 py-2 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <span
          className="hidden shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wide sm:inline-block"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          BIB · {bib}
        </span>
        <span className="hidden truncate text-xs font-semibold text-white/80 sm:inline-block sm:max-w-[180px]">
          {name}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <a
            href={rankingHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold transition hover:bg-white/20"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">BXH</span>
          </a>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold transition hover:bg-white/20"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
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
        </span>
      </div>
    </div>
  );
}

export default FloatingActionBar;
