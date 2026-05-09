'use client';

import * as React from 'react';
import { Magnetic, dl } from './s2-shared';

const NAV = [
  { href: '#features', label: 'Tính năng' },
  { href: '#process', label: 'Quy trình' },
  { href: '#case-study', label: 'Case study' },
  { href: '#pricing', label: 'Báo giá' },
  { href: '#faq', label: 'FAQ' },
];

export function S2Header() {
  const [scrolled, setScrolled] = React.useState(false);
  const progressRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? window.scrollY / max : 0;
      const el = progressRef.current;
      if (el) el.style.transform = `scaleX(${pct})`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="s2-header" data-scrolled={scrolled ? 'true' : 'false'}>
      <div
        className="s2-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <a
          href="#top"
          aria-label="5BIB — về đầu trang"
          data-cursor="hover"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: 'var(--s2-text)',
            fontFamily: 'var(--s2-font-display)',
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: '-0.02em',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/solution/logos/5bib-logo-white.png"
            alt=""
            style={{ height: 28, width: 'auto' }}
          />
          <span>5BIB</span>
        </a>

        <nav
          className="s2-header-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {NAV.map((it) => (
            <a
              key={it.href}
              href={it.href}
              data-cursor="hover"
              onClick={() => dl({ event: 'nav_click', nav_item: it.href.replace('#', ''), nav_text: it.label })}
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                textDecoration: 'none',
                transition: 'color 240ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--s2-text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
            >
              {it.label}
            </a>
          ))}
        </nav>

        <Magnetic strength={0.25}>
          <a
            href="#contact"
            data-cursor="magnetic"
            className="s2-btn s2-btn-primary"
            style={{ padding: '12px 22px', fontSize: 13 }}
            onClick={() => dl({ event: 'header_cta_click', cta_text: 'Đặt lịch demo' })}
          >
            Đặt lịch demo →
          </a>
        </Magnetic>
      </div>

      <div ref={progressRef} className="s2-header-progress" />
    </header>
  );
}
