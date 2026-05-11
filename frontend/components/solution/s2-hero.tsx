'use client';

import * as React from 'react';
import { S2HeroCanvas } from './s2-hero-canvas';
import { Counter, Magnetic, dl } from './s2-shared';
import { GooeyText } from '@/components/ui/gooey-text-morphing';

/**
 * Hero — 2-column grid (text left, 5BIB brand mark right) over WebGL canvas
 * backdrop. Brand mark uses pure CSS keyframe (float + glow pulse) — no rAF.
 * Headline has a subtle scroll-driven translate for depth. Stats row sits
 * below grid.
 */
export function S2Hero() {
  const headlineRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onScroll = () => {
      const y = window.scrollY;
      const h = headlineRef.current;
      if (h) h.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <section id="top" className="s2-hero">
      <S2HeroCanvas />
      <div className="s2-hero-glow blue" />
      <div className="s2-hero-glow magenta" />

      <div className="s2-container s2-hero-content">
        <div className="s2-hero-grid">
          <div className="s2-hero-text-cell">
            <div className="s2-eyebrow" style={{ marginBottom: 24 }}>
              <span className="dot" />
              Q1·2026 · Slot onboarding đang mở
            </div>

            <h1 ref={headlineRef} className="s2-h1 s2-h1-gooey-wrap" style={{ marginBottom: 32 }}>
              <GooeyText
                texts={[
                  'cổng đăng ký',
                  'quản lý vđv',
                  'thanh toán bib',
                  'check-in onsite',
                  'email blast',
                ]}
                morphTime={1.1}
                cooldownTime={1.4}
                className="s2-h1-gooey"
                textClassName="s2-h1-gooey-text"
              />
              <span className="s2-line-mask"><span className="s2-text-magenta">#1 việt nam.</span></span>
            </h1>

            <p className="s2-lead" style={{ maxWidth: '46ch', marginBottom: 36 }}>
              Form đăng ký · thanh toán · BIB · wave · check-in · email blast · dashboard
              — tất cả trong một nền tảng.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 32 }}>
              <Magnetic strength={0.3}>
                <a
                  href="#contact"
                  data-cursor="magnetic"
                  className="s2-btn s2-btn-magenta"
                  onClick={() => dl({ event: 'hero_cta_click', cta_text: 'Đặt lịch demo 15 phút', cta_location: 'hero' })}
                >
                  Đặt lịch demo 15 phút →
                </a>
              </Magnetic>
              <Magnetic strength={0.2}>
                <a
                  href="#pricing"
                  data-cursor="hover"
                  className="s2-btn s2-btn-ghost"
                  onClick={() => dl({ event: 'hero_cta_click', cta_text: 'Liên hệ báo giá', cta_location: 'hero' })}
                >
                  Liên hệ báo giá
                </a>
              </Magnetic>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 20,
                fontSize: 13,
                color: 'var(--s2-text-muted)',
              }}
            >
              <span>✓ Tiếp cận 120k runner</span>
              <span>✓ Mở bán trong 72h</span>
              <span>✓ Tiếng Việt native</span>
            </div>
          </div>

          <div className="s2-hero-mascot-cell">
            <div className="s2-hero-logo-aura" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/solution/logos/5bib-logo.png"
              alt="5BIB"
              className="s2-hero-mascot-img s2-hero-logo"
            />
          </div>
        </div>

        <div className="s2-hero-stats">
          {[
            { num: 120, suffix: 'K+', label: 'vận động viên' },
            { num: 195, suffix: '+', label: 'giải đã bán vé' },
            { num: 48, suffix: 'M+', label: 'doanh thu vé / năm (₫)' },
            { num: 72, suffix: 'h', label: 'setup → bán vé' },
          ].map((s) => (
            <div key={s.label}>
              <div className="s2-stat" style={{ color: 'var(--s2-text)' }}>
                <Counter to={s.num} suffix={s.suffix} />
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--s2-text-subtle)',
                  fontWeight: 600,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
