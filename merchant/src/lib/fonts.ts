/**
 * 5BIB Merchant Portal Font Loader (F-069 rebuild)
 *
 * 5Solution design system fonts:
 * - Be Vietnam Pro  → display (headings)   → --font-display
 * - Plus Jakarta Sans → body (UI text)     → --font-body
 * - JetBrains Mono  → data (numbers/codes)  → --font-mono
 *
 * Loaded via next/font/google (self-hosted, no runtime CDN fetch).
 * display: swap → avoids FOIT, falls back to system font for a few ms.
 */

import {
  Be_Vietnam_Pro,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
  Noto_Sans_Khmer,
  Noto_Sans_Lao,
} from "next/font/google";

export const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// F-071 — Southeast Asian script support (Khmer / Lao). Self-hosted via
// next/font/google. Wired into the body/display font stacks (globals.css) so
// the browser falls back to these only for glyphs the Latin/Vietnamese fonts
// lack — Latin/Vietnamese text still renders with Be Vietnam Pro / Jakarta.
export const notoSansKhmer = Noto_Sans_Khmer({
  variable: "--font-khmer",
  subsets: ["khmer"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const notoSansLao = Noto_Sans_Lao({
  variable: "--font-lao",
  subsets: ["lao"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
