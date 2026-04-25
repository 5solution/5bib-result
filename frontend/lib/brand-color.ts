/**
 * F-05 Race-themed pages — brandColor utilities.
 *
 * BR-01: fallback = --5bib-accent (#1d4ed8)
 * BR-03: auto-generate palette (light, dim, text-safe)
 * BR-04: WCAG AA — darken until 4.5:1 contrast on white
 * BR-05: strict hex regex — never inject raw user string
 */

export const FALLBACK_BRAND = '#1d4ed8';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function sanitizeHex(color: string | null | undefined): string {
  return HEX_REGEX.test(color ?? '') ? (color as string) : FALLBACK_BRAND;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Darken a hex color by `pct` percent (0..100). */
export function darkenHex(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(sanitizeHex(hex));
  const f = 1 - pct / 100;
  return rgbToHex(r * f, g * f, b * f);
}

/** sRGB relative luminance per WCAG. */
function luminance([r, g, b]: [number, number, number]): number {
  const toLinear = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  );
}

function contrastRatio(a: [number, number, number], b: [number, number, number]) {
  const la = luminance(a);
  const lb = luminance(b);
  const L1 = Math.max(la, lb);
  const L2 = Math.min(la, lb);
  return (L1 + 0.05) / (L2 + 0.05);
}

/**
 * Return a color close to `hex` that has ≥ 4.5:1 contrast on white.
 * Iteratively darkens by 5% up to 15 steps (limit ~75%). If the color is
 * already dark enough, returns as-is.
 */
export function ensureContrast(hex: string): string {
  const safe = sanitizeHex(hex);
  const whiteRgb: [number, number, number] = [255, 255, 255];
  let current = safe;
  for (let i = 0; i < 15; i++) {
    const rgb = hexToRgb(current);
    if (contrastRatio(rgb, whiteRgb) >= 4.5) return current;
    current = darkenHex(current, 5);
  }
  return current;
}

export interface BrandPalette {
  /** Main brand hex — sanitized. */
  primary: string;
  /** Primary + '1a' alpha — 10% — for backgrounds/badges. */
  light: string;
  /** Primary darkened ~15% — for hover states. */
  dim: string;
  /** Contrast-safe hex for text-on-white. */
  textSafe: string;
}

export function generateBrandPalette(hex: string | null | undefined): BrandPalette {
  const primary = sanitizeHex(hex);
  return {
    primary,
    light: `${primary}1a`,
    dim: darkenHex(primary, 15),
    textSafe: ensureContrast(primary),
  };
}

/**
 * Inline style object to spread on a race-scoped wrapper div.
 *
 *   <div style={brandStyle(race.brandColor)}>
 *     ... any component inside can use var(--race-brand)
 */
export function brandStyle(
  hex: string | null | undefined,
): React.CSSProperties {
  const p = generateBrandPalette(hex);
  // Cast via unknown because CSS variables aren't in the CSSProperties type
  return {
    '--race-brand': p.primary,
    '--race-brand-light': p.light,
    '--race-brand-dim': p.dim,
    '--race-brand-text': p.textSafe,
  } as unknown as React.CSSProperties;
}
