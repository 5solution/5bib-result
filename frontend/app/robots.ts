import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // F-056 Phase 5 PAUSED 2026-05-21 — explicit allow /runners/* sub-paths
        // (athlete profile pages F-047 keep indexable; per-race result page is
        // industry consent norm) while disallowing /runners exact listing.
        allow: ['/', '/runners/*'],
        disallow: [
          '/api/',
          '/admin/',
          '/_next/',
          // Block search engine indexing of /runners listing index only.
          // Most crawlers honor Allow specificity over Disallow when path
          // matches a longer Allow pattern (`/runners/*` more specific than
          // `/runners`). Belt-and-suspenders with page.tsx notFound().
          '/runners$',
        ],
      },
    ],
    sitemap: 'https://5bib.com/sitemap.xml',
    host: 'https://5bib.com',
  };
}
