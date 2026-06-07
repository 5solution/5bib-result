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

import { Be_Vietnam_Pro, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

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
