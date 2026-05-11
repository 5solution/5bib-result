'use client';

import * as React from 'react';

/**
 * Icon primitives used across the /solution landing.
 * Copied from the 5BIB design prototype — kept as inline SVGs so the landing
 * page has zero dependencies on any icon library.
 */

type IconProps = { s?: number; sw?: number; className?: string; style?: React.CSSProperties };

const Icon = ({
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
  <Icon
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
  <Icon {...p} s={p.s ?? 16} d={<path d="M20 6 9 17l-5-5" />} />
);

export const IX = (p: IconProps) => (
  <Icon
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

export const IPlay = (p: IconProps) => (
  <Icon {...p} s={p.s ?? 14} d={<polygon points="5 3 19 12 5 21 5 3" />} />
);

export const IPlus = (p: IconProps) => (
  <Icon
    {...p}
    s={p.s ?? 14}
    d={
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    }
  />
);

export const ITicket = (p: IconProps) => (
  <Icon
    {...p}
    s={p.s ?? 18}
    d={
      <>
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        <path d="M13 5v2" />
        <path d="M13 17v2" />
        <path d="M13 11v2" />
      </>
    }
  />
);

export const IQr = (p: IconProps) => (
  <Icon
    {...p}
    s={p.s ?? 18}
    d={
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3z" />
        <path d="M20 14v7" />
        <path d="M14 20h3" />
      </>
    }
  />
);

export const IZap = (p: IconProps) => (
  <Icon {...p} s={p.s ?? 18} d={<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />} />
);

export const IChart = (p: IconProps) => (
  <Icon
    {...p}
    s={p.s ?? 18}
    d={
      <>
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </>
    }
  />
);

export const IShare = (p: IconProps) => (
  <Icon
    {...p}
    s={p.s ?? 18}
    d={
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.59 13.51 6.83 3.98" />
        <path d="m15.41 6.51-6.82 3.98" />
      </>
    }
  />
);

export const IPalette = (p: IconProps) => (
  <Icon
    {...p}
    s={p.s ?? 18}
    d={
      <>
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10a3 3 0 0 0 3-3v-1a2 2 0 0 1 2-2h3a3 3 0 0 0 3-3c0-5.5-4.5-10-11-10z" />
      </>
    }
  />
);

export const ICal = (p: IconProps) => (
  <Icon
    {...p}
    s={p.s ?? 14}
    d={
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    }
  />
);

export const IUsers = (p: IconProps) => (
  <Icon
    {...p}
    s={p.s ?? 14}
    d={
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    }
  />
);

/** Small bilingual-copy helper. Keep strings co-located with components. */
export function useT(lang: 'vi' | 'en') {
  return React.useCallback((vi: string, en: string) => (lang === 'en' ? en : vi), [lang]);
}

export type Lang = 'vi' | 'en';

/** Small pill label used in hero + case-study badges. */
export function Pill({
  children,
  bg = 'rgba(255,255,255,0.14)',
  color = '#fff',
  border,
}: {
  children: React.ReactNode;
  bg?: string;
  color?: string;
  border?: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        background: bg,
        color,
        border,
        borderRadius: 9999,
        fontFamily: 'var(--font-body)',
        fontWeight: 800,
        fontSize: 11,
        letterSpacing: '.18em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

/** Pulsing live-status dot. */
export function LiveDot({ color = '#fef08a' }: { color?: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: color,
          borderRadius: 9999,
          opacity: 0.7,
          animation: 'lpd 1.4s infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          background: color,
          borderRadius: 9999,
          width: 8,
          height: 8,
        }}
      />
    </span>
  );
}
