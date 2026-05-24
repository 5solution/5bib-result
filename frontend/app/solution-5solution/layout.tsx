import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { OrganizationJsonLd } from '@/components/seo/organization-jsonld';
import { FAQJsonLd } from '@/components/seo/faq-jsonld';
import { BreadcrumbJsonLd } from '@/components/seo/breadcrumb-jsonld';
import { fiveSolutionFaqs } from '@/components/seo/faq-data/5solution';

export const metadata: Metadata = {
  metadataBase: new URL('https://5solution.vn'),
  title: {
    default: '5Solution — Một nền tảng. Toàn bộ hành trình.',
    template: '%s · 5Solution',
  },
  description:
    'Hệ sinh thái giải pháp toàn diện cho ngành sự kiện thể thao Việt Nam. 5BIB · 5Ticket · 5Pix · 5Sport · 5Tech — bán vé, chip timing, kết quả live, ảnh AI và phần mềm vận hành giải đấu.',
  keywords: [
    '5Solution',
    '5BIB',
    '5Ticket',
    '5Pix',
    '5Sport',
    '5Tech',
    'chip timing Việt Nam',
    'bán vé concert',
    'phần mềm vận hành giải chạy',
    'race timing solution',
    'ảnh AI thể thao',
  ],
  authors: [{ name: '5Solution JSC' }],
  creator: '5Solution JSC',
  publisher: '5Solution JSC',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: 'https://5solution.vn',
    siteName: '5Solution',
    title: '5Solution — Một nền tảng. Toàn bộ hành trình.',
    description:
      'Hệ sinh thái 5BIB, 5Ticket, 5Pix, 5Sport, 5Tech cho ngành sự kiện thể thao Việt Nam.',
    images: [
      {
        url: '/solution-5solution/brand/5bib-hero.jpg',
        width: 1200,
        height: 630,
        alt: '5Solution — Hệ sinh thái sự kiện thể thao',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '5Solution — Một nền tảng. Toàn bộ hành trình.',
    description:
      'Hệ sinh thái 5BIB, 5Ticket, 5Pix, 5Sport, 5Tech cho ngành sự kiện thể thao Việt Nam.',
    images: ['/solution-5solution/brand/5bib-hero.jpg'],
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
};

export const viewport: Viewport = {
  themeColor: '#1D49FF',
  width: 'device-width',
  initialScale: 1,
};

export default function Solution5Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="/solution-5solution/solution-5solution.css"
      />
      {/* Be Vietnam Pro + Plus Jakarta Sans + JetBrains Mono */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap"
      />
      {/* BR-11..12: Umbrella holding — emit subOrganization for 5 sub-brands. NO Offer/Service/SoftwareApp. */}
      {/* aggregateRating OMITTED Phase 1 — Danny confirm B 2026-05-24 per BR-15(d). Phase 2 add khi có NPS audit doc. */}
      <OrganizationJsonLd
        host="5solution.vn"
        description="Hệ sinh thái giải pháp toàn diện cho ngành sự kiện thể thao Việt Nam — 5BIB, 5Ticket, 5Pix, 5Sport, 5Tech."
        subOrganization={[
          { name: '5BIB', url: 'https://solution.5bib.com', '@id': 'https://solution.5bib.com/#org' },
          { name: '5Ticket', url: 'https://5ticket.vn', '@id': 'https://5ticket.vn/#org' },
          { name: '5Pix', url: 'https://5pix.vn', '@id': 'https://5pix.vn/#org' },
          { name: '5Sport', url: 'https://solution.5sport.vn', '@id': 'https://solution.5sport.vn/#org' },
          { name: '5Tech', url: 'https://5tech.vn', '@id': 'https://5tech.vn/#org' },
        ]}
      />
      <FAQJsonLd host="5solution.vn" faqs={fiveSolutionFaqs} />
      <BreadcrumbJsonLd
        host="5solution.vn"
        crumbs={[{ name: 'Trang chủ', url: 'https://5solution.vn' }]}
      />

      {/* ── Google Tag Manager — GTM-WNJV5PD9 ───────────────────────────── */}
      <Script id="sol-gtm-datalayer-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          'page_type': 'landing_page',
          'product': '5solution_umbrella',
          'environment': 'production'
        });
      `}</Script>
      <Script id="sol-gtm-loader" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WNJV5PD9');`}
      </Script>
      {/* ── Google Analytics 4 — G-ND6VCY2B57 (direct gtag) ─────────────── */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-ND6VCY2B57"
        strategy="afterInteractive"
      />
      <Script id="sol-ga4-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-ND6VCY2B57', { send_page_view: true });
      `}</Script>
      {/* ──────────────────────────────────────────────────────────────────── */}

      <div className="sol-root">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WNJV5PD9"
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
