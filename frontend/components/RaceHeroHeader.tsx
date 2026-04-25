'use client';

/**
 * Race Hero Header — 3 CSS layers (spec v2 §Section 1):
 *
 *   Layer 1 (.hero-photo)    blurred race banner — absolute inset:-25, scale 1.06
 *                            so the blur edges never bleed sharp into the frame
 *   Layer 2 (.hero-gradient) dual-gradient with brand-colour accent
 *   Layer 3 (.hero-texture)  subtle diagonal stripes for texture
 *
 * Children render on top of these layers inside a relative container so the
 * existing hero content (avatar, rank badges, action buttons) is untouched.
 *
 * Parallax: we read `window.scrollY` inside a `requestAnimationFrame` callback
 * and write `transform` straight to the DOM via a ref — deliberately NOT
 * using `useState(scrollY)` because the athlete page has heavy chart children
 * and re-rendering them on every scroll tick kills performance.
 *
 * Banner load failure (404, CORS, etc.) silently flips to gradient-only — no
 * broken image icon, no console noise beyond the browser's own network tab.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { sanitizeHex, hexToRgbTriplet } from '@/lib/sanitizeHex';

interface Props {
  bannerUrl?: string | null;
  brandColor?: string | null;
  children: ReactNode;
  className?: string;
}

export function RaceHeroHeader({ bannerUrl, brandColor, children, className }: Props) {
  const photoRef = useRef<HTMLDivElement | null>(null);
  const [bannerError, setBannerError] = useState(false);

  const safeColor = sanitizeHex(brandColor);
  const brandRgb = hexToRgbTriplet(safeColor);
  const hasBanner = !!bannerUrl && !bannerError;

  // Preload + flip to error on failure. We can't attach `onError` to a
  // `background-image` — so sniff via <img> probe.
  useEffect(() => {
    if (!bannerUrl) return;
    setBannerError(false);
    const probe = new Image();
    probe.onerror = () => setBannerError(true);
    probe.src = bannerUrl;
    return () => {
      probe.onerror = null;
    };
  }, [bannerUrl]);

  // Parallax: rAF loop bound to scroll events, passive listener, clamped so
  // the blur edge never slides far enough to expose the background underneath.
  useEffect(() => {
    if (!photoRef.current) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(window.scrollY * 0.3, 100);
        if (photoRef.current) {
          photoRef.current.style.transform = `scale(1.06) translateY(${y}px)`;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`relative overflow-hidden isolate ${className ?? ''}`}
      style={
        {
          '--race-brand-color': safeColor,
          '--race-brand-rgb': brandRgb,
        } as React.CSSProperties
      }
    >
      {/* Layer 1 — race banner photo. Blur + brightness tuned so the banner
          reads clearly as the race's visual identity (~40% visibility under
          the gradient) while white text on top stays legible. */}
      {hasBanner && (
        <div
          ref={photoRef}
          aria-hidden
          className="hero-photo absolute -inset-6 z-0"
          style={{
            backgroundImage: `url(${encodeURI(bannerUrl!)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px) brightness(0.9) saturate(1.05)',
            transform: 'scale(1.06)',
            willChange: 'transform',
          }}
        />
      )}

      {/* Layer 2 — gradient overlay (always on, serves as fallback).
          When a banner is present we drop overlay opacity so the photo reads
          at ~40% through the tint; fallback (no banner) stays solid brand. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1]"
        style={{
          background: hasBanner
            ? `linear-gradient(160deg,
                rgba(11,22,64,0.48) 0%,
                rgba(${brandRgb},0.32) 45%,
                rgba(15,23,65,0.62) 100%)`
            : `linear-gradient(160deg,
                #0b1640 0%,
                rgba(${brandRgb},0.85) 50%,
                #1e40af 100%)`,
        }}
      />

      {/* Layer 3 — diagonal texture */}
      <div
        aria-hidden
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-55deg, transparent 0, transparent 28px, rgba(255,255,255,0.025) 28px, rgba(255,255,255,0.025) 56px)',
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default RaceHeroHeader;
