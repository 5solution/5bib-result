/**
 * FAQPage JSON-LD emitter — shared across 4 landings.
 *
 * Pattern: <script type="application/ld+json" dangerouslySetInnerHTML> per
 * BR-01 (NOT next/script — AI crawlers may miss delayed-execution scripts).
 * Schema shape: @graph + @id anchor per BR-02. FEATURE-051 athlete-profile
 * FAQPage precedent.
 *
 * FAQ data is colocated under `./faq-data/{landing}.ts` exporting FAQItem[]
 * (verbatim quote from research-mkt-brief.md § X.C per BR-07/10b/12b/14b).
 *
 * FEATURE-060 · SEO + AI Search Uplift
 */

export type FAQItem = { q: string; a: string };

export function FAQJsonLd({
  host,
  faqs,
  lang = 'vi-VN',
}: {
  host: string;
  faqs: FAQItem[];
  lang?: 'vi-VN' | 'en-US';
}) {
  const url = `https://${host}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${url}/#faq`,
        inLanguage: lang,
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
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
