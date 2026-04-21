'use client';

import * as React from 'react';
import { IArr, ICheck, LiveDot, useT, type Lang } from './solution-icons';

type Props = {
  lang: Lang;
  style: 'blue' | 'photo';
  onCTA: () => void;
  accent?: string;
};

export default function SolutionHero({ lang, style, onCTA, accent = '#FF0E65' }: Props) {
  const t = useT(lang);

  const stats = [
    { n: '120K+', l: t('vận động viên', 'runners'), sub: t('trên network 5BIB', 'on the 5BIB network') },
    { n: '195+', l: t('giải đã bán vé', 'races ticketed'), sub: t('qua cổng 5BIB', 'via the 5BIB portal') },
    { n: '48M+', l: t('doanh thu vé', 'ticket revenue (₫)'), sub: t('GMV xử lý / năm', 'GMV processed / yr') },
    { n: '72h', l: t('từ setup → bán vé', 'setup → live sales'), sub: t('trung bình mỗi BTC', 'avg per organizer') },
  ];

  const bg: React.CSSProperties =
    style === 'photo'
      ? {
          backgroundImage:
            'linear-gradient(rgba(0,20,90,0.72), rgba(0,20,90,0.78)), url(/solution/brand/5bib-hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : { background: 'var(--5s-blue)' };

  return (
    <section
      id="top"
      style={{
        position: 'relative',
        overflow: 'hidden',
        color: '#fff',
        ...bg,
        paddingTop: 56,
      }}
    >
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: style === 'blue' ? 1 : 0 }}
      >
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -80,
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            left: -140,
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(136,162,255,0.18) 0%, transparent 70%)',
          }}
        />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }}>
          <defs>
            <pattern id="solution-hero-grid" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M56 0H0V56" stroke="white" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#solution-hero-grid)" />
        </svg>
      </div>

      <div
        className="solution-hero-grid"
        style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', padding: '56px 32px 0' }}
      >
        <div className="solution-hero-inner-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 56, alignItems: 'center' }}>
          <div className="solution-hero-left">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 14px 6px 10px',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: 9999,
                marginBottom: 26,
              }}
            >
              <span
                style={{
                  background: accent,
                  color: '#fff',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 900,
                  fontSize: 10,
                  letterSpacing: '.18em',
                }}
              >
                Q1·2026
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 12.5,
                  letterSpacing: '.02em',
                }}
              >
                {t('Slot onboarding mùa giải Q1/2026 đang mở', 'Q1/2026 onboarding slots now open')}
              </span>
            </div>
            <h1
              className="type-campaign solution-hero-h1"
              style={{
                fontSize: 'clamp(52px, 7.2vw, 100px)',
                color: '#fff',
                margin: 0,
                position: 'relative',
                lineHeight: 0.95,
              }}
            >
              {t('cổng đăng ký & quản lý VĐV', 'the registration & athlete-management')}
              <br />
              <span style={{ color: accent }}>{t('#1 Việt Nam.', 'platform #1 in Vietnam.')}</span>
            </h1>
            <p
              className="solution-hero-desc"
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 18.5,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.85)',
                maxWidth: 560,
                margin: '28px 0 36px',
              }}
            >
              {t(
                'Form đăng ký · thanh toán · quản lý BIB · wave · check-in · email blast · dashboard — tất cả trong một nền tảng. Thay thế Google Form, các platform đăng ký đóng, và 6 tháng dev tự build.',
                'Registration form · payments · BIB & wave management · check-in · email blast · dashboard — all in one platform. Replaces Google Form, closed registration platforms, and 6 months of in-house dev.',
              )}
            </p>
            <div className="solution-hero-cta-row" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button
                onClick={onCTA}
                style={{
                  background: '#fff',
                  color: 'var(--5s-blue-700)',
                  border: 'none',
                  padding: '16px 26px',
                  borderRadius: 12,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 14px 40px rgba(0,0,0,0.25)',
                }}
              >
                {t('Đặt lịch demo 15 phút', 'Book a 15-min demo')} <IArr s={16} />
              </button>
              <button
                onClick={onCTA}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1.5px solid rgba(255,255,255,0.32)',
                  padding: '16px 22px',
                  borderRadius: 12,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  backdropFilter: 'blur(8px)',
                }}
              >
                {t('Liên hệ báo giá', 'Get a quote')}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 22, marginTop: 28, alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                t('Tiếp cận 120k runner sẵn có', 'Reach 120k existing runners'),
                t('Mở bán trong 72h', 'Live in 72h'),
                t('Tiếng Việt native', 'Vietnamese-first'),
              ].map((label, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  <ICheck s={14} /> {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: stats board */}
          <div className="solution-hero-right" style={{ position: 'relative' }}>
            <div className="solution-hero-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {stats.map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: i === 0 ? accent : 'rgba(255,255,255,0.07)',
                    border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 16,
                    padding: '26px 22px',
                    backdropFilter: 'blur(8px)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {i === 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 14,
                        right: 14,
                        fontFamily: 'var(--font-body)',
                        fontWeight: 900,
                        fontSize: 10,
                        letterSpacing: '.18em',
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      NETWORK
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: 52,
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                      color: '#fff',
                    }}
                  >
                    {s.n}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 800,
                      fontSize: 12,
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: i === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.88)',
                      marginTop: 10,
                    }}
                  >
                    {s.l}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      color: i === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.55)',
                      marginTop: 3,
                    }}
                  >
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>
            {/* Registration form chip */}
            <div
              style={{
                marginTop: 16,
                background: '#fff',
                borderRadius: 16,
                padding: 14,
                boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
                color: 'var(--5s-text)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <LiveDot color="#16a34a" />
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 800,
                    fontSize: 10.5,
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                    color: '#16a34a',
                  }}
                >
                  {t('Đang bán vé', 'Selling now')}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--5s-text-subtle)' }}>
                  VTV–LPBank · 42K
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em' }}>
                    4,812{' '}
                    <span style={{ color: 'var(--5s-text-subtle)', fontSize: 13, fontWeight: 700 }}>/ 5,000</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--5s-text-muted)', fontWeight: 600 }}>
                    {t('vé đã bán trong 2h', 'tickets sold in 2h')}
                  </div>
                </div>
                <div
                  style={{
                    background: 'var(--5s-blue)',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: 9999,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 11,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  96%
                </div>
              </div>
              <div style={{ marginTop: 10, height: 6, background: 'var(--5s-border)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ width: '96%', height: '100%', background: `linear-gradient(90deg, var(--5s-blue), ${accent})` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* scrolling marquee */}
      <div className="solution-hero-marquee-wrap" style={{ position: 'relative', marginTop: 80 }}>
        <div
          style={{
            padding: '14px 0',
            borderTop: '1px solid rgba(255,255,255,0.14)',
            borderBottom: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', gap: 64, animation: 'solution-marquee 32s linear infinite', whiteSpace: 'nowrap' }}>
            {[...Array(2)].flatMap((_, i) =>
              [
                'VnExpress Marathon',
                'VTV–LPBank Marathon',
                'Racejungle',
                '5Sport',
                'Dalat Ultra Trail',
                'Tay Ho Half Marathon',
                'Trang An Marathon',
                'Mucangchai Ultra Trail',
                'Tiền Phong Marathon',
                'Ecopark Marathon',
              ].map((n, j) => (
                <span
                  key={`${i}-${j}`}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 15,
                    letterSpacing: '-0.01em',
                    color: 'rgba(255,255,255,0.72)',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 18,
                  }}
                >
                  {n}
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 9999, background: accent }} />
                </span>
              )),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
