import type { Metadata, Viewport } from 'next';

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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://solution.5sport.vn/#org',
        name: '5Solution JSC',
        url: 'https://solution.5sport.vn',
        sameAs: ['https://5bib.com', 'https://facebook.com/5sport.vn'],
      },
      {
        '@type': 'SoftwareApplication',
        name: '5Sport — Tournament & Community Platform',
        operatingSystem: 'Web, iOS, Android',
        applicationCategory: 'SportsApplication',
        offers: { '@type': 'Offer', priceCurrency: 'VND', price: '0' },
        provider: { '@id': 'https://solution.5sport.vn/#org' },
      },
    ],
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/solution-5sport/solution-5sport.css" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="s5-root">{children}</div>
    </>
  );
}
