/**
 * FEATURE-036 — Shared layout for /giai-chay/* SEO routes.
 *
 * BR-15: KHÔNG có form mua vé inline trong subtree. Layout chỉ chứa
 *        header/breadcrumb/footer chung.
 *
 * BR-14: per-page canonical via generateMetadata trên từng page. Layout
 *        không set canonical (subtree pages handle their own).
 */

import type { Metadata } from "next";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  // BR-15: noindex when served directly from result.5bib.com host (not via
  // 5bib.com Vercel rewrite). Vercel rewrite preserves Host header as 5bib.com.
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const isProxiedFrom5bib = host.includes("5bib.com") && !host.startsWith("result");
  if (!isProxiedFrom5bib) {
    return {
      robots: { index: false, follow: false },
    };
  }
  return {};
}

export default function GiaiChayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-stone-50">{children}</div>;
}
