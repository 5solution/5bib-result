import type { Metadata, Viewport } from 'next';
import './timing.css';
import TimingBodyClass from './TimingBodyClass';

export const metadata: Metadata = {
  title: '5BIB Timing — Dịch vụ bấm giờ chip chuyên nghiệp cho giải chạy tại Việt Nam',
  description:
    'Công nghệ RaceResult (Đức), 100+ giải đã triển khai, 94,000+ VĐV đã được bấm giờ. Báo giá chi tiết trong 24 giờ. Liên hệ info@5bib.com.',
  openGraph: {
    title: '5BIB Timing — Chip Timing chuyên nghiệp',
    description:
      'Bấm giờ chip RaceResult Certified. 100+ giải, 94K+ VĐV, độ chính xác 0.01 giây. Báo giá 24h.',
    images: [{ url: '/logo.png', width: 1024, height: 1024 }],
    siteName: '5BIB Timing',
    locale: 'vi_VN',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#2B5EE8',
};

export default function TimingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TimingBodyClass />
      <div className="tl-wrap">{children}</div>
    </>
  );
}
