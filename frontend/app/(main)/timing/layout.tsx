import type { Metadata, Viewport } from 'next';
import './timing.css';
import TimingBodyClass from './TimingBodyClass';
import { OrganizationJsonLd } from '@/components/seo/organization-jsonld';

export const metadata: Metadata = {
  metadataBase: new URL('https://timing.5bib.com'),
  title: {
    default: '5BIB Timing — Dịch vụ bấm giờ chip chuyên nghiệp cho giải chạy tại Việt Nam',
    template: '%s · 5BIB Timing',
  },
  description:
    'Công nghệ RaceResult (Đức) certified. 100+ giải đã triển khai, 94,000+ VĐV đã được bấm giờ với độ chính xác 0.01 giây. Báo giá chi tiết trong 24 giờ. Liên hệ info@5bib.com.',
  keywords: [
    'chip timing Việt Nam',
    'bấm giờ chip marathon',
    'dịch vụ chip timing',
    'RaceResult Vietnam',
    'race timing chip',
    'phần mềm bấm giờ giải chạy',
    'chip timing UTMB',
    'BIB number timing',
    'split time marathon',
    'live result giải chạy',
    '5BIB Timing',
    'chronotrack alternative Vietnam',
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
    url: 'https://timing.5bib.com',
    siteName: '5BIB Timing',
    title: '5BIB Timing — Chip Timing chuyên nghiệp #1 Việt Nam',
    description:
      'Bấm giờ chip RaceResult Certified. 100+ giải, 94K+ VĐV, độ chính xác 0.01 giây. Báo giá 24h. Live result, split time, certificate auto-gen.',
    images: [
      {
        url: '/logo.png',
        width: 1024,
        height: 1024,
        alt: '5BIB Timing — Professional Chip Timing for Vietnam races',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '5BIB Timing — Chip Timing chuyên nghiệp #1 Việt Nam',
    description:
      'RaceResult chip timing. 100+ giải, 94K+ VĐV, độ chính xác 0.01s. Báo giá 24h.',
    images: ['/logo.png'],
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
  icons: { icon: '/logo.png' },
};

export const viewport: Viewport = {
  themeColor: '#2B5EE8',
  width: 'device-width',
  initialScale: 1,
};

export default function TimingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TimingBodyClass />
      <OrganizationJsonLd
        host="timing.5bib.com"
        description="Dịch vụ chip timing chuyên nghiệp cho giải chạy tại Việt Nam — RaceResult certified, 100+ giải đã triển khai."
        includeSoftwareApp
      />
      <div className="tl-wrap">{children}</div>
    </>
  );
}
