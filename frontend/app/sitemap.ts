import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

/**
 * 5BIB / 5Solution multi-host sitemap.
 *
 * Same Next.js app serves 5 hostnames via nginx reverse proxy:
 *   - 5bib.com             → root + /calendar + /hub/* (Promo Hub published)
 *   - solution.5bib.com    → / (canonical for /solution route)
 *   - timing.5bib.com      → / (canonical for /timing route)
 *   - solution.5sport.vn   → / (canonical for /solution-5sport route)
 *   - 5solution.vn         → / (canonical for /solution-5solution route)
 *
 * `/sitemap.xml` on EACH host must list ONLY that host's canonical URLs
 * (Google + AI crawlers expect per-host scope). Branches by `host` header.
 *
 * FEATURE-A · SEO Uplift v1
 */

type ChangeFreq = MetadataRoute.Sitemap[number]['changeFrequency'];

async function fetchPublishedHubs(): Promise<
  Array<{ slug: string; updatedAt: string }>
> {
  try {
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

function detectHost(rawHost: string | null): string {
  const host = (rawHost ?? '').toLowerCase().split(':')[0];
  if (host.endsWith('5solution.vn')) return '5solution.vn';
  if (host.startsWith('timing.')) return 'timing.5bib.com';
  if (host.startsWith('solution.5sport')) return 'solution.5sport.vn';
  if (host.startsWith('solution.')) return 'solution.5bib.com';
  return '5bib.com';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hdr = await headers();
  const host = detectHost(hdr.get('host'));
  const now = new Date();

  if (host === 'solution.5bib.com') {
    return [
      {
        url: 'https://solution.5bib.com/',
        lastModified: now,
        changeFrequency: 'weekly' as ChangeFreq,
        priority: 1,
        alternates: {
          languages: {
            'vi-VN': 'https://solution.5bib.com/',
            'en-US': 'https://solution.5bib.com/?lang=en',
          },
        },
      },
    ];
  }

  if (host === 'timing.5bib.com') {
    return [
      {
        url: 'https://timing.5bib.com/',
        lastModified: now,
        changeFrequency: 'weekly' as ChangeFreq,
        priority: 1,
      },
    ];
  }

  if (host === 'solution.5sport.vn') {
    return [
      {
        url: 'https://solution.5sport.vn/',
        lastModified: now,
        changeFrequency: 'weekly' as ChangeFreq,
        priority: 1,
        alternates: {
          languages: {
            'vi-VN': 'https://solution.5sport.vn/',
            'en-US': 'https://solution.5sport.vn/?lang=en',
          },
        },
      },
    ];
  }

  if (host === '5solution.vn') {
    return [
      {
        url: 'https://5solution.vn/',
        lastModified: now,
        changeFrequency: 'weekly' as ChangeFreq,
        priority: 1,
      },
    ];
  }

  // Default: 5bib.com primary host
  const hubs = await fetchPublishedHubs();
  return [
    {
      url: 'https://5bib.com/',
      lastModified: now,
      changeFrequency: 'weekly' as ChangeFreq,
      priority: 1,
    },
    {
      url: 'https://5bib.com/calendar',
      lastModified: now,
      changeFrequency: 'daily' as ChangeFreq,
      priority: 0.7,
    },
    ...hubs.map((h) => ({
      url: `https://5bib.com/hub/${h.slug}`,
      lastModified: h.updatedAt ? new Date(h.updatedAt) : now,
      changeFrequency: 'weekly' as ChangeFreq,
      priority: 0.8,
    })),
  ];
}
