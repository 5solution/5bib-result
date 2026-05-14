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
 *     (same origin, no CORS, no perf impact)
 *
 * Env override: `NEXT_PUBLIC_ASSET_PREFIX` cho local dev / preview environments.
 */
const ASSET_PREFIX =
  process.env.NEXT_PUBLIC_ASSET_PREFIX ?? 'https://result.5bib.com'

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {},
  assetPrefix: ASSET_PREFIX,
}

export default withSerwist(nextConfig)
