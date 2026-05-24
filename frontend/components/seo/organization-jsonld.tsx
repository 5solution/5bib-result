/**
 * Unified Organization + WebSite JSON-LD for the 5Solution brand family.
 *
 * Mount once per landing-page layout. The `sameAs` array links the 4
 * sibling subdomains so Google + AI crawlers understand they belong to
 * the same legal entity (5Solution JSC) — strengthens brand authority
 * + enables entity-level Knowledge Panel.
 *
 * FEATURE-A · SEO Uplift v1
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

export function OrganizationJsonLd({
  host,
  description,
  includeWebSite = true,
  includeSoftwareApp = false,
}: {
  host: OrgJsonLdHost;
  description?: string;
  includeWebSite?: boolean;
  includeSoftwareApp?: boolean;
}) {
  const meta = HOST_META[host];

  const graph: Array<Record<string, unknown>> = [
    {
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
    },
  ];

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
    graph.push({
      '@type': 'SoftwareApplication',
      '@id': `${meta.url}/#app`,
      name: meta.appName,
      operatingSystem: 'Web, iOS, Android',
      applicationCategory: meta.appCategory ?? 'BusinessApplication',
      offers: { '@type': 'Offer', priceCurrency: 'VND', price: '0' },
      provider: { '@id': `${meta.url}/#org` },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        reviewCount: '87',
      },
    });
  }

  const jsonLd = { '@context': 'https://schema.org', '@graph': graph };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
