/**
 * 5BIB Admin Design Tokens — Single Source of Truth
 *
 * FEATURE-022 (Token sweep, Giai doan 1).
 * Source: /Users/dannynguyen/Downloads/admin-redesign/shell.jsx (TOKENS object).
 *
 * QUY TAC:
 * - KHONG hardcode hex trong component. Component tham chieu qua Tailwind class
 *   (Tailwind v4 @theme inline trong globals.css) hoac CSS variable.
 * - File nay la nguon TS de:
 *     1) Type-safe access trong logic JS (vd inline style cho dynamic chart color).
 *     2) Doi chieu khi dong bo voi globals.css (visual diff).
 *
 * BR-DESIGN-01 → BR-DESIGN-15.
 */

export const TOKENS = {
  // Backgrounds
  bg: '#FAF8F5',        // warm stone — page background
  surface: '#FFFFFF',   // card, dialog
  surface2: '#F3F0EB',  // hover state, secondary surface
  surface3: '#E8E4DD',  // tertiary, accent surface

  // Text
  text: '#1C1917',
  textMuted: '#78716C',
  textDim: '#A8A29E',

  // Borders
  border: '#E7E2D9',
  borderStrong: '#D6D3D1',

  // Brand & action
  blue: '#1D49FF',       // primary action, link, focus ring
  blueDim: '#0B36E6',    // hover state cua blue
  blue50: '#E6ECFF',     // tint nhe (button ghost-on-blue)
  blue100: '#CCD9FF',    // border subtle, soft chip
  magenta: '#FF0E65',    // brand accent, live indicator, NEW badge

  // Status (4 tones)
  success: '#15803D',
  successBg: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',
  violet: '#5B21B6',
  violetBg: '#EDE9FE',

  // Sidebar
  sidebarBg: '#0F172A',  // dark slate-900
} as const;

export type ColorToken = keyof typeof TOKENS;

/**
 * Status pill tones (BR-DESIGN-14).
 * 6 tones co dinh + dark.
 */
export const STATUS_PILL_TONES = {
  gray: { bg: '#F3F4F6', fg: '#6B7280', bd: '#D1D5DB' },
  blue: { bg: TOKENS.blue50, fg: TOKENS.blue, bd: TOKENS.blue100 },
  green: { bg: TOKENS.successBg, fg: TOKENS.success, bd: '#86EFAC' },
  amber: { bg: TOKENS.warningBg, fg: TOKENS.warning, bd: '#FCD34D' },
  red: { bg: TOKENS.dangerBg, fg: TOKENS.danger, bd: '#FCA5A5' },
  violet: { bg: TOKENS.violetBg, fg: TOKENS.violet, bd: '#C4B5FD' },
  dark: { bg: '#1C1917', fg: '#FFFFFF', bd: '#1C1917' },
} as const;

export type StatusPillTone = keyof typeof STATUS_PILL_TONES;
