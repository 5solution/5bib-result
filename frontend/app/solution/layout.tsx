import type { Metadata, Viewport } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  metadataBase: new URL('https://5bib.com'),
  title: {
    default: '5BIB — Cổng đăng ký & quản lý VĐV #1 Việt Nam',
    template: '%s · 5BIB',
  },
  description:
    'Nền tảng đăng ký, thanh toán, gán BIB, check-in QR và quản lý VĐV cho giải chạy. 72h mở bán, tiếp cận 120k runner trên network 5BIB.',
  keywords: [
    'đăng ký giải chạy',
    'bán vé giải chạy',
    'BIB marathon',
    'phần mềm quản lý giải chạy',
    'race registration Vietnam',
    'timing chip',
    '5BIB',
    '5Sport',
    'VTV LPBank Marathon',
  ],
  authors: [{ name: '5Solution JSC' }],
  creator: '5Solution JSC',
  publisher: '5Solution JSC',
  alternates: {
    canonical: '/solution',
    languages: {
      'vi-VN': '/solution',
      'en-US': '/solution?lang=en',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
    url: 'https://5bib.com/solution',
    siteName: '5BIB',
    title: '5BIB — Cổng đăng ký & quản lý VĐV #1 Việt Nam',
    description:
      'Mở bán giải chạy trong 72h. Form đăng ký, thanh toán VN, BIB, check-in QR, dashboard VĐV + BTC. Tiếp cận 120k runner.',
    images: [
      {
        url: '/solution/brand/5bib-hero.jpg',
        width: 1200,
        height: 630,
        alt: '5BIB — race registration platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '5BIB — Cổng đăng ký & quản lý VĐV #1 Việt Nam',
    description:
      'Mở bán giải chạy trong 72h. 120k runner. Form, thanh toán, BIB, check-in QR, dashboard.',
    images: ['/solution/brand/5bib-hero.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/solution/logos/5bib-logo.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0026B3',
  width: 'device-width',
  initialScale: 1,
};

export default function SolutionLayout({ children }: { children: React.ReactNode }) {
  // JSON-LD structured data — helps Google SERP for 5BIB as a SoftwareApplication
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://5bib.com/#org',
        name: '5Solution JSC',
        url: 'https://5bib.com',
        logo: 'https://5bib.com/solution/logos/5bib-logo.png',
        sameAs: ['https://www.facebook.com/5bib.vn'],
      },
      {
        '@type': 'SoftwareApplication',
        name: '5BIB — Race Registration & Athlete Management',
        operatingSystem: 'Web, iOS, Android',
        applicationCategory: 'BusinessApplication',
        offers: { '@type': 'Offer', priceCurrency: 'VND', price: '0' },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '87',
        },
        provider: { '@id': 'https://5bib.com/#org' },
      },
    ],
  };

  return (
    <>
      {/* Solution-scoped design tokens + typography — does NOT affect rest of app */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/solution/solution.css" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Google Tag Manager ──────────────────────────────────────────────── */}
      {/* Step 1: dataLayer init — must fire before GTM snippet */}
      <Script id="gtm-datalayer-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          'page_type': 'landing_page',
          'product': '5bib_platform',
          'environment': 'production'
        });
      `}</Script>
      {/* Step 2: GTM loader */}
      <Script id="gtm-loader" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-TGL3KFCS');`}</Script>
      {/* ────────────────────────────────────────────────────────────────────── */}

      <div className="solution-root">
        {/* GTM noscript fallback — inside body, as high as possible in this layout */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-TGL3KFCS"
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
