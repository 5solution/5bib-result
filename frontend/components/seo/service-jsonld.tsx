/**
 * Service JSON-LD emitter — used by timing.5bib.com per BR-04..06.
 *
 * Service @type with AggregateOffer + optional AggregateRating. The
 * `aggregateRating` prop is OPTIONAL — when undefined, the field is OMITTED
 * from output (NOT emitted as null/empty). This is the BR-15(d) safe path —
 * defense against Google spam-rich-result penalty when source data is not
 * verified. Phase 1 the prop is intentionally NOT passed in any layout per
 * Danny PAUSE confirm 2026-05-24 (B option per BR-15(d)).
 *
 * FEATURE-060 · SEO + AI Search Uplift
 */

export function ServiceJsonLd({
  host,
  serviceType,
  description,
  offer,
  aggregateRating,
}: {
  host: string;
  serviceType: string;
  description: string;
  offer: { lowPrice: string; highPrice: string; priceCurrency: 'VND' };
  aggregateRating?: { ratingValue: string; reviewCount: string };
}) {
  const url = `https://${host}`;
  const node: Record<string, unknown> = {
    '@type': 'Service',
    '@id': `${url}/#service`,
    serviceType,
    name: serviceType,
    description,
    provider: { '@id': `${url}/#org` },
    areaServed: { '@type': 'Country', name: 'Vietnam' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: offer.priceCurrency,
      lowPrice: offer.lowPrice,
      highPrice: offer.highPrice,
    },
  };
  if (aggregateRating) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ...aggregateRating,
    };
  }
  const jsonLd = { '@context': 'https://schema.org', '@graph': [node] };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
