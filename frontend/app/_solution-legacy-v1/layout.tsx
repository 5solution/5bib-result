import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { OrganizationJsonLd } from '@/components/seo/organization-jsonld';
import { FAQJsonLd } from '@/components/seo/faq-jsonld';
import { BreadcrumbJsonLd } from '@/components/seo/breadcrumb-jsonld';
import { solutionFaqs } from '@/components/seo/faq-data/solution-5bib';

export const metadata: Metadata = {
  metadataBase: new URL('https://solution.5bib.com'),
  title: {
    default: '5BIB — Cổng đăng ký & quản lý VĐV #1 Việt Nam',
    template: '%s · 5BIB',
  },
  description:
    'Cổng đăng ký, thanh toán, BIB, wave, check-in QR và quản lý VĐV cho giải chạy. 72h mở bán. 120k runner. Tiếng Việt native.',
  keywords: [
    '5BIB',
    'phần mềm quản lý giải chạy',
    'đăng ký giải marathon',
    'race registration Vietnam',
    'BIB number',
    'check-in QR',
    'chip timing Việt Nam',
    'cổng bán vé giải chạy',
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
    url: 'https://solution.5bib.com',
    siteName: '5BIB',
    title: '5BIB — Cổng đăng ký & quản lý VĐV #1 Việt Nam',
    description:
      'Form, thanh toán, BIB, wave, check-in QR, email blast, dashboard — một nền tảng. 72 giờ mở bán.',
    images: [
      {
        url: '/solution/brand/5bib-hero.jpg',
        width: 1200,
        height: 630,
        alt: '5BIB — Cổng đăng ký & quản lý VĐV',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '5BIB — Cổng đăng ký & quản lý VĐV #1 Việt Nam',
    description: 'Form, thanh toán, BIB, wave, check-in QR, email blast, dashboard.',
    images: ['/solution/brand/5bib-hero.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: { icon: '/solution/logos/5bib-logo.png' },
};

export const viewport: Viewport = {
  themeColor: '#060818',
  width: 'device-width',
  initialScale: 1,
};

export default function SolutionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/solution/solution.css" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      {/* BR-09: AggregateOffer override (Free / Standard ₫5M / Premium ₫15M + 1.5-2% transaction fee) per biz-strategist § 2.C. */}
      {/* aggregateRating OMITTED Phase 1 — Danny confirm B 2026-05-24 per BR-15(d). Phase 2 add khi có NPS audit doc. */}
      <OrganizationJsonLd
        host="solution.5bib.com"
        description="Cổng đăng ký, thanh toán, BIB, wave, check-in QR và quản lý VĐV cho giải chạy."
        includeSoftwareApp
        offersOverride={{
          lowPrice: '0',
          highPrice: '15000000',
          priceCurrency: 'VND',
          description: 'Free / Standard ₫5M / Premium ₫15M + 1.5-2% transaction fee',
        }}
      />
      <FAQJsonLd host="solution.5bib.com" faqs={solutionFaqs} />
      <BreadcrumbJsonLd
        host="solution.5bib.com"
        crumbs={[{ name: 'Trang chủ', url: 'https://solution.5bib.com' }]}
      />

      {/* GTM */}
      <Script id="s2-gtm-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ page_type: 'landing_page', product: '5bib_manager', environment: 'production' });
      `}</Script>
      <Script id="s2-gtm-loader" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WNJV5PD9');`}
      </Script>
      {/* GA4 direct */}
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-ND6VCY2B57" strategy="afterInteractive" />
      <Script id="s2-ga4-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-ND6VCY2B57', { send_page_view: true });
      `}</Script>

      <noscript>
        <iframe
          src="https://www.googletagmanager.com/ns.html?id=GTM-WNJV5PD9"
          height="0" width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
      <div className="solution-page-root">{children}</div>
    </>
  );
}
