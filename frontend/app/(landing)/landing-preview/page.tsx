import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import type { LandingData } from '@/components/landing/types';
import RaceLandingRenderer from '@/components/landing/RaceLandingRenderer';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

/**
 * FEATURE-083 — DEV-ONLY visual harness (sample data covering all 10 sections).
 * Open at /__preview during `next dev` to review the renderer without backend.
 * 404s in production (guard below) so it's safe on the branch. Remove before
 * the final merge to main if desired.
 */
export const dynamic = 'force-dynamic';

const IMG = 'https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=1600&q=75';
const IMG2 = 'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=1200&q=75';
const IMG3 = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=600&q=72';
const IMG4 = 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?auto=format&fit=crop&w=600&q=72';

const SAMPLE: LandingData = {
  id: 'preview',
  raceRef: { raceId: 'r1', mysqlRaceId: 48217, slug: 'halong-marathon-2026' },
  meta: { title: 'Vịnh Hạ Long Marathon 2026', description: 'Giải chạy bên bờ di sản', lang: 'vi' },
  theme: { main: '#ea580c', sec: '#1d4ed8', heroOverlay: 0.45 },
  subdomain: 'halong-marathon',
  sections: [
    { id: 's1', type: 'hero', variant: 'image', enabled: true, order: 0, data: {
      title: 'VỊNH HẠ LONG MARATHON 2026', subtitle: 'Ultra Trail · Quảng Ninh',
      media: IMG, countdownTo: '2026-09-14T05:00:00+07:00',
      date: '14 Tháng 3, 2026', location: 'Bãi Cháy, Quảng Ninh',
      ctaButtons: [{ label: 'Đăng ký ngay', href: 'https://5bib.com', style: 'primary' }, { label: 'Xem cung đường', href: '#course', style: 'ghost' }],
    } },
    { id: 's2', type: 'about', variant: 'stats', enabled: true, order: 1, data: {
      paragraphs: ['Vịnh Hạ Long Marathon đưa runner băng qua cung đường ven Di sản Thiên nhiên Thế giới — từ bãi biển Bãi Cháy đến những con dốc nhìn ra hàng nghìn đảo đá.'],
      stats: [{ num: '5.000+', label: 'Vận động viên' }, { num: '4', label: 'Cự ly' }, { num: '12', label: 'Quốc gia' }, { num: '3', label: 'Mùa tổ chức' }],
      image: IMG2, cta: { label: 'Đăng ký tham gia', href: '#pricing' }, cornerBadge: 'ITRA · 3 điểm',
    } },
    { id: 's3', type: 'course', variant: 'default', enabled: true, order: 2, data: {
      courses: [
        { key: '5k', label: '5K', terrainLabel: 'Road', dist: '5,2', gain: 80, aid: 2, cutoff: '1:30', terrain: '● Đường nhựa · phù hợp người mới', elevation: [10,12,14,18,22,20,24,30,28,26,30,34,30,28,32,36,40,36,34,30,28,24,20,16] },
        { key: '21k', label: '21K', terrainLabel: 'Trail', dist: '21,1', gain: 650, aid: 5, cutoff: '4:30', terrain: '● Trail đồi · kỹ thuật trung bình', elevation: [20,40,90,140,120,180,240,200,260,330,290,360,420,380,300,360,300,240,180,220,140,90,60,30] },
      ],
    } },
    { id: 's4', type: 'schedule', variant: 'timeline', enabled: true, order: 3, data: {
      items: [
        { day: 'Thứ 7 · 13.03 — Nhận BIB & EXPO', time: '08:00 – 18:00', title: 'Race EXPO & nhận racekit', location: 'Quảng trường Sun World, Bãi Cháy' },
        { day: 'Chủ Nhật · 14.03 — Ngày đua', time: '04:00', title: 'Xuất phát 42K (Wave A)', location: 'Cổng Start chính', key: true },
        { time: '05:00 – 05:30', title: 'Xuất phát 21K · 10K · 5K', location: 'Cổng Start chính', key: true },
        { time: '09:30', title: 'Lễ trao giải & Gala', location: 'Sân khấu chính' },
      ],
    } },
    { id: 's5', type: 'pricing', variant: 'default', enabled: true, order: 4, data: {
      tiers: [
        { name: '5K', sub: 'FUN RUN', price: 250000, compareAtPrice: 350000, earlyBirdLabel: '● Early bird · còn 12 ngày', includes: ['BIB + chip điện tử', 'Áo finisher', 'Nước + trạm y tế'], cta: { label: 'Đăng ký', href: 'https://5bib.com' } },
        { name: '21K', sub: 'HALF', price: 520000, compareAtPrice: 650000, featured: true, earlyBirdLabel: '● Early bird · còn 12 ngày', includes: ['BIB + chip + medal cao cấp', 'Áo kỹ thuật + túi runner', 'E-certificate + ảnh AI'], cta: { label: 'Đăng ký', href: 'https://5bib.com' } },
        { name: '42K', sub: 'FULL', price: 780000, compareAtPrice: 950000, earlyBirdLabel: '● Early bird · còn 12 ngày', includes: ['Trọn gói 21K +', 'Drop-bag + pacer', 'Live tracking GPS'], cta: { label: 'Đăng ký', href: 'https://5bib.com' } },
      ],
    } },
    { id: 's6', type: 'results_embed', variant: 'default', enabled: true, order: 5, data: {
      resultUrl: 'https://result.5bib.com/giai-chay/halong-marathon-2026', courseLabel: '21K',
      rows: [
        { rank: 1, name: 'Nguyễn Văn Hùng', cat: 'Nam · 30-39', bib: '21048', chip: '1:14:22', pace: '3:31/km' },
        { rank: 2, name: 'Trần Quốc Bảo', cat: 'Nam · 18-29', bib: '21133', chip: '1:16:05', pace: '3:36/km' },
        { rank: 3, name: 'Lê Minh Khoa', cat: 'Nam · 30-39', bib: '21007', chip: '1:18:40', pace: '3:43/km' },
        { rank: 4, name: 'Phạm Thu Hà', cat: 'Nữ · 18-29', bib: '21210', chip: '1:21:12', pace: '3:51/km' },
      ],
    } },
    { id: 's7', type: 'photos_embed', variant: 'default', enabled: true, order: 6, data: {
      pixEventUrl: 'https://5pix.org/e/halong-marathon',
      sampleImages: [IMG3, IMG4, IMG2, IMG, IMG3, IMG4, IMG2, IMG],
    } },
    { id: 's8', type: 'gallery', variant: 'bento', enabled: true, order: 7, data: {
      items: [
        { type: 'video', url: IMG, duration: '2:14' },
        { type: 'image', url: IMG3 }, { type: 'image', url: IMG4 },
        { type: 'image', url: IMG2 }, { type: 'image', url: IMG },
        { type: 'video', url: IMG4, duration: '0:48' }, { type: 'image', url: IMG3 },
      ],
    } },
    { id: 's9', type: 'sponsors', variant: 'tier', enabled: true, order: 8, data: {
      tiers: [
        { level: 'diamond', logos: [{ name: 'SUNWORLD' }, { name: 'VIETCOMBANK' }] },
        { level: 'gold', logos: [{ name: 'COROS' }, { name: 'Garmin' }, { name: 'Number 1' }, { name: 'Pocari' }] },
        { level: 'silver', logos: [{ name: '5BIB' }, { name: '5Pix' }, { name: 'Salonpas' }, { name: 'Decathlon' }, { name: 'Strava' }, { name: 'Revive' }] },
      ],
    } },
    { id: 's10', type: 'contact_social', variant: 'default', enabled: true, order: 9, data: {
      hotline: '1900 6868', email: 'hotro@halongmarathon.vn', address: 'Quảng trường Sun World, Bãi Cháy',
      zaloUrl: '#', zaloOaName: 'Hạ Long Marathon', fbPageUrl: '#',
      socials: [{ platform: 'facebook', url: '#' }, { platform: 'instagram', url: '#' }, { platform: 'youtube', url: '#' }, { platform: 'strava', url: '#' }],
      finalCtaHref: '#pricing',
    } },
  ],
};

export default function LandingPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  const themeVars = { '--main': SAMPLE.theme.main, '--sec': SAMPLE.theme.sec } as CSSProperties;
  return (
    <div id="top" className="landing-root" style={themeVars}>
      <LandingNav data={SAMPLE} />
      <RaceLandingRenderer data={SAMPLE} />
      <LandingFooter data={SAMPLE} />
    </div>
  );
}
