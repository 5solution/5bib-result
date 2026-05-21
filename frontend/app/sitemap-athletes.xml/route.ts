/**
 * FEATURE-047 Phase 1B — Athlete sitemap for SEO discovery.
 *
 * BR-47-23: Top 50K most-active athletes by lastRaceDate DESC.
 * NO PII exposure — slugs + lastRaceDate only.
 *
 * ISR 24h cache. Pattern mirrors `sitemap-races.xml/route.ts`.
 */

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';
const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://result.5bib.com';
const SITEMAP_LIMIT = 50000;

interface SitemapEntry {
  slug: string;
  lastRaceDate?: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const lastmod = e.lastRaceDate
        ? `\n    <lastmod>${escapeXml(e.lastRaceDate)}</lastmod>`
        : '';
      return `  <url>
    <loc>${escapeXml(`${PUBLIC_BASE_URL}/runners/${e.slug}`)}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export async function GET() {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/race-results/athletes/sitemap?limit=${SITEMAP_LIMIT}`,
      { next: { revalidate: 86400, tags: ['sitemap:athletes'] } },
    );
    if (!res.ok) {
      return new NextResponse(buildXml([]), {
        status: 200,
        headers: { 'Content-Type': 'application/xml' },
      });
    }
    const entries = (await res.json()) as SitemapEntry[];
    return new NextResponse(buildXml(entries), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (err) {
    return new NextResponse(buildXml([]), {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}

export const revalidate = 86400;
