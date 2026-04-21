'use client';

import * as React from 'react';
import { Lang, useT, Pill } from './s5-shared';

export function S5Hero({ lang }: { lang: Lang }) {
  const t = useT(lang);

  return (
    <section
      id="top"
      style={{
        position: 'relative',
        minHeight: 'min(820px, 100vh)',
        display: 'flex',
        alignItems: 'center',
        paddingTop: 120,
        paddingBottom: 72,
        overflow: 'hidden',
        color: '#fff',
      }}
    >
      <div className="s5-hero-bg" />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1240,
          margin: '0 auto',
          padding: '0 24px',
          width: '100%',
        }}
      >
        <div className="s5-fade-up" style={{ maxWidth: 960, textAlign: 'center', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 28 }} className="s5-hero-badges">
            <Pill bg="rgba(200,255,0,0.12)" color="var(--s5-lime)" border="1px solid rgba(200,255,0,0.3)">
              🇻🇳 {t('Made in Vietnam', 'Made in Vietnam')}
            </Pill>
            <Pill bg="rgba(255,255,255,0.08)" color="#fff" border="1px solid rgba(255,255,255,0.22)">
              {t('Badminton · Pickleball', 'Badminton · Pickleball')}
            </Pill>
          </div>

          <h1 className="type-hero" style={{ marginBottom: 24 }}>
            {t('Level Up', 'Level Up')}
            <br />
            <span style={{ color: 'var(--s5-lime)' }}>{t('Your Game.', 'Your Game.')}</span>
          </h1>

          <p
            className="type-lead"
            style={{
              color: 'rgba(255,255,255,0.78)',
              margin: '0 auto 40px',
              maxWidth: 760,
            }}
          >
            {t(
              '5Sport là nền tảng thể thao đầu tiên tại Việt Nam kết hợp sàn vé thi đấu, cộng đồng tìm người chơi và công cụ vận hành giải đấu — cho cả cầu lông lẫn pickleball.',
              '5Sport is Vietnam\u2019s first platform combining a tournament ticket marketplace, a player community, and pro-grade tournament operations software — for badminton and pickleball.',
            )}
          </p>

          <div
            style={{
              display: 'flex',
              gap: 14,
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: 36,
            }}
          >
            <a href="#lead-form-btc" className="s5-btn s5-btn-lime">
              🏆 {t('Tôi là Ban Tổ Chức', 'I\u2019m an organizer')} →
            </a>
            <a href="#lead-form-vdv" className="s5-btn s5-btn-ghost-white">
              🏸 {t('Tôi là Người Chơi', 'I\u2019m a player')} →
            </a>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 36,
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: 56,
              paddingTop: 32,
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {[
              { n: '195+', l: t('giải đấu', 'tournaments') },
              { n: '94K+', l: t('VĐV', 'athletes') },
              { n: '42K+', l: t('đơn hàng vé', 'ticket orders') },
              { n: '6', l: t('năm kinh nghiệm', 'years') },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div className="type-data" style={{ fontSize: 32, color: 'var(--s5-lime)', lineHeight: 1 }}>
                  {s.n}
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
    </section>
  );
}
