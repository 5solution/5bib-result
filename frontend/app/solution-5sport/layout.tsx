import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { OrganizationJsonLd } from '@/components/seo/organization-jsonld';
import { FAQJsonLd } from '@/components/seo/faq-jsonld';
import { BreadcrumbJsonLd } from '@/components/seo/breadcrumb-jsonld';
import { sportFaqs } from '@/components/seo/faq-data/5sport';

export const metadata: Metadata = {
  metadataBase: new URL('https://solution.5sport.vn'),
  title: {
    default: '5Sport — Level Up Your Game',
    template: '%s · 5Sport',
  },
  description:
    'Nền tảng thể thao đầu tiên tại Việt Nam kết hợp sàn vé thi đấu, cộng đồng tìm người chơi và công cụ vận hành giải đấu — cho cầu lông và pickleball.',
  keywords: [
    'pickleball Việt Nam',
    'cầu lông phong trào',
    'phần mềm quản lý giải cầu lông',
    'tournament management Vietnam',
    'pickleball rating Vietnam',
    'vé thi đấu cầu lông',
    '5Sport',
    '5Solution',
  ],
  authors: [{ name: '5Solution JSC' }],
  creator: '5Solution JSC',
  publisher: '5Solution JSC',
  alternates: {
    canonical: '/',
    languages: {
      'vi-VN': '/',
      'en-US': '/?lang=en',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
    url: 'https://solution.5sport.vn',
    siteName: '5Sport',
    title: '5Sport — Level Up Your Game',
    description:
      'Sàn vé, cộng đồng và công cụ vận hành giải đấu — cho cầu lông & pickleball.',
    images: [
      {
        url: '/solution-5sport/og.jpg',
        width: 1200,
        height: 630,
        alt: '5Sport — Level Up Your Game',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '5Sport — Level Up Your Game',
    description:
      'Sàn vé, cộng đồng và công cụ vận hành giải đấu — cho cầu lông & pickleball.',
    images: ['/solution-5sport/og.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export const viewport: Viewport = {
  themeColor: '#1400FF',
  width: 'device-width',
  initialScale: 1,
};

export default function Sport5Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/solution-5sport/solution-5sport.css" />
      {/* BR-14: AggregateOffer override (Free / Club ₫500K / Federation ₫2.5M) per biz-strategist § 4.C. */}
      {/* aggregateRating OMITTED Phase 1 — Danny confirm B 2026-05-24 per BR-15(d). Phase 2 add khi có NPS audit doc. */}
      <OrganizationJsonLd
        host="solution.5sport.vn"
        description="Sàn vé thi đấu, cộng đồng tìm người chơi và công cụ vận hành giải đấu — cho cầu lông & pickleball."
        includeSoftwareApp
        offersOverride={{
          lowPrice: '0',
          highPrice: '2500000',
          priceCurrency: 'VND',
          description: 'Free / Club ₫500K / Federation ₫2.5M',
        }}
      />
      <FAQJsonLd host="solution.5sport.vn" faqs={sportFaqs} />
      <BreadcrumbJsonLd
        host="solution.5sport.vn"
        crumbs={[{ name: 'Trang chủ', url: 'https://solution.5sport.vn' }]}
      />

      {/* ── Google Tag Manager — GTM-PLR9LHLZ ───────────────────────────────── */}
      <Script id="s5-gtm-datalayer-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          'page_type': 'landing_page',
          'product': '5sport_platform',
          'environment': 'production'
        });
      `}</Script>
      <Script id="s5-gtm-loader" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-PLR9LHLZ');`}</Script>
      {/* ────────────────────────────────────────────────────────────────────── */}

      <div className="s5-root">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PLR9LHLZ"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {children}
      </div>
    </>
  );
}
