'use client';

import * as React from 'react';
import { Reveal, IArr } from './sol-shared';

type Module = {
  id: '5bib' | '5ticket' | '5pix' | '5sport' | '5tech';
  name: string;
  tagline: string;
  bullets: string[];
  destination: string;
  cta: string;
  external: boolean;
  badge?: string;
  logo: string;
  accent: 'blue' | 'magenta' | 'navy' | 'cyan' | 'green';
};

const MODULES: Module[] = [
  {
    id: '5bib',
    name: '5BIB',
    tagline: 'Nền tảng giải chạy + chip timing + kết quả live',
    bullets: [
      'Bán vé giải chạy + e-waiver + racekit',
      'Chip timing chính xác đến mili-giây',
      'result.5bib.com — bảng xếp hạng & thành tích',
    ],
    destination: 'https://solution.5bib.com',
    cta: 'Tìm hiểu 5BIB',
    external: true,
    logo: '/solution-5solution/logos/5bib-logo.png',
    accent: 'blue',
  },
  {
    id: '5ticket',
    name: '5Ticket',
    tagline: 'Sàn vé concert & sự kiện âm nhạc · 60 giây mua vé',
    bullets: [
      'Phí từ 5.5% (đã gồm phí thẻ)',
      'Quy trình mua vé 60 giây',
      'Coupon · Add-on · B2B portal',
    ],
    destination: '#contact',
    cta: 'Liên hệ',
    external: false,
    logo: '/solution-5solution/logos/5ticket-logo.png',
    accent: 'magenta',
  },
  {
    id: '5pix',
    name: '5Pix',
    tagline: 'AI nhận diện ảnh thi đấu — face + BIB recognition',
    bullets: [
      '98%+ độ chính xác AI face match',
      '< 2h xử lý từ raw → public',
      'Sponsor đo đạc lượt share',
    ],
    destination: '#contact',
    cta: 'Liên hệ',
    external: false,
    logo: '/solution-5solution/logos/5pix-logo.png',
    accent: 'cyan',
  },
  {
    id: '5sport',
    name: '5Sport',
    tagline: 'Cầu lông & Pickleball — sàn vé + cộng đồng',
    bullets: [
      'Sàn vé giải đấu cầu lông/pickleball',
      'Tìm bạn chơi & ghép trận',
      'Hệ thống ranking phong trào',
    ],
    destination: 'https://solution.5sport.vn',
    cta: 'Tìm hiểu 5Sport',
    external: true,
    badge: 'BETA',
    logo: '/solution-5solution/logos/5sport-logo.png',
    accent: 'green',
  },
  {
    id: '5tech',
    name: '5Tech',
    tagline: 'Outsourcing phần mềm thể thao — đội ngũ engineer chuyên ngành',
    bullets: [
      'Custom dev cho BTC quy mô lớn',
      'Tích hợp third-party (timing chip, payment)',
      'Maintenance & SLA support',
    ],
    destination: '#contact',
    cta: 'Liên hệ',
    external: false,
    logo: '/solution-5solution/logos/5tech-logo.png',
    accent: 'navy',
  },
];

const ACCENT_COLOR: Record<Module['accent'], string> = {
  blue: 'var(--sol-blue)',
  magenta: 'var(--sol-magenta)',
  navy: 'var(--sol-navy)',
  cyan: 'var(--sol-cyan)',
  green: 'var(--sol-success)',
};

function fireGtm(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
}

export function SolEcosystem() {
  return (
    <section id="ecosystem" className="sol-section sol-scroll-mt">
      <div className="sol-container">
        <Reveal>
          <div style={{ marginBottom: 48, maxWidth: '52ch' }}>
            <span className="sol-kicker">02 · Hệ sinh thái</span>
            <h2 className="sol-h2" style={{ marginTop: 12, marginBottom: 16 }}>
              Năm sản phẩm chuyên biệt.
              <br />
              <span style={{ color: 'var(--sol-blue)' }}>Một</span> trải nghiệm liền mạch.
            </h2>
            <p className="sol-lead">
              Mỗi module độc lập nhưng kết nối với nhau qua tài khoản, dữ liệu và
              thanh toán — BTC chỉ làm việc với một đầu mối duy nhất.
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(16px, 2vw, 24px)',
          }}
        >
          {MODULES.map((m, idx) => (
            <Reveal key={m.id} delay={idx * 80}>
              <a
                href={m.destination}
                target={m.external ? '_blank' : undefined}
                rel={m.external ? 'noopener noreferrer' : undefined}
                onClick={() =>
                  fireGtm({
                    event: 'module_card_click',
                    module_id: m.id,
                    destination_url: m.destination,
                    is_external: m.external,
                  })
                }
                className="sol-card is-hoverable"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  textDecoration: 'none',
                  color: 'inherit',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: 4,
                    width: '100%',
                    background: ACCENT_COLOR[m.accent],
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 18,
                    marginTop: 4,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.logo}
                    alt={m.name}
                    style={{ height: 36, width: 'auto', objectFit: 'contain' }}
                  />
                  {m.badge ? (
                    <span
                      className="sol-pill sol-pill-magenta"
                      style={{ fontSize: 11, padding: '3px 10px' }}
                    >
                      {m.badge}
                    </span>
                  ) : null}
                </div>

                <h3 className="sol-h3" style={{ marginBottom: 8 }}>
                  {m.name}
                </h3>
                <p
                  className="sol-body"
                  style={{ marginBottom: 18, fontSize: 15, color: 'var(--sol-text-muted)' }}
                >
                  {m.tagline}
                </p>

                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    marginBottom: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {m.bullets.map((b) => (
                    <li
                      key={b}
                      className="sol-check-row"
                      style={{ fontSize: 14, color: 'var(--sol-text)' }}
                    >
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div
                  style={{
                    marginTop: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    color: ACCENT_COLOR[m.accent],
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {m.cta}
                  <IArr />
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
