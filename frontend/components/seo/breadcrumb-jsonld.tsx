/**
 * BreadcrumbList JSON-LD emitter — used by all 4 landings per BR-17.
 *
 * Phase 1: root-level single crumb [{position:1, name:'Trang chủ', item:url}].
 * Phase 2 will enrich position 2+ when sub-pages are indexed.
 *
 * FEATURE-060 · SEO + AI Search Uplift
 */

export type Crumb = { name: string; url: string };

export function BreadcrumbJsonLd({
  host,
  crumbs,
}: {
  host: string;
  crumbs: Crumb[];
}) {
  const url = `https://${host}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}/#breadcrumb`,
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: c.url,
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
