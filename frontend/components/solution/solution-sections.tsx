'use client';

import * as React from 'react';
import { IArr, ICheck, IPlus, IX, LiveDot, Pill, useT, type Lang } from './solution-icons';

type Ctx = { lang: Lang; accent?: string };

export function SolutionHowItWorks({ lang, accent = '#FF0E65' }: Ctx) {
  const t = useT(lang);
  const steps = [
    { n: '01', t: t('Khai báo dữ liệu', 'Declare your data'), d: t('Vận hành của 5BIB nhận thông tin và tiến hành setup trên cổng bán vé.', 'The 5BIB ops team receives your info and sets everything up on the ticketing portal.') },
    { n: '02', t: t('Tuỳ chỉnh thương hiệu', 'Customize your brand'), d: t('Đổi màu, logo, ảnh hero, form field, điều khoản, chính sách hoàn vé — trong 2h.', 'Swap colors, logo, hero, form fields, terms and refund policy — in 2 hours.') },
    { n: '03', t: t('Mở bán & theo dõi', 'Go live & track'), d: t('Cổng bán vé đã sẵn sàng trên 5bib.com, VĐV mua vé, BTC theo dõi analytics.', 'The ticketing portal is live on 5bib.com, athletes buy tickets, organizers track analytics.') },
  ];
  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '96px 32px 40px' }}>
      <div style={{ marginBottom: 40, maxWidth: 720 }}>
        <div className="type-eyebrow" style={{ color: accent }}>{t('Quy trình', 'How it works')}</div>
        <h2 className="type-campaign" style={{ fontSize: 'clamp(40px,5vw,72px)', color: 'var(--5s-text)', margin: '10px 0 0' }}>
          {t('72 giờ từ ý tưởng', '72 hours from an idea')}<br />
          <span style={{ color: 'var(--5s-blue)' }}>{t('đến tiếp cận 120k user của 5BIB.', 'to reaching 120k 5BIB users.')}</span>
        </h2>
      </div>
      <div className="solution-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
        {steps.map((s, i) => (
          <div key={i} className="solution-step-card" style={{ background: '#fff', border: '1px solid var(--5s-border)', borderRadius: 16, padding: 28, position: 'relative' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 56, letterSpacing: '-0.04em', color: accent, lineHeight: 1 }}>{s.n}</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, margin: '14px 0 8px', letterSpacing: '-0.02em', color: 'var(--5s-text)' }}>{s.t}</h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.55, color: 'var(--5s-text-muted)', margin: 0 }}>{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SolutionTimeline({ lang, accent = '#FF0E65' }: Ctx) {
  const t = useT(lang);
  const phases = [
    { k: 'D-60', t: t('Setup giải', 'Setup'), d: t('Team 5BIB onboard trong 48h. Form, thanh toán, brand, domain ready.', '5BIB team onboards in 48h. Form, payments, brand, domain ready.'), col: 'var(--5s-blue)' },
    { k: 'D-45', t: t('Mở bán early bird', 'Early bird opens'), d: t('Email blast 120k runner, kênh Zalo OA, tiered pricing tự động.', 'Email blast 120k runners, Zalo OA channel, automatic tiered pricing.'), col: '#0E7490' },
    { k: 'D-14', t: t('Đóng bán + gán BIB', 'Close sales + assign BIBs'), d: t('Auto gán BIB & wave. VĐV tự đổi cự ly/size qua dashboard.', 'Auto-assign BIBs & waves. Athletes self-serve distance/size changes.'), col: '#D97706' },
    { k: 'D-1', t: t('Check-in & kit pickup', 'Check-in & kit pickup'), d: t('App scan QR, tình nguyện viên offline-ready. 420 VĐV/h.', 'App QR scan, volunteers offline-ready. 420 runners/h.'), col: accent },
    { k: 'D-0', t: t('Race day', 'Race day'), d: t('Communication realtime — weather update, wave call, cảm ơn.', 'Realtime communications — weather updates, wave calls, thank-you.'), col: 'var(--5s-success)' },
  ];
  return (
    <section style={{ background: 'var(--5s-surface)', borderTop: '1px solid var(--5s-border)', borderBottom: '1px solid var(--5s-border)', padding: '96px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ marginBottom: 40, maxWidth: 820 }}>
          <div className="type-eyebrow" style={{ color: accent }}>{t('Timeline mùa giải', 'Season timeline')}</div>
          <h2 className="type-campaign" style={{ fontSize: 'clamp(40px,5vw,72px)', color: 'var(--5s-text)', margin: '10px 0 0' }}>
            {t('từ D-60 đến vạch xuất phát.', 'from D-60 to the start line.')}<br />
            <span style={{ color: 'var(--5s-blue)' }}>{t('5BIB bên bạn mọi bước.', '5BIB walks every step.')}</span>
          </h2>
        </div>
        <div style={{ position: 'relative' }} className="solution-timeline">
          <div style={{ position: 'absolute', top: 42, left: 28, right: 28, height: 2, background: 'var(--5s-border)', zIndex: 0 }} />
          <div className="solution-timeline-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, position: 'relative', zIndex: 1 }}>
            {phases.map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ width: 86, height: 86, borderRadius: 22, margin: '0 auto', background: '#fff', border: `2px solid ${p.col}`, color: p.col, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em' }}>{p.k}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, letterSpacing: '-0.01em', marginTop: 14, color: 'var(--5s-text)' }}>{p.t}</div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--5s-text-muted)', lineHeight: 1.5, margin: '8px auto 0', maxWidth: 180 }}>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SolutionComparison({ lang, accent = '#FF0E65' }: Ctx) {
  const t = useT(lang);
  const rows: Array<{ f: string; v: Array<true | false | string> }> = [
    { f: t('Form đăng ký tuỳ biến', 'Custom registration form'), v: [true, 'basic', false, true] },
    { f: t('Thanh toán VN (VNPay / Momo / Zalo)', 'VN payments (VNPay / Momo / Zalo)'), v: [true, false, true, 'build it'] },
    { f: t('Gán BIB + chia wave tự động', 'Auto BIB + wave split'), v: [true, false, false, 'build it'] },
    { f: t('Check-in QR offline', 'Offline QR check-in'), v: [true, false, false, 'build it'] },
    { f: t('Email / SMS / Zalo OA', 'Email / SMS / Zalo OA'), v: [true, false, 'email only', 'build it'] },
    { f: t('Athlete dashboard', 'Athlete dashboard'), v: [true, false, false, 'build it'] },
    { f: t('Tiếp cận 120k runner sẵn có', 'Reach 120k existing runners'), v: [true, false, false, false] },
    { f: t('Custom domain / white-label', 'Custom domain / white-label'), v: [true, false, 'expensive', 'build it'] },
    { f: t('Thời gian mở bán', 'Time to live'), v: ['72h', '1h', '2 tuần', '6 tháng'] },
    { f: t('Chi phí tổng', 'Total cost'), v: [t('Liên hệ báo giá', 'Contact sales'), t('Miễn phí*', 'Free*'), t('Phí cao', 'High fees'), '150M+'] },
  ];
  const cols = [
    { n: '5BIB', sub: t('cổng ĐK & QL VĐV', 'registration & mgmt'), h: true },
    { n: 'Google Form', sub: t('+ chuyển khoản thủ công', '+ manual bank transfer') },
    { n: t('Platform đóng', 'Closed platform'), sub: t('các nền tảng ĐK khác', 'other registration platforms') },
    { n: t('Tự build', 'In-house build'), sub: t('Dev nội bộ', 'Internal dev') },
  ];
  const renderCell = (v: true | false | string) => {
    if (v === true) return <span style={{ color: 'var(--5s-success)' }}><ICheck s={18} /></span>;
    if (v === false) return <span style={{ color: 'var(--5s-text-subtle)' }}><IX s={16} /></span>;
    return <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--5s-text-muted)' }}>{v}</span>;
  };
  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '96px 32px 40px' }}>
      <div style={{ marginBottom: 40, maxWidth: 820 }}>
        <div className="type-eyebrow" style={{ color: accent }}>{t('So sánh', 'Comparison')}</div>
        <h2 className="type-campaign" style={{ fontSize: 'clamp(40px,5vw,72px)', color: 'var(--5s-text)', margin: '10px 0 0' }}>
          {t('chọn 5BIB,', 'pick 5BIB,')}<br />
          <span style={{ color: 'var(--5s-blue)' }}>{t('không cần chọn lại.', 'never look back.')}</span>
        </h2>
      </div>
      <div className="solution-comparison-wrap" style={{ background: '#fff', border: '1px solid var(--5s-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', borderBottom: '1px solid var(--5s-border)', background: 'var(--5s-slate-50)' }}>
          <div style={{ padding: '22px 24px', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)' }}>{t('Tính năng', 'Feature')}</div>
          {cols.map((c, i) => (
            <div key={i} style={{ padding: '22px 18px', textAlign: 'center', background: c.h ? 'var(--5s-blue)' : 'transparent', color: c.h ? '#fff' : 'var(--5s-text)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em' }}>{c.n}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: c.h ? 'rgba(255,255,255,0.8)' : 'var(--5s-text-subtle)', marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', borderBottom: i < rows.length - 1 ? '1px solid var(--5s-border)' : 'none', background: i % 2 ? 'var(--5s-slate-50)' : '#fff' }}>
            <div style={{ padding: '16px 24px', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600, color: 'var(--5s-text)' }}>{r.f}</div>
            {r.v.map((v, j) => (
              <div key={j} style={{ padding: '16px 18px', textAlign: 'center', background: j === 0 ? 'rgba(21,46,150,0.04)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{renderCell(v)}</div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--5s-text-subtle)', fontWeight: 500 }}>
        {t('* Google Form miễn phí nhưng chi phí ẩn: 2 tuần đối soát + không có dashboard, check-in, communication.', '* Google Form is free but hides costs: 2 weeks of reconciliation + no dashboard, check-in, or communications.')}
      </div>
    </section>
  );
}

export function SolutionCaseStudy({ lang, accent = '#FF0E65' }: Ctx) {
  const t = useT(lang);
  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ background: 'var(--5s-blue-700)', color: '#fff', borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
        <div aria-hidden style={{ position: 'absolute', top: -80, right: -40, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(190,225,74,0.18),transparent 65%)' }} />
        <div className="solution-case-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 0 }}>
          <div style={{ padding: 'clamp(36px,5vw,64px)' }}>
            <Pill bg="rgba(255,255,255,0.18)" color="#fff">{t('Case study', 'Case study')}</Pill>
            <h2 className="type-campaign" style={{ fontSize: 'clamp(36px,4.4vw,56px)', color: '#fff', margin: '18px 0 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {t('5,000 vé bán hết', '5,000 tickets sold out')}<br />
              <span style={{ color: accent }}>{t('trong 3 tiếng.', 'in 3 hours.')}</span>
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)', margin: '22px 0 0', maxWidth: 520 }}>
              {t('VTV–LPBank Marathon 2026 chọn 5BIB sau 2 năm dùng Google Form. Kết quả: bán hết trong một buổi sáng, 0 call support, email blast 120k runner mở 82%.', 'VTV–LPBank Marathon 2026 picked 5BIB after two years on Google Form. Result: sold out in a morning, zero support calls, 82% open rate on a 120k-runner blast.')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 32, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
              {[
                { v: '3h', l: t('sold-out', 'to sell out') },
                { v: '0', l: t('cuộc gọi support', 'support calls') },
                { v: '82%', l: t('Zalo OA open rate', 'Zalo OA open') },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 44, letterSpacing: '-0.04em', color: accent, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: 'clamp(36px,5vw,64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.14)' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 18, padding: 28, backdropFilter: 'blur(10px)', width: '100%', maxWidth: 360 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>{t('Phễu bán vé — 09:00 → 12:00', 'Sales funnel — 09:00 → 12:00')}</div>
              {[
                { l: t('Truy cập landing', 'Landing visits'), v: '27,448', w: 100 },
                { l: t('Bấm Mua vé', 'Add to cart'), v: '8,210', w: 30 },
                { l: t('Thanh toán thành công', 'Payments completed'), v: '5,000', w: 18.2 },
              ].map((f, i) => (
                <div key={i} style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600 }}>{f.l}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: accent }}>{f.v}</span>
                  </div>
                  <div style={{ height: 10, background: 'rgba(255,255,255,0.12)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ width: `${f.w}%`, height: '100%', background: accent }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Conversion</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, color: '#fff', letterSpacing: '-0.02em' }}>18.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SolutionTestimonials({ lang, accent = '#FF0E65' }: Ctx) {
  const t = useT(lang);
  const quotes = [
    { q: t('"Trang đăng ký đẹp đến mức VĐV chủ động share lên Facebook. Lượng traffic về giải tăng 3 lần so với năm ngoái."', '"Our registration page is polished enough that runners share it unprompted. Traffic to the race tripled versus last year."'), n: 'Đặng Quang Đức', r: t('Giám đốc · Racejungle', 'Director · Racejungle'), s: '+312%', sl: t('lượt share', 'shares') },
    { q: t('"Tôi từng rất đau đầu về việc bán vé và quản lý bản vé. Giờ chạy 1 luồng, tiết kiệm nhiều ngày làm việc."', '"Ticketing and bib management used to be a massive headache. Now it all runs as one flow — saving us days of work every race."'), n: 'Tạ Quang Quỳnh', r: t('Trưởng nhóm · VTV–LPBank Marathon', 'Team Lead · VTV–LPBank Marathon'), s: '2 ngày', sl: t('tiết kiệm / giải', 'saved / race') },
    { q: t('"Lần đầu BTC VIỆT NAM có athlete dashboard + BTC dashboard đầy đủ. VĐV tự xử đổi cự ly, đội support giảm 80% ticket."', '"First time a Vietnamese organizer has a proper athlete + organizer dashboard. Runners self-serve distance swaps, and support tickets dropped 80%."'), n: 'Nguyễn Văn Du', r: t('Director · 5Sport', 'Director · 5Sport'), s: '94%', sl: t('VĐV hài lòng', 'runner satisfaction') },
  ];
  return (
    <section id="customers" style={{ background: 'var(--5s-blue-700)', color: '#fff', padding: '96px 0', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.08, background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4),transparent 55%), radial-gradient(circle at 85% 80%, rgba(212,20,90,0.5),transparent 55%)' }} />
      <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ marginBottom: 44, maxWidth: 700 }}>
          <div className="type-eyebrow" style={{ color: '#FFD6E3' }}>{t('Khách hàng nói gì', 'What organizers say')}</div>
          <h2 className="type-campaign" style={{ fontSize: 'clamp(40px,5vw,72px)', color: '#fff', margin: '10px 0 0' }}>
            {lang === 'vi' ? <>BTC <span style={{ textTransform: 'uppercase' }}>Việt Nam</span> chọn 5BIB.</> : 'VN organizers choose 5BIB.'}
          </h2>
        </div>
        <div className="solution-testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
          {quotes.map((qq, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, padding: 28, backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 56, lineHeight: 0.8, color: accent, height: 26, marginBottom: 12 }}>&ldquo;</div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, lineHeight: 1.55, margin: 0, color: 'rgba(255,255,255,0.92)' }}>{qq.q}</p>
              <div style={{ flex: 1 }} />
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>{qq.n}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{qq.r}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: accent, letterSpacing: '-0.02em' }}>{qq.s}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{qq.sl}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SolutionPricing({ lang, accent = '#FF0E65', onCTA }: Ctx & { onCTA: () => void }) {
  const t = useT(lang);
  return (
    <section id="pricing" style={{ maxWidth: 1280, margin: '0 auto', padding: '96px 32px 40px' }}>
      <div className="solution-cta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
        <div>
          <div className="type-eyebrow" style={{ color: accent }}>{t('Chi phí', 'Pricing')}</div>
          <h2 className="type-campaign" style={{ fontSize: 'clamp(40px,5vw,72px)', color: 'var(--5s-text)', margin: '10px 0 0' }}>
            {t('minh bạch. tối ưu.', 'transparent. optimized.')}<br />
            <span style={{ color: 'var(--5s-blue)' }}>{t('theo quy mô giải của bạn.', 'scaled to your event.')}</span>
          </h2>
          <p className="type-lead" style={{ marginTop: 18, maxWidth: 560 }}>
            {t('Mỗi giải là một câu chuyện khác nhau — quy mô, cự ly, upsell, kênh bán. Team 5BIB thiết kế gói theo đúng mùa giải của bạn. Gọi chúng tôi, 15 phút là có con số rõ ràng.', 'Every race is different — scale, distances, upsells, channels. The 5BIB team prices to fit your season. Call us — 15 minutes to a clear number.')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>
            <button onClick={onCTA} style={{ background: 'var(--5s-blue)', color: '#fff', border: 'none', padding: '16px 26px', borderRadius: 12, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-lg)' }}>
              {t('Liên hệ báo giá', 'Get a quote')} <IArr s={16} />
            </button>
            <button onClick={onCTA} style={{ background: '#fff', color: 'var(--5s-text)', border: '1.5px solid var(--5s-border)', padding: '16px 24px', borderRadius: 12, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer' }}>
              {t('Đặt demo 15 phút', 'Book 15-min demo')}
            </button>
          </div>
        </div>
        <div style={{ background: 'var(--5s-blue-700)', color: '#fff', borderRadius: 22, padding: 36, position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', top: -60, right: -40, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,20,90,0.3),transparent 65%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 900, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>{t('Gói bao gồm', 'Included in every plan')}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                t('Form builder + thanh toán + gán BIB + wave', 'Form builder + payments + BIB + wave assignment'),
                t('App check-in QR + athlete dashboard + BTC dashboard', 'QR check-in app + athlete dashboard + organizer dashboard'),
                t('Email / SMS / Zalo OA không giới hạn', 'Unlimited email / SMS / Zalo OA'),
                t('Tiếp cận 120k runner trên network 5BIB', 'Reach 120k runners on the 5BIB network'),
                t('Custom domain, white-label, API, webhook', 'Custom domain, white-label, API, webhooks'),
                t('Team 5BIB onboarding 1-1 giải đầu', '1-on-1 5BIB team onboarding for your first race'),
              ].map((l, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 500, lineHeight: 1.5 }}>
                  <span style={{ marginTop: 3, color: accent, flexShrink: 0 }}><ICheck s={15} /></span> {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SolutionFAQ({ lang, accent = '#FF0E65' }: Ctx) {
  const t = useT(lang);
  const [open, setOpen] = React.useState(0);
  const items = [
    { q: t('5BIB có thay Google Form & Excel được không?', 'Does 5BIB replace Google Form & Excel?'), a: t('Có. Form builder drag-drop hỗ trợ mọi field Google Form có, cộng thêm thanh toán, coupon, early bird, team/group, upsell — điều Google Form không làm được. Export CSV mọi lúc nếu bạn muốn.', "Yes. The drag-drop form builder supports every field Google Form does, plus payments, coupons, early bird, team/group, and upsells — things Google Form can't do. Export CSV anytime.") },
    { q: t('Thanh toán gồm những cổng nào?', 'Which payment methods are supported?'), a: t('VNPay, Momo, ZaloPay, thẻ ATM nội địa, Visa/Master/JCB, Apple Pay. Tiền về tài khoản BTC theo chu kỳ T+1 hoặc T+3 tuỳ gói.', 'VNPay, Momo, ZaloPay, domestic ATM cards, Visa/Master/JCB, Apple Pay. Settlement to the organizer account T+1 or T+3 depending on plan.') },
    { q: t('Bao lâu thì mở bán được?', 'How fast can we go live?'), a: t('72 giờ kể từ khi BTC gửi thông tin giải. Team 5BIB onboard 1-1, setup form, domain, brand, thanh toán. Bạn chỉ cần review và bấm "mở bán".', '72 hours from your kickoff. The 5BIB team onboards 1-on-1, sets up the form, domain, brand, and payments. You just review and hit "go live."') },
    { q: t('Check-in hoạt động thế nào khi mất mạng?', 'How does check-in work when the network drops?'), a: t('App offline-first: volunteer scan QR, dữ liệu lưu local, auto sync khi có mạng. Đã test với 5,000 VĐV/giờ không bị delay.', 'Offline-first app: volunteers scan QR, data is stored locally, auto-syncs when the network returns. Tested at 5,000 runners/hour with no delay.') },
    { q: t('VĐV có thể đổi cự ly sau khi đăng ký không?', 'Can athletes change distance after registering?'), a: t('Có. Athlete Dashboard cho phép VĐV đổi cự ly, đổi size áo, cập nhật thông tin khẩn cấp. BTC bật/tắt quyền đổi theo policy giải.', 'Yes. The athlete dashboard lets runners change distance, swap shirt size, and update emergency info. Organizers can enable/disable changes per race policy.') },
    { q: t('Dữ liệu có thuộc về BTC không?', 'Does the organizer own the data?'), a: t('100%. BTC export CSV, API đầy đủ. 5BIB không bán data cho bên thứ 3. Tuân thủ Luật An ninh mạng VIỆT NAM và nguyên tắc GDPR.', '100%. Organizers export CSV and have full API access. 5BIB never sells data to third parties. Compliant with Vietnamese Cybersecurity Law and GDPR principles.') },
    { q: t('Phí thế nào?', 'What are the fees?'), a: t('Mỗi giải là một câu chuyện khác — quy mô, cự ly, upsell, kênh bán đều ảnh hưởng giá. Gọi chúng tôi 15 phút, có con số rõ ràng và không có phí ẩn.', 'Every race is different — scale, distances, upsells, channels all factor in. Book a 15-minute call for a clear number with no hidden fees.') },
  ];
  return (
    <section id="faq" style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 32px 40px' }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div className="type-eyebrow" style={{ color: accent }}>FAQ</div>
        <h2 className="type-campaign" style={{ fontSize: 'clamp(40px,5vw,64px)', color: 'var(--5s-text)', margin: '10px 0 0' }}>
          {t('câu hỏi thường gặp.', 'frequently asked.')}
        </h2>
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--5s-border)', borderRadius: 16, overflow: 'hidden' }}>
        {items.map((it, i) => {
          const isOpen = open === i;
          return (
            <div key={i} style={{ borderBottom: i < items.length - 1 ? '1px solid var(--5s-border)' : 'none' }}>
              <button onClick={() => setOpen(isOpen ? -1 : i)} className="solution-faq-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '22px 24px', background: isOpen ? 'var(--5s-blue-50)' : '#fff', border: 'none', textAlign: 'left', cursor: 'pointer', transition: 'all 150ms' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--5s-blue)', width: 32, flexShrink: 0 }}>0{i + 1}</span>
                <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16.5, letterSpacing: '-0.01em', color: 'var(--5s-text)' }}>{it.q}</span>
                <span style={{ transition: 'transform 280ms', transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)', color: 'var(--5s-blue)' }}><IPlus s={18} /></span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 24px 22px 72px', fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--5s-text-muted)' }}>{it.a}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SolutionFinalCTA({ lang, onCTA, accent = '#FF0E65' }: Ctx & { onCTA: () => void }) {
  const t = useT(lang);
  return (
    <section style={{ padding: '80px 32px', position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', background: 'var(--5s-blue)', color: '#fff', borderRadius: 28, padding: 'clamp(40px,6vw,80px) clamp(32px,6vw,72px)', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: -120, right: -60, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18),transparent 65%)' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: -160, left: -80, width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,20,90,0.25),transparent 65%)' }} />
        <div className="solution-cta-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 9999, marginBottom: 20 }}>
              <LiveDot color={accent} />
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 11.5, letterSpacing: '.14em', textTransform: 'uppercase' }}>{t('Mùa giải Q1/2026 · 14 slot còn lại', 'Q1/2026 season · 14 slots left')}</span>
            </div>
            <h2 className="type-campaign" style={{ fontSize: 'clamp(44px,5.6vw,84px)', margin: 0, color: '#fff' }}>
              {t('mở bán giải đầu tiên', 'launch your first race')}<br />
              <span style={{ color: 'rgba(255,255,255,0.62)' }}>{t('trong 72 giờ.', 'in 72 hours.')}</span>
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 17, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)', maxWidth: 560, margin: '20px 0 32px' }}>
              {t('Đặt lịch demo 15 phút với team 5BIB. Xem form builder, dashboard, flow thanh toán — và nhận báo giá theo đúng mùa giải của bạn trước khi rời buổi họp.', 'Book a 15-minute demo with the 5BIB team. See the form builder, dashboards, and payment flow — and leave with a quote matched to your season.')}
            </p>
            <div className="solution-cta-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button onClick={onCTA} style={{ background: '#fff', color: 'var(--5s-blue-700)', border: 'none', padding: '16px 28px', borderRadius: 12, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 14px 40px rgba(0,0,0,0.25)' }}>
                {t('Đặt lịch demo 15 phút', 'Book a 15-min demo')} <IArr s={16} />
              </button>
              <button onClick={onCTA} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.35)', padding: '16px 24px', borderRadius: 12, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer' }}>
                {t('Liên hệ báo giá', 'Get a quote')}
              </button>
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 20, padding: 26, backdropFilter: 'blur(12px)', width: '100%', maxWidth: 360 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 900, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>{t('Slot đang mở', 'Open slots')}</div>
              {[
                { m: t('Tháng 1 · Jan', 'January'), n: '3', max: '5' },
                { m: t('Tháng 2 · Feb', 'February'), n: '5', max: '8' },
                { m: t('Tháng 3 · Mar', 'March'), n: '6', max: '10' },
              ].map((s, i) => (
                <div key={i} style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700 }}>{s.m}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{s.n} / {s.max}</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.14)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ width: `${(parseInt(s.n) / parseInt(s.max)) * 100}%`, height: '100%', background: accent }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.16)', fontFamily: 'var(--font-body)', fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}>
                {t('Team 5BIB onboard tối đa 23 giải / quý để đảm bảo chất lượng 1-1.', 'The 5BIB team caps onboarding at 23 races / quarter to guarantee 1-on-1 quality.')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SolutionFooter({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const cols = [
    { h: t('Sản phẩm', 'Product'), l: ['5BIB · Registration', '5Ticket · Tickets', '5BIB Results', '5Pix · Photos', '5Tech · Timing'] },
    { h: t('Công ty', 'Company'), l: [t('Về chúng tôi', 'About'), t('Khách hàng', 'Customers'), 'Blog', t('Tuyển dụng', 'Careers'), t('Liên hệ', 'Contact')] },
    { h: t('Tài nguyên', 'Resources'), l: ['API Docs', t('Hướng dẫn BTC', 'Organizer Guide'), t('Tích hợp thanh toán', 'Payment Integrations'), 'Status', 'Changelog'] },
    { h: t('Pháp lý', 'Legal'), l: [t('Điều khoản', 'Terms'), t('Bảo mật', 'Privacy'), 'Cookies', t('Bộ Công Thương', 'MOIT notice')] },
  ];
  return (
    <footer style={{ background: '#0A1A4D', color: 'rgba(255,255,255,0.8)', padding: '56px 32px 28px' }}>
      <div className="solution-footer-grid" style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.4fr repeat(4,1fr)', gap: 32 }}>
        <div>
          {/* Use regular <img> — footer logo is below fold; avoids layout-shift vs next/image with unknown height */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/solution/logos/5bib-logo-white.png" alt="5BIB" style={{ height: 34, marginBottom: 16 }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', margin: 0, maxWidth: 280 }}>
            {t('Cổng đăng ký & quản lý VĐV #1 VIỆT NAM. Một phần của hệ sinh thái 5Solution.', "Vietnam's #1 registration & athlete-management platform. Part of the 5Solution ecosystem.")}
          </p>
        </div>
        {cols.map((col, i) => (
          <div key={i}>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 14, color: '#fff' }}>{col.h}</div>
            {col.l.map((x) => <a key={x} href="#" style={{ display: 'block', color: 'rgba(255,255,255,0.62)', textDecoration: 'none', fontFamily: 'var(--font-body)', fontSize: 13, padding: '4px 0' }}>{x}</a>)}
          </div>
        ))}
      </div>
      <div className="solution-footer-bottom" style={{ maxWidth: 1280, margin: '40px auto 0', paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)' }}>
        <span>© 2026 5Solution JSC · {t('Hà Nội, VIỆT NAM', 'Hanoi, Vietnam')} · MST 0108xxxxxx</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.7)' }}>Embracing Challenges</span>
      </div>
    </footer>
  );
}
