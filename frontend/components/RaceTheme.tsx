'use client';

/**
 * F-05 — Race-Themed Pages.
 *
 * Wraps a section with a CSS custom property `--race-accent` derived from
 * the race's `brandColor` field. Children can opt in via classes like
 * `text-[var(--race-accent)]` or inline styles. When no brandColor is set,
 * the wrapper is inert and children fall back to the default blue.
 */

import type { CSSProperties, PropsWithChildren } from 'react';

interface Props {
  /** Hex color from race.brandColor, e.g. "#ea580c". Falsy = no theming. */
  brandColor?: string | null;
  /** Optional className on the wrapper */
  className?: string;
  style?: CSSProperties;
}

/** Basic hex validation: #rgb, #rrggbb, #rrggbbaa. */
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Darken a hex color by mixing with black (0-1). */
function shade(hex: string, amount: number): string {
  const m = hex.replace('#', '');
  const full =
    m.length === 3
      ? m
          .split('')
          .map((c) => c + c)
          .join('')
      : m.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

export function RaceTheme({
  brandColor,
  className,
  style,
  children,
}: PropsWithChildren<Props>) {
  const valid = brandColor && HEX_RE.test(brandColor) ? brandColor : null;

  const themeStyle: CSSProperties = valid
    ? {
        // Expose CSS custom properties scoped to this subtree.
        ['--race-accent' as string]: valid,
        ['--race-accent-dark' as string]: shade(valid, 0.25),
        ['--race-accent-soft' as string]: `${valid}22`, // ~13% alpha tint
        ...style,
      }
    : style || {};

  return (
    <div className={className} style={themeStyle}>
      {children}
    </div>
  );
}

export default RaceTheme;
