'use client';

import * as React from 'react';
import { Reveal, Counter, Magnetic, dl, useMascotFrame, mascotSrc } from './s2-shared';
import { S2MascotInline, S2MascotSection } from './s2-mascot-runner';
import { MagneticText } from '@/components/ui/morphing-cursor';

/* ────────────────────────────────────────────────────────────────────────── */
/*  PAIN — 3 cards "3 cách BTC đang làm. Cả 3 đều đau."                       */
/* ────────────────────────────────────────────────────────────────────────── */

export function S2Pain() {
  const PAINS = [
    {
      tag: 'Google Form',
      title: 'Thay Google Form',
      pain: 'BTC ngồi gõ Excel, tính phí thẻ thủ công, mỗi VĐV gửi mail xác nhận đêm khuya.',
      fix: 'Form sự kiện riêng + payment tự động + email blast Zalo OA — không động tay.',
    },
    {
      tag: 'Platform đóng',
      title: 'Thay platform đóng',
      pain: 'Cướp data khách hàng, không xuất CSV, không API, không owned domain.',
      fix: 'Custom domain, white-label, API kết quả, dữ liệu BTC 100% owned.',
    },
    {
      tag: 'Tự build',
      title: 'Thay tự build',
      pain: '6 tháng dev, lỗi peak time crash, không có timing, không có app, không có Zalo OA.',
      fix: '72 giờ go-live. Đã chạy 195 giải. Không phải reinvent the wheel.',
    },
  ];
  return (
    <section className="s2-section">
      <div className="s2-container">
        <Reveal>
          <div style={{ marginBottom: 64, maxWidth: '54ch' }}>
            <div className="s2-eyebrow" style={{ marginBottom: 16 }}>
              <span className="dot" /> 02 · vấn đề
            </div>
            <h2 className="s2-h2" style={{ marginBottom: 16 }}>
              3 cách BTC đang làm hiện tại.
              <br />
              <MagneticText
                text="cả 3 đều đau."
                hoverText="5BIB fix luôn."
                textClassName="s2-h2-magnetic"
                hoverTextClassName="s2-h2-magnetic s2-h2-magnetic-reveal"
                circleClassName="s2-h2-magnetic-circle"
                circleSize={200}
              />
            </h2>
            <p className="s2-lead">
              Mỗi mùa giải lại lặp lại cùng một câu chuyện. 5BIB sinh ra để cắt
              vòng lặp đó.
            </p>
          </div>
        </Reveal>

        <div className="s2-pain-grid">
          {PAINS.map((p, i) => (
            <Reveal key={p.tag} delay={i * 80}>
              <article className="s2-pain-card" data-cursor="hover">
                <span className="s2-chip s2-chip-magenta" style={{ marginBottom: 18 }}>
                  {p.tag}
                </span>
                <h3 className="s2-h3" style={{ marginBottom: 14 }}>
                  {p.title}
                </h3>
                <p style={{ color: 'var(--s2-text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>
                  {p.pain}
                </p>
                <div
                  style={{
                    paddingTop: 16,
                    borderTop: '1px solid var(--s2-border)',
                    color: 'var(--s2-lime)',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  → {p.fix}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FEATURES — 6 tab feature explainer                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    id: 'form',
    label: 'Form đăng ký',
    title: 'Form đăng ký + thanh toán đa kênh',
    desc: 'Form custom theo cự ly · thanh toán Visa, ATM, QR, Zalo Pay, MoMo · auto e-receipt · auto e-waiver.',
    bullets: ['Form không giới hạn field', 'Coupon engine', 'Add-on (áo, vé xe, bảo hiểm)', 'Bán vé doanh nghiệp B2B'],
  },
  {
    id: 'bib',
    label: 'BIB & Wave',
    title: 'Auto-assign BIB & wave',
    desc: 'Generate BIB theo cự ly, wave theo pace tự khai báo, hoặc đổi BIB lottery hồi hộp pre-race.',
    bullets: ['BIB number rule custom', 'Wave by pace tự động', 'BIB Lottery — quay số live', 'In-app BIB QR cho VĐV'],
  },
  {
    id: 'checkin',
    label: 'Check-in QR',
    title: 'Check-in QR offline-first',
    desc: 'App scan QR code 1 chạm. Không cần wifi. Real-time sync khi có mạng. Báo cáo nhận racekit live.',
    bullets: ['Offline mode', 'Multi-device sync', 'Bib pickup tracking', 'Confirmation pháp lý e-waiver'],
  },
  {
    id: 'comms',
    label: 'Email · SMS · Zalo',
    title: 'Email blast + Zalo OA + SMS',
    desc: 'Template Vietnamese ready · phân khúc theo cự ly/wave · trigger automation · Zalo OA 82% open rate.',
    bullets: ['Email template VN', 'Zalo OA tích hợp', 'SMS broadcast', 'Automation trigger D-7, D-1, D-0'],
  },
  {
    id: 'athlete',
    label: 'Athlete app',
    title: 'App vận động viên',
    desc: 'VĐV có app riêng: BIB QR, certificate, kết quả live, ảnh AI 5Pix. Tăng retention 3x.',
    bullets: ['Mobile app iOS + Android', 'Live result tracking', 'Certificate auto-gen', 'Photo gallery 5Pix AI'],
  },
  {
    id: 'btc',
    label: 'BTC dashboard',
    title: 'Dashboard BTC real-time',
    desc: 'Doanh thu theo giờ, segment theo cự ly, funnel conversion, refund tracking — mọi thứ 1 màn hình.',
    bullets: ['Revenue real-time', 'Funnel analytics', 'Export CSV bất kỳ', 'Multi-user team access'],
  },
];

export function S2Features() {
  const [active, setActive] = React.useState(FEATURES[0].id);
  const cur = FEATURES.find((f) => f.id === active) ?? FEATURES[0];

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Auto-cycle every 5s if user idle
    const id = setInterval(() => {
      setActive((cur) => {
        const i = FEATURES.findIndex((f) => f.id === cur);
        return FEATURES[(i + 1) % FEATURES.length].id;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="features" className="s2-section">
      <div className="s2-container">
        <Reveal>
          <div style={{ marginBottom: 56, maxWidth: '50ch' }}>
            <div className="s2-eyebrow" style={{ marginBottom: 16 }}>
              <span className="dot" /> 03 · tính năng
            </div>
            <h2 className="s2-h2" style={{ marginBottom: 16 }}>
              một nền tảng,
              <br />
              <span className="s2-text-blue">sáu siêu năng lực.</span>
            </h2>
          </div>
        </Reveal>

        <Reveal>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 40,
            }}
          >
            {FEATURES.map((f) => (
              <button
                key={f.id}
                data-cursor="hover"
                className={`s2-feature-tab ${active === f.id ? 'is-active' : ''}`}
                onClick={() => {
                  setActive(f.id);
                  dl({ event: 'feature_tab_click', tab_id: f.id });
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1.4fr)',
            gap: 'clamp(36px, 5vw, 80px)',
            alignItems: 'start',
          }}
        >
          <Reveal>
            <div>
              <h3 className="s2-h3" style={{ marginBottom: 14 }}>{cur.title}</h3>
              <p className="s2-body" style={{ marginBottom: 24 }}>{cur.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cur.bullets.map((b) => (
                  <li
                    key={b}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 15 }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 9999,
                        background: 'var(--s2-blue)',
                        color: '#fff',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                        marginTop: 2,
                      }}
                    >
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div
              className="s2-card-glass"
              style={{
                aspectRatio: '4 / 3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--s2-font-mono)',
                fontSize: 11,
                color: 'var(--s2-text-subtle)',
                background:
                  'linear-gradient(135deg, rgba(29, 73, 255, 0.12), rgba(255, 14, 101, 0.08))',
                border: '1px solid var(--s2-border-strong)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Mock browser frame */}
              <div
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--s2-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(0, 0, 0, 0.2)',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 9999, background: '#ff5f57' }} />
                <span style={{ width: 10, height: 10, borderRadius: 9999, background: '#febc2e' }} />
                <span style={{ width: 10, height: 10, borderRadius: 9999, background: '#28c840' }} />
                <span style={{ marginLeft: 14, fontFamily: 'var(--s2-font-mono)', fontSize: 11, color: 'var(--s2-text-subtle)' }}>
                  manager.5bib.com / {cur.id}
                </span>
              </div>
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div
                  style={{
                    fontSize: 'clamp(40px, 8vw, 96px)',
                    fontWeight: 900,
                    color: 'var(--s2-text)',
                    fontFamily: 'var(--s2-font-display)',
                    letterSpacing: '-0.05em',
                    lineHeight: 1,
                    marginBottom: 12,
                  }}
                >
                  {cur.label.toLowerCase()}
                </div>
                <div style={{ fontSize: 13, color: 'var(--s2-text-muted)' }}>
                  Mockup preview — sẽ hiện hệt trong demo
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  PROCESS — 3 steps with vertical scroll line                                */
/* ────────────────────────────────────────────────────────────────────────── */

export function S2Process() {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const fillRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      const w = wrapRef.current;
      const f = fillRef.current;
      if (!w || !f) return;
      const rect = w.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = rect.top - vh * 0.5;
      const end = rect.bottom - vh * 0.5;
      const total = end - start;
      const progress = Math.max(0, Math.min(1, -start / total));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        f.style.height = `${progress * 100}%`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const STEPS = [
    {
      tag: '01 / khai báo',
      title: 'Khai báo sự kiện trong 30 phút',
      desc: 'Cự ly, giá vé, ngày bán, trang đăng ký — điền form. 5BIB tự setup.',
    },
    {
      tag: '02 / branding',
      title: 'Tuỳ chỉnh thương hiệu',
      desc: 'Logo, màu, custom domain (vd marathon.brand.com). Email template gắn brand BTC.',
    },
    {
      tag: '03 / golive',
      title: 'Mở bán & theo dõi live',
      desc: 'Bấm "go live". Bán vé bắt đầu. Doanh thu real-time trên dashboard. Email automation chạy nền.',
    },
  ];

  return (
    <section id="process" className="s2-section" ref={wrapRef} style={{ position: 'relative' }}>
      {/* Big mascot in the corner cheering on the process */}
      <div
        style={{
          position: 'absolute',
          right: 'clamp(20px, 5vw, 80px)',
          top: 'clamp(40px, 6vw, 80px)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <S2MascotSection width={220} flipX />
      </div>
      <div className="s2-container">
        <Reveal>
          <div style={{ marginBottom: 64, maxWidth: '54ch' }}>
            <div className="s2-eyebrow" style={{ marginBottom: 16 }}>
              <span className="dot" /> 04 · quy trình
            </div>
            <h2 className="s2-h2" style={{ marginBottom: 16 }}>
              72 giờ từ ý tưởng
              <br />
              đến tiếp cận{' '}
              <span className="s2-text-blue">120k user</span> của 5bib.
            </h2>
          </div>
        </Reveal>

        <div style={{ position: 'relative', paddingLeft: 60 }}>
          <div className="s2-process-line" style={{ left: 24, top: 20, bottom: 20 }}>
            <div ref={fillRef} className="s2-process-line-fill" />
          </div>

          {STEPS.map((s, i) => (
            <Reveal key={s.tag} delay={i * 100}>
              <div style={{ marginBottom: 56, position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: -60 + 24 - 18,
                    top: 4,
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    background: 'var(--s2-bg)',
                    border: '2px solid var(--s2-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--s2-blue-bright)',
                    fontFamily: 'var(--s2-font-mono)',
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  {i + 1}
                </div>
                <div className="s2-eyebrow" style={{ marginBottom: 10 }}>{s.tag}</div>
                <h3 className="s2-h3" style={{ marginBottom: 8 }}>{s.title}</h3>
                <p className="s2-body" style={{ maxWidth: '60ch' }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  CASE STUDY — VTV-LPB Marathon (animated counters)                          */
/* ────────────────────────────────────────────────────────────────────────── */

export function S2CaseStudy() {
  return (
    <section
      id="case-study"
      className="s2-section"
      style={{
        background:
          'linear-gradient(180deg, transparent 0%, var(--s2-bg-deep) 50%, transparent 100%)',
      }}
    >
      <div className="s2-container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1fr) auto',
            gap: 'clamp(24px, 4vw, 64px)',
            alignItems: 'center',
            marginBottom: 56,
          }}
        >
          <Reveal>
            <div>
              <div className="s2-eyebrow" style={{ marginBottom: 16 }}>
                <span className="dot" /> 05 · case study
              </div>
              <h2 className="s2-h2" style={{ marginBottom: 16, maxWidth: '14ch' }}>
                <span className="s2-text-lime">5,000 vé</span> bán hết trong 3 tiếng.
              </h2>
              <p className="s2-lead" style={{ maxWidth: '52ch' }}>
                VTV–LPB Marathon 2026. Mở bán 8h sáng. 11h trưa hết hàng. 0 cuộc gọi
                support. 82% Zalo OA open rate.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <div className="s2-mascot-cs-wrap" aria-hidden="true">
              <S2MascotSection width={200} />
            </div>
          </Reveal>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'clamp(20px, 3vw, 32px)',
            marginBottom: 48,
          }}
        >
          {[
            { num: 3, suffix: 'h', label: 'sold-out time', color: 'var(--s2-lime)' },
            { num: 0, suffix: '', label: 'support call', color: 'var(--s2-blue-bright)' },
            { num: 82, suffix: '%', label: 'Zalo OA open', color: 'var(--s2-magenta-soft)' },
            { num: 18, suffix: '.2%', label: 'cart → paid', color: 'var(--s2-text)' },
          ].map((s) => (
            <Reveal key={s.label}>
              <div className="s2-card">
                <div className="s2-stat" style={{ color: s.color, marginBottom: 8 }}>
                  <Counter to={s.num} suffix={s.suffix} />
                </div>
                <div
                  style={{
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
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="s2-card-glass" style={{ padding: 28 }}>
            <div className="s2-eyebrow" style={{ marginBottom: 18 }}>funnel breakdown</div>
            {[
              { label: 'Lượt truy cập', value: 27448, max: 27448 },
              { label: 'Cart added', value: 8210, max: 27448 },
              { label: 'Vé thanh toán', value: 5000, max: 27448 },
            ].map((f) => (
              <div key={f.label} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: 'var(--s2-text-muted)',
                    marginBottom: 6,
                  }}
                >
                  <span>{f.label}</span>
                  <span style={{ fontFamily: 'var(--s2-font-mono)', color: 'var(--s2-text)', fontWeight: 700 }}>
                    {f.value.toLocaleString('vi-VN')}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 9999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(f.value / f.max) * 100}%`,
                      background: 'linear-gradient(90deg, var(--s2-blue), var(--s2-magenta))',
                      borderRadius: 9999,
                      transition: 'width 1400ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  TESTIMONIALS                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export function S2Testimonials() {
  const QUOTES = [
    {
      text: 'Sau 6 tháng dùng 5BIB, traffic tăng +312%, share lên Facebook nhân 4 lần. VĐV không còn email hỏi BIB nữa.',
      who: 'Đặng Quang Đức',
      role: 'Trưởng BTC',
      org: 'Race Jungle',
    },
    {
      text: '5,000 vé bán hết trong 3h, không một cuộc gọi support nào. Tiết kiệm 2 ngày vận hành, BTC ngủ ngon đêm trước race.',
      who: 'Tạ Quang Quỳnh',
      role: 'Operations Lead',
      org: 'VTV–LPBank Marathon',
    },
    {
      text: '94% VĐV đánh giá hài lòng cao. Dashboard cho phép tôi nhìn doanh thu live theo từng giờ — báo cáo mùa giải xong trong 1 tiếng.',
      who: 'Nguyễn Văn Du',
      role: 'Founder',
      org: '5Sport Tournaments',
    },
  ];
  return (
    <section className="s2-section">
      <div className="s2-container">
        <Reveal>
          <div style={{ marginBottom: 56 }}>
            <div className="s2-eyebrow" style={{ marginBottom: 16 }}>
              <span className="dot" /> 06 · feedback
            </div>
            <h2 className="s2-h2" style={{ marginBottom: 16 }}>
              họ đã chạy với 5bib.
              <br />
              <span className="s2-text-magenta">đây là điều họ nói.</span>
            </h2>
          </div>
        </Reveal>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(20px, 2.5vw, 28px)',
          }}
        >
          {QUOTES.map((q, i) => (
            <Reveal key={q.who} delay={i * 80}>
              <article className="s2-card" data-cursor="hover" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 64,
                    fontWeight: 900,
                    color: 'var(--s2-magenta)',
                    fontFamily: 'var(--s2-font-display)',
                    lineHeight: 0.5,
                    marginBottom: 12,
                  }}
                >&ldquo;</span>
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: 'var(--s2-text)',
                    flexGrow: 1,
                    margin: 0,
                  }}
                >
                  {q.text}
                </p>
                <div
                  style={{
                    marginTop: 24,
                    paddingTop: 18,
                    borderTop: '1px solid var(--s2-border)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--s2-text)' }}>{q.who}</div>
                  <div style={{ fontSize: 13, color: 'var(--s2-text-muted)' }}>
                    {q.role} · {q.org}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  PRICING                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export function S2Pricing() {
  const INCLUDED = [
    'Form đăng ký + thanh toán đa kênh (Visa/ATM/QR/Zalo Pay/MoMo)',
    'Auto BIB + wave + e-waiver điện tử',
    'App check-in QR offline-first',
    'Email · SMS · Zalo OA broadcast + automation',
    'Tiếp cận network 120K runner trên 5BIB',
    'Custom domain · white-label · API kết quả',
    'Onboarding 1-1 với BD team trong 72h',
  ];
  const SLOTS = [
    { date: '03/01/2026', status: 'available', label: 'Còn slot' },
    { date: '05/01/2026', status: 'available', label: 'Còn slot' },
    { date: '05/02/2026', status: 'filling', label: '2/4 đã book' },
    { date: '08/02/2026', status: 'available', label: 'Còn slot' },
    { date: '06/03/2026', status: 'filling', label: '3/4 đã book' },
    { date: '10/03/2026', status: 'full', label: 'Đã full' },
  ] as const;
  return (
    <section id="pricing" className="s2-section">
      <div className="s2-container">
        <Reveal>
          <div style={{ marginBottom: 56, maxWidth: '54ch' }}>
            <div className="s2-eyebrow" style={{ marginBottom: 16 }}>
              <span className="dot" /> 07 · pricing
            </div>
            <h2 className="s2-h2" style={{ marginBottom: 16 }}>
              minh bạch. tối ưu.
              <br />
              <span className="s2-text-blue">theo quy mô giải</span> của bạn.
            </h2>
            <p className="s2-lead">
              Một mức giá. Không phụ phí ẩn. Không charge per-VĐV. Không lock-in.
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(280px, 1fr)',
            gap: 'clamp(28px, 4vw, 48px)',
          }}
        >
          <Reveal>
            <div
              className="s2-card"
              style={{
                background:
                  'linear-gradient(180deg, var(--s2-surface), var(--s2-surface-2))',
                borderColor: 'var(--s2-blue)',
              }}
            >
              <span className="s2-chip s2-chip-blue" style={{ marginBottom: 18 }}>
                Tất cả gói đều bao gồm
              </span>
              <h3 className="s2-h3" style={{ marginBottom: 24 }}>7 thứ ngon, 0 phụ phí</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {INCLUDED.map((item) => (
                  <li
                    key={item}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14 }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 9999,
                        background: 'var(--s2-blue)',
                        color: '#fff',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        marginTop: 2,
                      }}
                    >✓</span>
                    <span style={{ color: 'var(--s2-text)' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="s2-card-glass">
              <div className="s2-eyebrow" style={{ marginBottom: 14 }}>
                Mùa giải Q1/2026
              </div>
              <div style={{ fontFamily: 'var(--s2-font-mono)', fontSize: 13, color: 'var(--s2-text-muted)', marginBottom: 18 }}>
                14 slot · còn {SLOTS.filter((s) => s.status !== 'full').length} slot
              </div>
              {SLOTS.map((s) => (
                <div key={s.date} className="s2-slot" data-status={s.status}>
                  <span style={{ fontFamily: 'var(--s2-font-mono)', fontWeight: 700 }}>{s.date}</span>
                  <span
                    style={{
                      fontSize: 12,
                      color:
                        s.status === 'available'
                          ? 'var(--s2-lime)'
                          : s.status === 'filling'
                          ? 'var(--s2-magenta-soft)'
                          : 'var(--s2-text-subtle)',
                      fontWeight: 600,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
              <Magnetic strength={0.2}>
                <a
                  href="#contact"
                  data-cursor="magnetic"
                  className="s2-btn s2-btn-magenta"
                  style={{ width: '100%', marginTop: 20 }}
                  onClick={() => dl({ event: 'pricing_cta_click', cta_text: 'Đặt slot ngay' })}
                >
                  Đặt slot ngay →
                </a>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FAQ                                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export function S2FAQ() {
  const ITEMS = [
    ['Mất bao lâu từ ký hợp đồng đến mở bán?', '72 giờ làm việc. Onboarding 1-1 với BD team. BTC chỉ cần cung cấp logo, mô tả giải, cự ly, giá vé.'],
    ['Phí dịch vụ tính như thế nào?', 'Phí thấp tính theo % doanh thu vé bán ra (đã bao gồm phí thẻ thanh toán). Liên hệ để có báo giá theo quy mô giải.'],
    ['Có hỗ trợ chip timing không?', 'Có — tích hợp với hệ thống chip timing 5Tech. Result live trên result.5bib.com.'],
    ['BTC sở hữu data VĐV chứ?', 'BTC sở hữu 100% dữ liệu. Xuất CSV bất kỳ lúc nào. API kết quả mở. Không lock-in.'],
    ['Có app cho VĐV không?', 'Có — iOS + Android. VĐV xem BIB, kết quả live, certificate, ảnh AI 5Pix.'],
    ['White-label được không?', 'Có. Custom domain (vd marathon.brand.com), logo, màu, email template — toàn bộ branding của BTC.'],
    ['Hủy hợp đồng có phí phạt không?', 'Không. BTC có thể export data và dừng bất kỳ lúc nào.'],
  ];
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section id="faq" className="s2-section">
      <div className="s2-container">
        <Reveal>
          <div style={{ marginBottom: 48, maxWidth: '52ch' }}>
            <div className="s2-eyebrow" style={{ marginBottom: 16 }}>
              <span className="dot" /> 08 · faq
            </div>
            <h2 className="s2-h2">câu hỏi thường gặp.</h2>
          </div>
        </Reveal>
        <div>
          {ITEMS.map((item, i) => (
            <Reveal key={i} delay={i * 40}>
              <div className="s2-faq-item" data-open={open === i ? 'true' : 'false'}>
                <button
                  className="s2-faq-q"
                  data-cursor="hover"
                  onClick={() => {
                    const next = open === i ? null : i;
                    setOpen(next);
                    if (next !== null) dl({ event: 'faq_open', q_index: i, q_text: item[0].slice(0, 80) });
                  }}
                >
                  <span>{item[0]}</span>
                  <span className="icon" aria-hidden="true" />
                </button>
                <div className="s2-faq-a">{item[1]}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FINAL CTA + LEAD FORM (modal)                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function S2FinalMascot() {
  const ref = React.useRef<HTMLImageElement>(null);
  const frame = useMascotFrame(150);
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0; let t = 0; let last = performance.now();
    const animate = (now: number) => {
      const dt = now - last; last = now;
      t += dt * 0.005;
      const el = ref.current;
      if (el) {
        const bob = Math.abs(Math.sin(t)) * 16;
        const tilt = Math.sin(t) * 5;
        el.style.transform = `translateY(${-bob}px) rotate(${tilt}deg)`;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={mascotSrc(frame)} alt="" className="s2-final-mascot" />
  );
}

export function S2FinalCTA({ onOpenContact }: { onOpenContact: () => void }) {
  return (
    <section id="contact" className="s2-final s2-section">
      <S2FinalMascot />
      <div className="s2-container" style={{ position: 'relative', zIndex: 2 }}>
        <Reveal>
          <div className="s2-eyebrow" style={{ marginBottom: 20, color: 'rgba(255,255,255,0.7)' }}>
            <span className="dot" /> 14 slot Q1/2026 còn lại
          </div>
          <h2
            className="s2-h2"
            style={{
              color: '#fff',
              maxWidth: '20ch',
              marginBottom: 28,
            }}
          >
            mở bán giải đầu tiên{' '}
            <span style={{ color: 'var(--s2-lime)' }}>trong 72 giờ.</span>
          </h2>
          <p
            className="s2-lead"
            style={{
              color: 'rgba(255,255,255,0.8)',
              maxWidth: '50ch',
              marginBottom: 32,
            }}
          >
            Đặt lịch demo 15 phút với BD team. Có ngay quote chi tiết, timeline triển khai.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <Magnetic strength={0.3}>
              <button
                type="button"
                data-cursor="magnetic"
                className="s2-btn"
                style={{ background: '#fff', color: 'var(--s2-blue)', padding: '18px 36px', fontSize: 16 }}
                onClick={() => {
                  onOpenContact();
                  dl({ event: 'final_cta_click', cta_text: 'Đặt lịch demo 15 phút' });
                }}
              >
                Đặt lịch demo 15 phút →
              </button>
            </Magnetic>
            <Magnetic strength={0.2}>
              <a
                href="tel:+84986587345"
                data-cursor="hover"
                className="s2-btn s2-btn-ghost"
                style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
                onClick={() => dl({ event: 'final_cta_click', cta_text: 'Hotline 0986 587 345' })}
              >
                Hotline 0986 587 345
              </a>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FOOTER                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export function S2Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="s2-footer">
      <div className="s2-container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 36,
            marginBottom: 40,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: 'var(--s2-font-display)',
                fontWeight: 800,
                fontSize: 22,
                color: 'var(--s2-text)',
                marginBottom: 14,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/solution/logos/5bib-logo-white.png" alt="" style={{ height: 32 }} />
              5BIB
            </div>
            <p style={{ color: 'var(--s2-text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              Cổng đăng ký & quản lý VĐV #1 Việt Nam. Một phần của hệ sinh thái{' '}
              <a href="https://5solution.vn" style={{ color: 'var(--s2-text)', textDecoration: 'none', borderBottom: '1px solid var(--s2-border-strong)' }}>5Solution</a>.
            </p>
          </div>

          <FooterCol
            title="Sản phẩm"
            items={[
              { label: '5BIB Manager', href: '#features' },
              { label: 'Quy trình', href: '#process' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'FAQ', href: '#faq' },
            ]}
          />
          <FooterCol
            title="Hệ sinh thái"
            items={[
              { label: '5Solution Umbrella', href: 'https://5solution.vn' },
              { label: '5Sport Tournaments', href: 'https://solution.5sport.vn' },
              { label: 'result.5bib.com', href: 'https://result.5bib.com' },
            ]}
          />
          <FooterCol
            title="Liên hệ"
            items={[
              { label: 'Hồ Gươm Plaza, Hà Nội', href: '#contact' },
              { label: '0986 587 345', href: 'tel:+84986587345' },
              { label: 'contact@5bib.com', href: 'mailto:contact@5bib.com' },
            ]}
          />
        </div>
        <div
          style={{
            paddingTop: 24,
            borderTop: '1px solid var(--s2-border)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 12,
            color: 'var(--s2-text-subtle)',
          }}
        >
          <span>© {year} Công ty Cổ phần 5BIB.</span>
          <span>Made with ♥ in Hà Nội · Powered by 5Solution</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <h4
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--s2-text-subtle)',
          fontWeight: 800,
          margin: '0 0 14px 0',
        }}
      >{title}</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => (
          <li key={it.label}>
            <a
              href={it.href}
              data-cursor="hover"
              style={{
                color: 'var(--s2-text-muted)',
                textDecoration: 'none',
                fontSize: 14,
                transition: 'color 240ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--s2-text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--s2-text-muted)')}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
