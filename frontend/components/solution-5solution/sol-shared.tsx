'use client';

import * as React from 'react';

/** Shared types + helpers for the 5Solution umbrella landing. */
export type Lang = 'vi' | 'en';

export function useT(lang: Lang) {
  return React.useCallback(
    (vi: string, en: string) => (lang === 'en' ? en : vi),
    [lang],
  );
}

/** Lightweight inline icon helper — strokes inherit currentColor. */
type IconProps = {
  s?: number;
  sw?: number;
  className?: string;
  style?: React.CSSProperties;
};
const Ic = ({
  d,
  s = 18,
  sw = 2,
  className,
  style,
}: IconProps & { d: React.ReactNode }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    {d}
  </svg>
);

export const IArr = (p: IconProps) => (
  <Ic
    {...p}
    s={p.s ?? 16}
    d={
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    }
  />
);
export const ICheck = (p: IconProps) => (
  <Ic {...p} s={p.s ?? 16} d={<path d="M20 6 9 17l-5-5" />} />
);
export const IClose = (p: IconProps) => (
  <Ic
    {...p}
    s={p.s ?? 16}
    d={
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    }
  />
);
export const IPhone = (p: IconProps) => (
  <Ic
    {...p}
    s={p.s ?? 16}
    d={
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.35 1.84.59 2.8.72A2 2 0 0 1 22 16.92z" />
    }
  />
);
export const IMail = (p: IconProps) => (
  <Ic
    {...p}
    s={p.s ?? 16}
    d={
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </>
    }
  />
);
export const IPin = (p: IconProps) => (
  <Ic
    {...p}
    s={p.s ?? 18}
    d={
      <>
        <path d="M20 10c0 7-8 13-8 13S4 17 4 10a8 8 0 0 1 16 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    }
  />
);

/** Reveal-on-scroll wrapper — uses IntersectionObserver. */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'span';
  style?: React.CSSProperties;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setShown(true), delay);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.18 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <Tag
      ref={ref as never}
      style={style}
      className={`sol-reveal ${shown ? 'is-visible' : ''} ${className ?? ''}`}
    >
      {children}
    </Tag>
  );
}

/**
 * 5Solution wordmark used in the header. Tight, no graphic — just the type
 * lockup "5Solution" so it works on any background.
 */
export function SolWordmark({
  size = 22,
  invert = false,
}: {
  size?: number;
  invert?: boolean;
}) {
  const color = invert ? '#fff' : 'var(--sol-navy)';
  const accent = invert ? '#fff' : 'var(--sol-blue)';
  return (
    <span
      style={{
        fontFamily: 'var(--sol-font-display)',
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '-0.01em',
        color,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 2,
      }}
    >
      <span style={{ color: accent }}>5</span>
      <span>Solution</span>
    </span>
  );
}
