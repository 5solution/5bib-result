'use client';

import * as React from 'react';
import Image from 'next/image';
import { IArr, useT, type Lang } from './solution-icons';

type Props = {
  lang: Lang;
  setLang: (l: Lang) => void;
  onCTA: () => void;
  accent?: string;
};

export default function SolutionHeader({ lang, setLang, onCTA, accent = '#FF0E65' }: Props) {
  const t = useT(lang);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { id: 'product', label: t('Sản phẩm', 'Product') },
    { id: 'features', label: t('Tính năng', 'Features') },
    { id: 'customers', label: t('Khách hàng', 'Customers') },
    { id: 'pricing', label: t('Chi phí', 'Pricing') },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'all 280ms var(--ease-out-expo)',
      }}
    >
      <div
        style={{
          height: 56,
          background: scrolled ? 'rgba(0,38,179,0.92)' : 'var(--5s-blue-700)',
          backdropFilter: scrolled ? 'blur(18px) saturate(1.4)' : 'none',
          display: 'flex',
          alignItems: 'stretch',
          boxShadow: scrolled ? '0 6px 24px rgba(0,0,0,0.18)' : 'none',
        }}
      >
        <a style={{ display: 'flex', alignItems: 'center', padding: '0 22px', cursor: 'pointer' }} href="#top">
          <Image
            src="/solution/logos/5bib-logo-white.png"
            alt="5BIB"
            width={108}
            height={30}
            style={{ height: 30, width: 'auto' }}
            priority
          />
        </a>
        <nav style={{ display: 'flex', flex: 1, justifyContent: 'center' }} className="solution-nav">
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 18px',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.75)',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 12.5,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                transition: 'color 150ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.75)';
              }}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <button
          onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            gap: 6,
          }}
          aria-label="Language toggle"
        >
          <span style={{ opacity: lang === 'vi' ? 1 : 0.5 }}>VI</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ opacity: lang === 'en' ? 1 : 0.5 }}>EN</span>
        </button>
        <button
          onClick={onCTA}
          style={{
            background: accent,
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 11.5,
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            width: 240,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 40,
            paddingRight: 18,
            clipPath: 'polygon(14% 0%, 100% 0%, 100% 100%, 0% 100%)',
            cursor: 'pointer',
            gap: 10,
            border: 'none',
          }}
          className="solution-header-cta"
        >
          {t('Đăng ký BTC', 'Become a partner')}
          <span style={{ marginLeft: 'auto' }}>
            <IArr s={14} />
          </span>
        </button>
      </div>
    </header>
  );
}
