import type { MetadataRoute } from 'next';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

/**
 * 5BIB Sitemap — public-facing URLs.
 *
 * Static routes (homepage, solution pages) plus dynamic published
 * Promo Hub pages (FEATURE-027). Hub URLs fetched server-side at build
 * time + revalidated periodically by Next.js sitemap caching.
 */
async function fetchPublishedHubs(): Promise<
  Array<{ slug: string; updatedAt: string }>
> {
  try {
    // Admin-protected list endpoint — for sitemap we use status filter +
    // pageSize=200 (>= total expected). If endpoint requires auth Logto
    // proxy already exists; sitemap.ts runs server-side and BACKEND_URL
    // is internal so no auth required for now (controlled environment).
    const res = await fetch(
      `${BACKEND_URL}/api/promo-hubs?status=published&pageSize=200`,
      { next: { revalidate: 3600, tags: ['promo-hubs-sitemap'] } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : [];
    return items
      .filter((h: { slug?: string; updatedAt?: string }) => !!h.slug)
      .map((h: { slug: string; updatedAt: string }) => ({
        slug: h.slug,
        updatedAt: h.updatedAt,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://5bib.com';
  const now = new Date();
  const hubs = await fetchPublishedHubs();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/solution`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${base}/solution?lang=en`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    // FEATURE-027 — Promo Hub published pages
    ...hubs.map((h) => ({
      url: `${base}/hub/${h.slug}`,
      lastModified: h.updatedAt ? new Date(h.updatedAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
