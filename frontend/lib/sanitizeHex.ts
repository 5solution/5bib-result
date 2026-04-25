/**
 * Strict hex-colour validator for data coming from admin-editable fields
 * (e.g. `race.brandColor`) that we inject into CSS custom properties.
 *
 * Injecting user-controlled strings into `style="--foo: ..."` is a CSS-
 * injection vector: values like `#fff; background: url(evil.jpg)` would
 * break out of the declaration and evaluate attacker-controlled CSS.
 * React's `style` prop auto-escapes semicolons — but we ALSO validate
 * so that malformed values fall back to a sane default instead of
 * silently rendering nothing.
 *
 * Only 6-digit uppercase/lowercase hex is allowed. 3-digit shorthand
 * (#abc) and 8-digit with alpha (#aabbccdd) are rejected by design — the
 * backend only ever stores the 6-digit form.
 */
export function sanitizeHex(color: string | null | undefined): string {
  if (typeof color !== 'string') return DEFAULT_BRAND_COLOR;
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : DEFAULT_BRAND_COLOR;
}

export const DEFAULT_BRAND_COLOR = '#1a56db';

/** "#1a56db" → "26, 86, 219" (for rgba(..., alpha) string interpolation). */
export function hexToRgbTriplet(color: string): string {
  const safe = sanitizeHex(color);
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
