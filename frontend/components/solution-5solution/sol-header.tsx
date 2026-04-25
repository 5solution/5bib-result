'use client';

import * as React from 'react';
import { SolWordmark } from './sol-shared';

const NAV_ITEMS = [
  { href: '#ecosystem', label: 'Hệ sinh thái' },
  { href: '#why', label: 'Vì sao chọn' },
  { href: '#partners', label: 'Đối tác' },
  { href: '#contact', label: 'Liên hệ' },
];

export function SolHeader() {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sol-header" data-scrolled={scrolled ? 'true' : 'false'}>
      <div
        className="sol-container"
        style={{
          paddingTop: 14,
          paddingBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <a
          href="#top"
          aria-label="5Solution — về đầu trang"
          style={{ display: 'inline-flex', textDecoration: 'none' }}
        >
          <SolWordmark size={22} invert={!scrolled} />
        </a>

        <nav
          className="sol-header-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {NAV_ITEMS.map((it) => (
            <a
              key={it.href}
              href={it.href}
              style={{
                color: scrolled ? 'var(--sol-text)' : 'rgba(255,255,255,0.88)',
                textDecoration: 'none',
                transition: 'color 200ms',
              }}
            >
              {it.label}
            </a>
          ))}
        </nav>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <a
            href="#contact"
            className={`sol-btn ${scrolled ? 'sol-btn-primary' : 'sol-btn-on-dark'}`}
            style={{ padding: '10px 18px', fontSize: 13 }}
          >
            Liên hệ tư vấn →
          </a>
        </div>
      </div>
    </header>
  );
}
