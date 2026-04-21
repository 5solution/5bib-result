'use client';

import * as React from 'react';
import { Lang, useT, Pill, CountUpStat } from './s5-shared';

export function S5Hero({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const heroRef = React.useRef<HTMLElement>(null);
  const [cursor, setCursor] = React.useState<{ x: number; y: number; on: boolean }>({ x: 50, y: 50, on: false });

  // Parallax on scroll (subtle)
  const [scroll, setScroll] = React.useState(0);
  React.useEffect(() => {
    const onScroll = () => setScroll(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCursor({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      on: true,
    });
  };
  const onLeave = () => setCursor((c) => ({ ...c, on: false }));

  const parallax = Math.min(scroll * 0.25, 120);
  const heroOpacity = Math.max(1 - scroll / 600, 0);

  return (
    <section
      ref={heroRef}
      id="top"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        position: 'relative',
        minHeight: 'min(880px, 100vh)',
        display: 'flex',
        alignItems: 'center',
        paddingTop: 140,
        paddingBottom: 80,
        overflow: 'hidden',
        color: '#fff',
      }}
    >
      {/* Base gradient background */}
      <div className="s5-hero-bg" style={{ transform: `translateY(${parallax * 0.4}px)` }} />

      {/* Floating orbs — large blurred color blobs */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-8%',
          right: '-6%',
          width: 540,
          height: 540,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,255,0,0.38), transparent 65%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
        className="s5-orb"
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-12%',
          left: '-8%',
          width: 620,
          height: 620,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,0,255,0.55), transparent 60%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          animationDelay: '-5s',
        }}
        className="s5-orb"
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '38%',
          left: '52%',
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,14,101,0.32), transparent 65%)',
          filter: 'blur(38px)',
          pointerEvents: 'none',
          animationDelay: '-9s',
        }}
        className="s5-orb"
      />

      {/* Cursor-tracking spotlight */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(600px circle at ${cursor.x}% ${cursor.y}%, rgba(200,255,0,0.12), transparent 50%)`,
          opacity: cursor.on ? 1 : 0,
          transition: 'opacity 320ms var(--ease-out-expo)',
        }}
      />

      {/* Grid overlay */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at center, #000 45%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, #000 45%, transparent 85%)',
          pointerEvents: 'none',
        }}
      />

      {/* Floating particles */}
      {[
        { l: '12%', t: '22%', s: 6, d: 0 },
        { l: '82%', t: '18%', s: 4, d: 1 },
        { l: '78%', t: '72%', s: 8, d: 2 },
        { l: '18%', t: '68%', s: 5, d: 3 },
        { l: '50%', t: '86%', s: 7, d: 4 },
      ].map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="s5-float"
          style={{
            position: 'absolute',
            left: p.l,
            top: p.t,
            width: p.s,
            height: p.s,
            borderRadius: '50%',
            background: i % 2 === 0 ? 'var(--s5-lime)' : '#fff',
            boxShadow: i % 2 === 0 ? '0 0 14px rgba(200,255,0,0.9)' : '0 0 10px rgba(255,255,255,0.8)',
            opacity: 0.6,
            animationDelay: `${p.d * 1.2}s`,
            pointerEvents: 'none',
          }}
        />
      ))}

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1240,
          margin: '0 auto',
          padding: '0 24px',
          width: '100%',
          opacity: heroOpacity,
          transition: 'opacity 200ms linear',
        }}
      >
        <div style={{ maxWidth: 980, textAlign: 'center', margin: '0 auto' }}>
          <div
            className="s5-hero-word"
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 30,
              animationDelay: '60ms',
            }}
          >
            <Pill bg="rgba(200,255,0,0.12)" color="var(--s5-lime)" border="1px solid rgba(200,255,0,0.35)">
              🇻🇳 {t('Made in Vietnam', 'Made in Vietnam')}
            </Pill>
            <Pill bg="rgba(255,255,255,0.08)" color="#fff" border="1px solid rgba(255,255,255,0.22)">
              {t('Badminton · Pickleball', 'Badminton · Pickleball')}
            </Pill>
          </div>

          <h1 className="type-hero" style={{ marginBottom: 28 }}>
            <span className="s5-hero-word" style={{ display: 'inline-block', animationDelay: '180ms' }}>
              {t('Level Up', 'Level Up')}
            </span>
            <br />
            <span
              className="s5-hero-word"
              style={{
                display: 'inline-block',
                animationDelay: '380ms',
                background: 'linear-gradient(135deg, var(--s5-lime) 0%, #8AE000 55%, var(--s5-lime) 100%)',
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: 's5-hero-in 900ms var(--ease-out-expo) 380ms both, s5-gradient-shift 6s ease-in-out infinite',
                textShadow: '0 0 60px rgba(200,255,0,0.35)',
              }}
            >
              {t('Your Game.', 'Your Game.')}
            </span>
          </h1>

          <p
            className="type-lead s5-hero-word"
            style={{
              color: 'rgba(255,255,255,0.82)',
              margin: '0 auto 44px',
              maxWidth: 780,
              animationDelay: '560ms',
            }}
          >
            {t(
              '5Sport là nền tảng thể thao đầu tiên tại Việt Nam kết hợp sàn vé thi đấu, cộng đồng tìm người chơi và công cụ vận hành giải đấu — cho cả cầu lông lẫn pickleball.',
              '5Sport is Vietnam\u2019s first platform combining a tournament marketplace, a player community, and pro-grade operations software — for badminton and pickleball.',
            )}
          </p>

          <div
            className="s5-hero-word"
            style={{
              display: 'flex',
              gap: 14,
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: 40,
              animationDelay: '720ms',
            }}
          >
            <a href="#lead-form-btc" className="s5-btn s5-btn-lime s5-pulse-ring">
              🏆 {t('Tôi là Ban Tổ Chức', 'I\u2019m an organizer')} →
            </a>
            <a href="#lead-form-vdv" className="s5-btn s5-btn-ghost-white">
              🏸 {t('Tôi là Người Chơi', 'I\u2019m a player')} →
            </a>
          </div>

          <div
            className="s5-hero-word"
            style={{
              display: 'flex',
              gap: 40,
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: 60,
              paddingTop: 36,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              animationDelay: '880ms',
            }}
          >
            {[
              { n: '195+', l: t('giải đấu', 'tournaments') },
              { n: '94K+', l: t('VĐV', 'athletes') },
              { n: '42K+', l: t('đơn hàng vé', 'ticket orders') },
              { n: '6', l: t('năm kinh nghiệm', 'years') },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div
                  className="type-data"
                  style={{
                    fontSize: 34,
                    color: 'var(--s5-lime)',
                    lineHeight: 1,
                    textShadow: '0 0 24px rgba(200,255,0,0.45)',
                  }}
                >
                  <CountUpStat value={s.n} duration={1600} />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.6)',
                    marginTop: 6,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          color: 'rgba(255,255,255,0.4)',
          fontSize: 10,
          letterSpacing: '.2em',
          textTransform: 'uppercase',
          fontWeight: 700,
          opacity: heroOpacity,
        }}
      >
        <span>Scroll</span>
        <span
          style={{
            width: 1,
            height: 36,
            background: 'linear-gradient(to bottom, transparent, var(--s5-lime), transparent)',
            backgroundSize: '100% 200%',
            animation: 's5-gradient-shift 2s ease-in-out infinite',
          }}
        />
      </div>
    </section>
  );
}
