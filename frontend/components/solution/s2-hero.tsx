'use client';

import * as React from 'react';
import { S2HeroCanvas } from './s2-hero-canvas';
import { Counter, Magnetic, dl, useMascotFrame, mascotSrc } from './s2-shared';

/**
 * Hero with WebGL canvas background + parallax mascot + scroll-driven
 * floating chips + animated counter stats.
 */
export function S2Hero() {
  const mascotRef = React.useRef<HTMLImageElement>(null);
  const headlineRef = React.useRef<HTMLHeadingElement>(null);
  const chip1Ref = React.useRef<HTMLDivElement>(null);
  const chip2Ref = React.useRef<HTMLDivElement>(null);
  const chip3Ref = React.useRef<HTMLDivElement>(null);
  const frame = useMascotFrame(160);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let bobT = 0;
    let lastNow = performance.now();
    const animate = (now: number) => {
      const dt = now - lastNow;
      lastNow = now;
      bobT += dt * 0.004;
      const m = mascotRef.current;
      if (m) {
        // Mascot bouncing animation independent of scroll — running stride
        const bob = Math.abs(Math.sin(bobT)) * 18; // pronounced vertical bob
        const tilt = Math.sin(bobT) * 5;
        const y = window.scrollY;
        m.style.transform = `translate3d(${Math.sin(y * 0.004) * 24}px, ${y * 0.12 - bob}px, 0) rotate(${tilt}deg)`;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const onScroll = () => {
      const y = window.scrollY;
      const h = headlineRef.current;
      if (h) h.style.transform = `translate3d(0, ${y * 0.32}px, 0)`;
      if (chip1Ref.current) chip1Ref.current.style.transform = `translate3d(${Math.sin(y * 0.005) * 14}px, ${y * 0.4}px, 0)`;
      if (chip2Ref.current) chip2Ref.current.style.transform = `translate3d(${Math.cos(y * 0.005) * 14}px, ${y * 0.55}px, 0)`;
      if (chip3Ref.current) chip3Ref.current.style.transform = `translate3d(${Math.sin(y * 0.006 + 1) * 14}px, ${y * 0.45}px, 0)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Headline reveal handled by pure CSS keyframe animation in solution.css
    // (s2-line-reveal). React re-renders won't conflict because no inline
    // styles are set.

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="top" className="s2-hero">
      <S2HeroCanvas />
      <div className="s2-hero-glow blue" />
      <div className="s2-hero-glow magenta" />

      {/* Floating chips */}
      <div ref={chip1Ref} className="s2-hero-chip" style={{ top: '22%', left: '6%' }}>
        <span className="s2-chip s2-chip-blue">120K runners</span>
      </div>
      <div ref={chip2Ref} className="s2-hero-chip" style={{ top: '32%', right: '8%' }}>
        <span className="s2-chip s2-chip-magenta">72h setup</span>
      </div>
      <div ref={chip3Ref} className="s2-hero-chip" style={{ bottom: '28%', left: '10%' }}>
        <span className="s2-chip s2-chip-lime">99.8% uptime</span>
      </div>

      {/* Mascot — frame-cycled running, parallax + bounce */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={mascotRef}
        src={mascotSrc(frame)}
        alt=""
        className="s2-hero-mascot"
        style={{
          width: 'min(56vw, 680px)',
          right: '-4%',
          bottom: '0%',
          opacity: 1,
        }}
      />

      <div className="s2-container s2-hero-content">
        <div className="s2-eyebrow" style={{ marginBottom: 24 }}>
          <span className="dot" />
          Q1·2026 · Slot onboarding đang mở
        </div>

        <h1 ref={headlineRef} className="s2-h1" style={{ marginBottom: 32, maxWidth: '14ch' }}>
          <span className="s2-line-mask"><span>cổng đăng ký</span></span>
          <span className="s2-line-mask"><span>&amp; quản lý vđv</span></span>
          <span className="s2-line-mask"><span className="s2-text-magenta">#1 việt nam.</span></span>
        </h1>

        <p
          className="s2-lead"
          style={{
            maxWidth: '52ch',
            marginBottom: 36,
          }}
        >
          Form đăng ký · thanh toán · BIB · wave · check-in · email blast · dashboard
          — tất cả trong một nền tảng.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 56 }}>
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

        {/* Trust line */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            fontSize: 13,
            color: 'var(--s2-text-muted)',
            marginBottom: 64,
          }}
        >
          <span>✓ Tiếp cận 120k runner</span>
          <span>✓ Mở bán trong 72h</span>
          <span>✓ Tiếng Việt native</span>
        </div>

        {/* Counter stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 'clamp(20px, 3vw, 40px)',
            maxWidth: 920,
          }}
        >
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
