'use client';

import { useEffect, useState } from 'react';
import type { LandingData } from './types';

const NAV_LABELS: Record<string, string> = {
  about: 'Giới thiệu',
  course: 'Cung đường',
  schedule: 'Lịch trình',
  pricing: 'Vé',
  results_embed: 'Kết quả',
  photos_embed: 'Ảnh',
  gallery: 'Thư viện',
  sponsors: 'Tài trợ',
  contact_social: 'Liên hệ',
};

/** FEATURE-083 — Sticky nav: transparent over hero → solid on scroll. */
export default function LandingNav({ data }: { data: LandingData }) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = data.sections.filter(
    (s) => s.enabled && s.type !== 'hero' && NAV_LABELS[s.type],
  );

  return (
    <nav className={solid ? 'landing-nav solid' : 'landing-nav'}>
      <a href="#top" className="brand">
        {data.meta?.title ?? 'Giải chạy'}
      </a>
      <div className="navlinks">
        {links.map((s) => (
          <a key={s.id} href={`#${s.anchor ?? s.type}`}>
            {NAV_LABELS[s.type]}
          </a>
        ))}
      </div>
      <a href="#pricing" className="navcta">
        Đăng ký
      </a>
    </nav>
  );
}
