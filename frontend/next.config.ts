import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
})

/**
 * FEATURE-027 Promo Hub — assetPrefix cho cross-domain rewrite.
 *
 * Khi user truy cập `5bib.com/hub/<slug>` (rewrite từ 5Ticket Vercel):
 *   - Vercel proxy fetch HTML từ result.5bib.com (this app)
 *   - HTML có `<script src="/_next/static/...">` (relative)
 *   - Browser resolve relative → `https://5bib.com/_next/...` → 404 vì asset ở result.5bib.com
 *
 * `assetPrefix` ép Next.js generate ABSOLUTE URLs cho _next/static, _next/data, image
 * paths. Khi đó:
 *   - `5bib.com/hub/<slug>` → asset URL = `https://result.5bib.com/_next/...` ✓
 *   - `result.5bib.com/hub/<slug>` direct → asset URL = `https://result.5bib.com/_next/...` ✓
 *
 * **F-056 fix 2026-05-21:** Default removed (was `'https://result.5bib.com'`).
 * Root cause incident: DEV build inherited PROD URL as default → HTML
 * referenced PROD CDN chunks → F-056 new chunk hashes 404 trên PROD CDN →
 * DEV UI vỡ.
 *
 * Build-time env var `NEXT_PUBLIC_ASSET_PREFIX` MUST be set explicitly per
 * environment via Docker build args / CI workflow:
 *   - PROD build: NEXT_PUBLIC_ASSET_PREFIX=https://result.5bib.com (cho F-027 rewrite)
 *   - DEV build: NEXT_PUBLIC_ASSET_PREFIX='' (empty = relative URLs same-origin)
 *   - Local dev: '' (default Next.js dev server)
 *
 * F-027 Promo Hub rewrite at 5bib.com/hub/[slug] requires PROD build to set
 * absolute URL — if unset, Vercel rewrite path will 404 chunks (separate fix
 * needed via CI build args for PROD release branches).
 */
const ASSET_PREFIX = process.env.NEXT_PUBLIC_ASSET_PREFIX ?? ''

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {},
  assetPrefix: ASSET_PREFIX,
  /**
   * solution.5bib.com landing v2 — static drop-in.
   *
   * middleware.ts rewrites the host `solution.5bib.com/` → internal `/solution`.
   * This beforeFiles rewrite then serves the static landing bundle living in
   * `public/solution-v2/index.html` (replaces the old React `app/solution`
   * route, now retired to `app/_solution-legacy-v1/`).
   *
   * All sub-resources (videos, fonts, assets, hdsd.html iframes) are referenced
   * with absolute `/solution-v2/...` paths in index.html; they carry file
   * extensions so middleware's matcher skips them and they serve directly from
   * `public/` — no extra rewrite needed.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/solution', destination: '/solution-v2/index.html' },
        { source: '/timing', destination: '/timing-v2/index.html' },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default withSerwist(nextConfig)
