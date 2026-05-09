'use client';

import * as React from 'react';
import { useMascotFrame, mascotSrc } from './s2-shared';

/**
 * Sticky mascot runner — fixed-position beaver that runs across the bottom
 * of the viewport based on scroll progress, with a running frame cycle and
 * bobbing motion. Centerpiece of the page.
 *
 * Renders once at page level. Hidden on tiny mobile + reduced-motion.
 */
export function S2MascotRunner() {
  const ref = React.useRef<HTMLImageElement>(null);
  const frame = useMascotFrame(140);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 640px)').matches) return;

    let raf = 0;
    let bobT = 0;
    let lastNow = performance.now();

    const animate = (now: number) => {
      const dt = now - lastNow;
      lastNow = now;
      bobT += dt * 0.005;

      const el = ref.current;
      if (!el) {
        raf = requestAnimationFrame(animate);
        return;
      }

      // Scroll progress (0 .. 1) — but only visible from hero end onwards.
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      const progress = max > 0 ? Math.max(0, Math.min(1, y / max)) : 0;

      // Hero owns its own mascot — only show this runner past hero (y > 600).
      // Visibility ramp 0 → 1 between scroll 400 and 800.
      const visibility = Math.max(0, Math.min(1, (y - 400) / 400));

      // Hide near final CTA / footer (last 8% of scroll where final CTA shows mascot).
      const fadeOut = progress > 0.92 ? Math.max(0, 1 - (progress - 0.92) * 12) : 1;
      const alpha = visibility * fadeOut;

      // X position — bounces back-forth across viewport width.
      // Use a triangle wave on progress so mascot crosses screen multiple times.
      const cycles = 3.5;
      const triangle = Math.abs(((progress * cycles) % 2) - 1); // 0..1..0..1
      const x = triangle * (window.innerWidth - 240); // 240 ≈ mascot width
      // Mirror flip when running backward (when triangle is decreasing)
      const phase = (progress * cycles) % 2;
      const flip = phase > 1 ? -1 : 1;

      const bob = Math.abs(Math.sin(bobT)) * 14;
      const tilt = Math.sin(bobT) * 6;

      el.style.transform = `translate3d(${x}px, ${-bob}px, 0) rotate(${tilt * flip}deg) scaleX(${flip})`;
      el.style.opacity = String(alpha);

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={mascotSrc(frame)}
      alt=""
      className="s2-mascot-runner"
      aria-hidden="true"
    />
  );
}

/**
 * Inline running mascot — small, used inside marquee/process steps.
 * Self-contained, frame cycle only (no scroll-driven animation).
 */
export function S2MascotInline({
  size = 56,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const frame = useMascotFrame(150);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mascotSrc(frame)}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        objectFit: 'contain',
        animation: 's2-mascot-bob 0.6s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/**
 * Big mascot in a section (process / case study). Frame cycle + sin-bob
 * driven by RAF.
 */
export function S2MascotSection({
  width = 220,
  flipX = false,
  className,
  style,
}: {
  width?: number;
  flipX?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = React.useRef<HTMLImageElement>(null);
  const frame = useMascotFrame(170);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const animate = (now: number) => {
      const dt = now - last;
      last = now;
      t += dt * 0.005;
      const el = ref.current;
      if (el) {
        const bob = Math.abs(Math.sin(t)) * 12;
        const tilt = Math.sin(t) * 4;
        el.style.transform = `translateY(${-bob}px) rotate(${tilt}deg) scaleX(${flipX ? -1 : 1})`;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [flipX]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={mascotSrc(frame)}
      alt=""
      width={width}
      className={className}
      style={{
        display: 'block',
        objectFit: 'contain',
        filter: 'drop-shadow(0 20px 40px rgba(29, 73, 255, 0.35))',
        willChange: 'transform',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
