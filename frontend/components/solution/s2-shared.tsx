'use client';

import * as React from 'react';

export type Lang = 'vi' | 'en';
export function useT(lang: Lang) {
  return React.useCallback(
    (vi: string, en: string) => (lang === 'en' ? en : vi),
    [lang],
  );
}

/** GTM/dataLayer push helper (SSR-safe). */
export function dl(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
}

/** Reveal-on-scroll helper using IntersectionObserver. */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = 'fade',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: 'fade' | 'clip';
  as?: 'div' | 'section' | 'article' | 'span' | 'header' | 'footer';
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => setShown(true), delay);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  const cls =
    variant === 'clip' ? 's2-clip-reveal' : 's2-reveal';
  const Component = Tag as 'div';
  return (
    <Component
      ref={ref as never}
      className={`${cls} ${shown ? 'is-visible' : ''} ${className ?? ''}`}
    >
      {children}
    </Component>
  );
}

/** Counter — animates from 0 → target when in view. */
export function Counter({
  to,
  suffix = '',
  prefix = '',
  duration = 2200,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [val, setVal] = React.useState(0);
  const started = React.useRef(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(to);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - t, 3);
              setVal(Math.round(to * eased));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {val.toLocaleString('vi-VN')}
      {suffix}
    </span>
  );
}

/** Magnetic CTA wrapper — element follows cursor within radius. */
export function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = 'translate3d(0,0,0)';
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [strength]);

  return (
    <span ref={ref} className={`s2-magnetic ${className ?? ''}`} style={{ transition: 'transform 480ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
      {children}
    </span>
  );
}
