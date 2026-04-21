'use client';

import * as React from 'react';
import { Lang, useT, S5Logo } from './s5-shared';

export function S5Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = useT(lang);
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'background 200ms, border-color 200ms, backdrop-filter 200ms',
        background: scrolled ? 'rgba(255,255,255,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--s5-border)' : '1px solid transparent',
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <a href="#top" style={{ display: 'inline-flex' }}>
          <S5Logo size={36} invert={!scrolled} />
        </a>

        <nav
          className="s5-header-nav"
          style={{ display: 'flex', alignItems: 'center', gap: 28, fontWeight: 700, fontSize: 14 }}
        >
          {[
            { h: '#features', vi: 'Tính năng', en: 'Features' },
            { h: '#tournament', vi: 'Vận hành Giải', en: 'Tournaments' },
            { h: '#btc', vi: 'Cho BTC', en: 'For Organizers' },
            { h: '#pricing', vi: 'Pricing', en: 'Pricing' },
          ].map((it) => (
            <a
              key={it.h}
              href={it.h}
              style={{
                color: scrolled ? 'var(--s5-text)' : 'rgba(255,255,255,0.88)',
                transition: 'color 200ms, opacity 200ms',
              }}
            >
              {t(it.vi, it.en)}
            </a>
          ))}
        </nav>

        <div className="s5-header-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            aria-label="Toggle language"
            style={{
              border: scrolled ? '1px solid var(--s5-border-strong)' : '1px solid rgba(255,255,255,0.32)',
              background: 'transparent',
              color: scrolled ? 'var(--s5-text)' : '#fff',
              padding: '6px 12px',
              borderRadius: 9999,
              fontFamily: 'var(--font-body-5s)',
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {lang === 'vi' ? 'EN' : 'VI'}
          </button>
          <a
            href="#lead-form"
            className="s5-btn s5-btn-lime"
            style={{ padding: '10px 18px', fontSize: 13 }}
          >
            {t('Đăng ký dùng thử', 'Try for free')} →
          </a>
        </div>
      </div>
    </header>
  );
}
