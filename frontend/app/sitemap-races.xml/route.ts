/**
 * FEATURE-036 — Dynamic XML sitemap for SEO routes /giai-chay/*.
 *
 * Manager Plan §Clarification #1 Option A — custom route handler to get exact
 * URL `/sitemap-races.xml` without relying on 5Ticket Vercel rewrite extras.
 *
 * BR-16~20:
 *   - tên file `/sitemap-races.xml` (NOT `/sitemap.xml` vì 5bib.com root đã có)
 *   - entries per race: detail + results (chỉ nếu live/ended)
 *   - lastmod, priority, changeFrequency per status
 *
 * BR-08: race status='draft' KHÔNG xuất hiện (filter at API layer + defensive).
 * BR-15: noindex on `result.5bib.com` host enforced separately via metadata.
 */

import { getAllRaces } from "@/lib/seo-api";

// Daily ISR — matches BR-24 sitemap revalidate
export const revalidate = 86400;

interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildEntries(): Promise<SitemapEntry[]> {
  return getAllRaces().then((races) => {
    const now = new Date().toISOString();
    const entries: SitemapEntry[] = [];

    // Listing root
    entries.push({
      loc: "https://5bib.com/giai-chay",
      lastmod: now,
      changefreq: "daily",
      priority: "0.8",
    });

    for (const race of races) {
      if (race.status === "draft") continue; // belt-and-suspenders BR-08
      if (!race.slug) continue; // skip races without slug (cron not run yet)
      // F-037: on-sale races now have internal detail page (resolved
      // TD-F036-09). Include in sitemap with priority 0.9 (active type
      // same as MongoDB pre_race/live per BR-37-12).

      const isOnSale = race.source === "on-sale";
      const isEnded = race.status === "ended";
      const isActive =
        isOnSale || race.status === "pre_race" || race.status === "live";
      const isLive = race.status === "live";

      const lastmodDate = isEnded && race.endDate
        ? new Date(race.endDate).toISOString()
        : now;

      // Detail entry — BR-17 + BR-37-12
      entries.push({
        loc: `https://5bib.com/giai-chay/${race.slug}`,
        lastmod: lastmodDate,
        changefreq: isEnded ? "yearly" : "daily",
        priority: isActive ? "0.9" : "0.6",
      });

      // Results entry — only if live OR ended (BR-17, NOT on-sale)
      if (!isOnSale && (isEnded || isLive)) {
        entries.push({
          loc: `https://5bib.com/giai-chay/${race.slug}/ket-qua`,
          lastmod: lastmodDate,
          changefreq: isEnded ? "monthly" : "hourly",
          priority: isEnded ? "0.5" : "0.8",
        });
      }
    }

    return entries;
  });
}

export async function GET() {
  const entries = await buildEntries();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
