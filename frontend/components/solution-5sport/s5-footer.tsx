'use client';

import * as React from 'react';
import { Lang, useT, S5Logo } from './s5-shared';

export function S5Footer({ lang }: { lang: Lang }) {
  const t = useT(lang);

  const cols = [
    {
      title: t('Sản phẩm', 'Product'),
      items: [
        [t('Sàn vé & Đăng ký', 'Ticketing & Registration'), '#marketplace'],
        [t('Cộng đồng & Matching', 'Community & matching'), '#community'],
        ['Tournament Pro', '#tournament'],
        ['5Sport Rating', '#rating'],
        ['Media Package', '#media'],
      ],
    },
    {
      title: t('Hệ sinh thái', 'Ecosystem'),
      items: [
        ['5BIB · ' + t('chạy bộ', 'running'), 'https://5bib.com'],
        ['5Ticket · ' + t('vé sự kiện', 'tickets'), 'https://5ticket.vn'],
        ['5Pix · ' + t('ảnh giải', 'photos'), 'https://5pix.vn'],
        ['5Tech', 'https://5solution.vn'],
      ],
    },
    {
      title: t('Liên hệ', 'Contact'),
      items: [
        ['hello@5sport.vn', 'mailto:hello@5sport.vn'],
        ['Facebook', 'https://facebook.com/5sport.vn'],
        ['Zalo', '#'],
        [t('Chính sách bảo mật', 'Privacy policy'), '#'],
        [t('Điều khoản', 'Terms'), '#'],
      ],
    },
  ];

  return (
    <footer
      style={{
        background: '#06082A',
        color: 'rgba(255,255,255,0.72)',
        padding: '72px 24px 40px',
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
          gap: 36,
        }}
        className="s5-4col"
      >
        <div>
          <div style={{ marginBottom: 16 }}>
            <S5Logo size={34} invert />
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
            {t(
              'Sản phẩm của 5Solution — Sport-Tech ecosystem. Level Up Your Game.',
              'A 5Solution product — Sport-Tech ecosystem. Level Up Your Game.',
            )}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            © {new Date().getFullYear()} 5Solution JSC. All rights reserved.
          </p>
        </div>

        {cols.map((c) => (
          <div key={c.title}>
            <h4
              style={{
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              {c.title}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {c.items.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    style={{
                      color: 'rgba(255,255,255,0.72)',
                      fontSize: 13,
                      transition: 'color 160ms',
                    }}
                    onMouseOver={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--s5-lime)')}
                    onMouseOut={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.72)')}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
