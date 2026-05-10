/**
 * 5BIB Admin Font Loader
 *
 * FEATURE-022 BR-DESIGN-06 / BR-DESIGN-07.
 * - Be Vietnam Pro: UI font chinh (heading + body).
 * - JetBrains Mono: data font (BIB, time, ID, currency, hex chip ID).
 *
 * Su dung next/font/google de preload local — KHONG fetch tu Google CDN runtime.
 * Display: swap → tranh FOIT, fallback system font trong vai ms dau.
 */

import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";

export const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
