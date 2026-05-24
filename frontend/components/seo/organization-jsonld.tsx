/**
 * Unified Organization + WebSite JSON-LD for the 5Solution brand family.
 *
 * Mount once per landing-page layout. The `sameAs` array links the 4
 * sibling subdomains so Google + AI crawlers understand they belong to
 * the same legal entity (5Solution JSC) — strengthens brand authority
 * + enables entity-level Knowledge Panel.
 *
 * FEATURE-A · SEO Uplift v1
 *
 * FEATURE-060 EXTENSIONS (backward-compat — undefined prop = FEATURE-A behaviour):
 * - `offersOverride` — replace SoftwareApplication.offers with AggregateOffer
 *   (BR-09 solution.5bib, BR-14 5sport)
 * - `aggregateRating` — explicit opt-in rating emit. BR-15(c) mandates
 *   inline `sourceComment` documenting the source NPS/audit doc. When
 *   undefined, aggregateRating field is OMITTED entirely (BR-15(d) safe
 *   path — defense vs Google spam-rich-result penalty). Note: FEATURE-A
 *   shipped with a hardcoded 4.9/87 inside includeSoftwareApp — Phase 1
 *   per Danny PAUSE 2026-05-24 (B per BR-15(d)) we KEEP that historical
 *   default ONLY when explicit opt-in is absent AND includeSoftwareApp
 *   is true; the explicit `aggregateRating` prop, when provided, takes
 *   precedence. The Phase 1 layouts intentionally do NOT pass this prop.
 * - `subOrganization` — Organization.subOrganization array (BR-12,
 *   5solution.vn umbrella holding lists 5BIB/5Ticket/5Pix/5Sport/5Tech).
 */

export type OrgJsonLdHost =
  | '5bib.com'
  | 'solution.5bib.com'
  | 'timing.5bib.com'
  | '5solution.vn'
  | 'solution.5sport.vn';

const SIBLING_URLS = [
  'https://5bib.com',
  'https://solution.5bib.com',
  'https://timing.5bib.com',
  'https://result.5bib.com',
  'https://5solution.vn',
  'https://solution.5sport.vn',
  'https://www.facebook.com/5bib.vn',
  'https://www.facebook.com/5sport.vn',
];

const HOST_META: Record<OrgJsonLdHost, {
  url: string;
  brandName: string;
  logoPath: string;
  appName?: string;
  appCategory?: string;
}> = {
  '5bib.com': {
    url: 'https://5bib.com',
    brandName: '5BIB',
    logoPath: '/logo.png',
  },
  'solution.5bib.com': {
    url: 'https://solution.5bib.com',
    brandName: '5BIB Manager',
    logoPath: '/solution/logos/5bib-logo.png',
    appName: '5BIB Manager — Race Registration & Athlete Management',
    appCategory: 'BusinessApplication',
  },
  'timing.5bib.com': {
    url: 'https://timing.5bib.com',
    brandName: '5BIB Timing',
    logoPath: '/logo.png',
    appName: '5BIB Timing — Professional Chip Timing Service',
    appCategory: 'SportsApplication',
  },
  '5solution.vn': {
    url: 'https://5solution.vn',
    brandName: '5Solution',
    logoPath: '/solution-5solution/logos/5bib-logo.png',
  },
  'solution.5sport.vn': {
    url: 'https://solution.5sport.vn',
    brandName: '5Sport',
    logoPath: '/solution-5sport/logos/5bib-logo.png',
    appName: '5Sport — Tournament & Community Platform',
    appCategory: 'SportsApplication',
  },
};

export type OffersOverride = {
  lowPrice: string;
  highPrice: string;
  priceCurrency: 'VND';
  description?: string;
};

export type AggregateRatingProp = {
  ratingValue: string;
  reviewCount: string;
  /** BR-15(c) — inline source doc reference, e.g. "NPS log Q1/2026 n=42". */
  sourceComment: string;
};

export type SubOrgEntry = {
  name: string;
  url: string;
  '@id': string;
};

export function OrganizationJsonLd({
  host,
  description,
  includeWebSite = true,
  includeSoftwareApp = false,
  offersOverride,
  aggregateRating,
  subOrganization,
}: {
  host: OrgJsonLdHost;
  description?: string;
  includeWebSite?: boolean;
  includeSoftwareApp?: boolean;
  offersOverride?: OffersOverride;
  aggregateRating?: AggregateRatingProp;
  subOrganization?: SubOrgEntry[];
}) {
  const meta = HOST_META[host];

  const orgNode: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${meta.url}/#org`,
    name: '5Solution JSC',
    legalName: 'Công ty Cổ phần 5BIB',
    alternateName: ['5Solution', '5BIB', '5Sport'],
    url: meta.url,
    logo: `${meta.url}${meta.logoPath}`,
    foundingDate: '2024',
    foundingLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressCountry: 'VN' },
    },
    areaServed: { '@type': 'Country', name: 'Vietnam' },
    sameAs: SIBLING_URLS.filter((u) => !u.includes(host)),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        email: 'info@5bib.com',
        contactType: 'sales',
        availableLanguage: ['Vietnamese', 'English'],
      },
    ],
  };

  if (subOrganization && subOrganization.length > 0) {
    orgNode.subOrganization = subOrganization.map((s) => ({
      '@type': 'Organization',
      '@id': s['@id'],
      name: s.name,
      url: s.url,
    }));
  }

  const graph: Array<Record<string, unknown>> = [orgNode];

  if (includeWebSite) {
    graph.push({
      '@type': 'WebSite',
      '@id': `${meta.url}/#website`,
      url: meta.url,
      name: meta.brandName,
      description,
      inLanguage: ['vi-VN', 'en-US'],
      publisher: { '@id': `${meta.url}/#org` },
    });
  }

  if (includeSoftwareApp && meta.appName) {
    const appNode: Record<string, unknown> = {
      '@type': 'SoftwareApplication',
      '@id': `${meta.url}/#app`,
      name: meta.appName,
      operatingSystem: 'Web, iOS, Android',
      applicationCategory: meta.appCategory ?? 'BusinessApplication',
      provider: { '@id': `${meta.url}/#org` },
    };

    if (offersOverride) {
      const offerObj: Record<string, unknown> = {
        '@type': 'AggregateOffer',
        priceCurrency: offersOverride.priceCurrency,
        lowPrice: offersOverride.lowPrice,
        highPrice: offersOverride.highPrice,
      };
      if (offersOverride.description) {
        offerObj.description = offersOverride.description;
      }
      appNode.offers = offerObj;
    } else {
      // FEATURE-A behaviour preserved when no offersOverride supplied.
      appNode.offers = { '@type': 'Offer', priceCurrency: 'VND', price: '0' };
    }

    if (aggregateRating) {
      // aggregateRating OMITTED Phase 1 — Danny confirm B 2026-05-24
      // per BR-15(d). Phase 2 add khi có NPS audit doc.
      // sourceComment captured but NOT emitted to schema (JSON-LD has no
      // comments) — it lives in caller code for audit trail per BR-15(c).
      const { sourceComment: _sourceComment, ...ratingFields } = aggregateRating;
      appNode.aggregateRating = {
        '@type': 'AggregateRating',
        ...ratingFields,
      };
    }
    // else: aggregateRating field intentionally OMITTED — see BR-15(d).

    graph.push(appNode);
  }

  const jsonLd = { '@context': 'https://schema.org', '@graph': graph };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
