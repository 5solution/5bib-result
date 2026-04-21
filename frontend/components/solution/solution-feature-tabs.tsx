'use client';

import * as React from 'react';
import {
  IArr,
  ICal,
  IChart,
  ICheck,
  IPalette,
  IQr,
  IShare,
  ITicket,
  IUsers,
  IZap,
  LiveDot,
  Pill,
  useT,
  type Lang,
} from './solution-icons';

type Ctx = { lang: Lang; accent: string };

function TabShell({
  title,
  sub,
  bullets,
  right,
  accent,
}: {
  title: string;
  sub: string;
  bullets: string[];
  right: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="solution-tab-grid" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', minHeight: 540 }}>
      <div className="solution-tab-left" style={{ padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h3 className="type-campaign solution-tab-title" style={{ fontSize: 42, color: 'var(--5s-text)', margin: 0 }}>{title}</h3>
        <p className="type-lead solution-tab-sub" style={{ margin: '16px 0 24px', fontSize: 17 }}>{sub}</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ marginTop: 3, width: 22, height: 22, borderRadius: 9999, background: accent, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ICheck s={13} /></span>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, lineHeight: 1.5, color: 'var(--5s-text)' }}>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="solution-tab-right" style={{ background: 'var(--5s-surface)', borderLeft: '1px solid var(--5s-border)', padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {right}
      </div>
    </div>
  );
}

function Input({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)', marginBottom: 4 }}>{label}</div>
      <div style={{ padding: '9px 12px', border: '1px solid var(--5s-border)', borderRadius: 8, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function FormMock({ lang, accent }: Ctx) {
  const t = useT(lang);
  return (
    <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, border: '1px solid var(--5s-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--5s-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--5s-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14 }}>VTV</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>VTV–LPBank Marathon 2026</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--5s-text-subtle)', fontWeight: 600 }}>register.vtvlpbankmarathon.vn</div>
        </div>
        <Pill bg="var(--5s-success-bg)" color="var(--5s-success)"><LiveDot color="var(--5s-success)" />Live</Pill>
      </div>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)', marginBottom: 6 }}>{t('Chọn cự ly', 'Pick a distance')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[{ d: '5K', p: '390k', sel: false }, { d: '10K', p: '490k', sel: false }, { d: '21K', p: '690k', sel: true }].map((c, i) => (
              <div key={i} style={{ padding: '10px 10px', borderRadius: 10, border: c.sel ? `2px solid var(--5s-blue)` : '1px solid var(--5s-border)', background: c.sel ? 'var(--5s-blue-50)' : '#fff', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: c.sel ? 'var(--5s-blue)' : 'var(--5s-text)' }}>{c.d}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--5s-text-muted)', fontWeight: 700 }}>{c.p}₫</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input label={t('Họ và tên', 'Full name')} value="Nguyễn Văn Phúc" />
          <Input label="BIB size" value="M · Unisex" />
        </div>
        <div style={{ padding: '10px 12px', border: `1.5px dashed ${accent}`, borderRadius: 10, background: 'rgba(255,14,101,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: accent, color: '#fff', padding: '4px 10px', borderRadius: 9999, fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 10, letterSpacing: '.14em' }}>EARLYBIRD</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--5s-text)', fontWeight: 600 }}>{t('Giảm 80k — còn 8 ngày', 'Save 80k — 8 days left')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--5s-blue-700)', color: '#fff', borderRadius: 10, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', justifyContent: 'center' }}>
          {t('Thanh toán 610k₫', 'Pay 610k₫')} <IArr s={14} />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', paddingTop: 4 }}>
          {['VNPay', 'Momo', 'Zalo', 'Visa'].map((p, i) => (
            <span key={i} style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, letterSpacing: '.08em', color: 'var(--5s-text-subtle)', padding: '3px 8px', border: '1px solid var(--5s-border)', borderRadius: 6 }}>{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BibMock({ lang, accent }: Ctx) {
  const t = useT(lang);
  const waves = [
    { w: 'A', c: '42K · Elite', t: '05:00', n: 48, col: '#DC2626' },
    { w: 'B', c: '42K · Sub-3:30', t: '05:05', n: 312, col: 'var(--5s-blue)' },
    { w: 'C', c: '42K · Sub-4:00', t: '05:10', n: 892, col: '#0E7490' },
    { w: 'D', c: '42K · Open', t: '05:15', n: 1284, col: '#6B7280' },
  ];
  return (
    <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 14, border: '1px solid var(--5s-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--5s-blue-700)', color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em', flex: 1 }}>Wave Assignment · 42K</div>
        <Pill bg="rgba(255,255,255,0.22)" color="#fff">2,536 {t('VĐV', 'runners')}</Pill>
      </div>
      <div style={{ padding: 18 }}>
        {waves.map((w, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: i < waves.length - 1 ? '1px solid var(--5s-border)' : 'none' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: w.col, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22 }}>{w.w}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14 }}>{w.c}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--5s-text-subtle)', fontWeight: 700 }}>BIB 1{i}01 – 1{i}{w.n.toString().padStart(3, '0')}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--5s-text)' }}>{w.t}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: w.col, minWidth: 40, textAlign: 'right' }}>{w.n}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 18px', background: 'var(--5s-slate-50)', borderTop: '1px solid var(--5s-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--5s-blue)' }}><IZap s={14} /></span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--5s-text-muted)', fontWeight: 600, flex: 1 }}>{t('Auto-assign hoàn tất trong 3.2 giây', 'Auto-assign finished in 3.2 seconds')}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 11, letterSpacing: '.12em', color: accent, textTransform: 'uppercase' }}>{t('Xuất PDF', 'Export PDF')}</span>
      </div>
    </div>
  );
}

function CheckinMock({ lang, accent }: Ctx) {
  const t = useT(lang);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <div style={{ width: 240, height: 430, borderRadius: 28, background: '#0a1126', padding: 10, boxShadow: '0 30px 60px rgba(0,0,0,0.4)', border: '6px solid #111' }}>
        <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--5s-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <LiveDot color="var(--5s-success)" />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--5s-success)' }}>{t('Đã check-in', 'Checked in')}</span>
          </div>
          <div style={{ padding: 18, textAlign: 'center' }}>
            <div style={{ width: 120, height: 120, margin: '8px auto 14px', background: '#fff', border: '2px solid var(--5s-text)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <IQr s={80} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 20, color: accent }}>A0142</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, marginTop: 4 }}>Nguyễn V. Phúc</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--5s-text-subtle)', fontWeight: 600, marginTop: 2 }}>42K · Wave B · Size M</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ margin: '0 14px 14px', padding: '12px', background: 'var(--5s-blue-700)', color: '#fff', borderRadius: 12, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 12, textAlign: 'center', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            {t('Đã giao kit ✓', 'Kit delivered ✓')}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        {[
          { l: t('Đã check-in', 'Checked in'), v: '3,812', c: 'var(--5s-success)' },
          { l: t('Còn lại', 'Remaining'), v: '1,188', c: accent },
          { l: t('Tốc độ', 'Rate'), v: '420/h', c: 'var(--5s-blue)' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid var(--5s-border)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)' }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, color: s.c, letterSpacing: '-0.02em' }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommsMock({ lang, accent }: Ctx) {
  const t = useT(lang);
  const msgs = [
    { p: 'Zalo', c: '#0068FF', ch: 'ZA', sub: t('Nhắc lịch nhận BIB', 'BIB pickup reminder'), open: '82%' },
    { p: 'Email', c: '#EA580C', ch: 'EM', sub: t('Xác nhận thanh toán', 'Payment confirmation'), open: '68%' },
    { p: 'SMS', c: '#16a34a', ch: 'SM', sub: t('Ngày mai 5:00 xuất phát', 'Tomorrow 5:00 start'), open: '94%' },
  ];
  return (
    <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 14, border: '1px solid var(--5s-border)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, flex: 1 }}>Campaign · {t('Ngày race -1', 'Race day -1')}</div>
        <Pill bg="var(--5s-success-bg)" color="var(--5s-success)">{t('Đã gửi 14,436', 'Sent 14,436')}</Pill>
      </div>
      {msgs.map((m, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', padding: '14px 0', borderBottom: i < msgs.length - 1 ? '1px solid var(--5s-border)' : 'none' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: m.c, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13 }}>{m.ch}</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{m.p}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--5s-text-muted)', fontWeight: 500 }}>{m.sub}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: accent, letterSpacing: '-0.02em' }}>{m.open}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--5s-text-subtle)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{t('mở', 'open')}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--5s-blue-50)', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--5s-blue-700)' }}>
        {t('💬 1,284 VĐV phản hồi ngay trong Zalo OA', '💬 1,284 runners replied directly in Zalo OA')}
      </div>
    </div>
  );
}

function AthleteDashMock({ lang, accent }: Ctx) {
  const t = useT(lang);
  return (
    <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 14, border: '1px solid var(--5s-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
      <div style={{ background: `linear-gradient(120deg, var(--5s-blue-700), ${accent})`, color: '#fff', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 9999, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18 }}>NP</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16 }}>Nguyễn V. Phúc</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8, fontWeight: 600 }}>5BIB ID · 94821 · 12 races</div>
          </div>
          <IUsers s={18} />
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)', marginBottom: 8 }}>{t('Giải sắp tới', 'Upcoming races')}</div>
        {[
          { r: 'VTV–LPBank Marathon', d: '42K · Wave B', dt: '21 Mar 2026', bib: 'A0142' },
          { r: 'UTCB 70K', d: '70K · Wave A', dt: '12 Apr 2026', bib: 'T0089' },
        ].map((r, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: i < 1 ? '1px solid var(--5s-border)' : 'none', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13 }}>{r.r}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--5s-text-subtle)', fontWeight: 600 }}>{r.d} · {r.dt}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 900, color: accent }}>{r.bib}</div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 900, letterSpacing: '.1em', color: 'var(--5s-blue)', textTransform: 'uppercase' }}>{t('Chi tiết', 'View')}</span>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 }}>
          {[
            { l: t('Đổi cự ly', 'Swap'), i: <IZap s={14} /> },
            { l: t('Tải BIB', 'BIB A5'), i: <IQr s={14} /> },
            { l: t('Lịch race', 'Schedule'), i: <ICal s={14} /> },
          ].map((b, i) => (
            <div key={i} style={{ padding: '10px 8px', border: '1px solid var(--5s-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--5s-blue)' }}>
              {b.i}
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10.5, color: 'var(--5s-text)', letterSpacing: '.05em' }}>{b.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BtcDashMock({ lang, accent }: Ctx) {
  const t = useT(lang);
  const days = [22, 38, 45, 52, 68, 75, 88, 72, 94];
  const max = Math.max(...days);
  return (
    <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 14, border: '1px solid var(--5s-border)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, flex: 1 }}>VTV–LPBank Marathon · {t('Doanh thu', 'Revenue')}</div>
        <Pill bg="var(--5s-blue-50)" color="var(--5s-blue)">{t('9 ngày đầu', 'first 9 days')}</Pill>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { l: t('Doanh thu', 'Revenue'), v: '2.94B', c: 'var(--5s-blue)' },
          { l: t('Số đơn', 'Orders'), v: '4,812', c: 'var(--5s-text)' },
          { l: 'Conv rate', v: '18.2%', c: accent },
        ].map((s, i) => (
          <div key={i}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)', fontWeight: 800 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: s.c, letterSpacing: '-0.02em' }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, borderBottom: '1px solid var(--5s-border)', paddingBottom: 6 }}>
        {days.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--5s-text-subtle)' }}>{d}0M</div>
            <div style={{ width: '100%', height: `${(d / max) * 100}%`, background: i === days.length - 1 ? accent : 'var(--5s-blue)', borderRadius: '6px 6px 0 0', opacity: i === days.length - 1 ? 1 : 0.85 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--5s-text-subtle)', fontWeight: 700 }}>
        {['D-1', 'D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-9'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--5s-success-bg)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--5s-success)' }}><IChart s={16} /></span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--5s-success)', flex: 1 }}>{t('Vượt target 18% — dự kiến sold-out trong 3 ngày', 'Exceeded target by 18% — projected sold-out in 3 days')}</span>
      </div>
    </div>
  );
}

export default function SolutionFeatureTabs({ lang, accent = '#FF0E65' }: { lang: Lang; accent?: string }) {
  const t = useT(lang);
  const [tab, setTab] = React.useState(0);

  const tabs = [
    { id: 'form', icon: <IPalette s={14} />, label: t('Form đăng ký', 'Registration form') },
    { id: 'bib', icon: <ITicket s={14} />, label: t('BIB & Wave', 'BIB & wave') },
    { id: 'checkin', icon: <IQr s={14} />, label: t('Check-in QR', 'QR check-in') },
    { id: 'comms', icon: <IShare s={14} />, label: t('Email / SMS / Zalo', 'Email / SMS / Zalo') },
    { id: 'athlete', icon: <IUsers s={14} />, label: t('Athlete Dashboard', 'Athlete dashboard') },
    { id: 'btc', icon: <IChart s={14} />, label: t('BTC Dashboard', 'Organizer dashboard') },
  ];

  const ctx: Ctx = { lang, accent };

  const panels: Array<{ title: string; sub: string; bullets: string[]; right: React.ReactNode }> = [
    {
      title: t('form đăng ký chuyên nghiệp, 15 phút.', 'a pro registration form in 15 minutes.'),
      sub: t('Drag-drop builder — field tuỳ biến, early bird, coupon, team/group, upsell áo + medal. Thanh toán VNPay, Momo, ZaloPay, thẻ quốc tế.', 'Drag-drop builder — custom fields, early bird, coupons, team/group, upsell apparel and medals. Payments via VNPay, Momo, ZaloPay, international cards.'),
      bullets: [
        t('Early bird + tier pricing — tự động đổi giá theo ngày', 'Early bird + tier pricing — auto switch by date'),
        t('Coupon code, team discount, upsell áo + medal', 'Coupon codes, team discounts, apparel & medal upsells'),
        t('Thanh toán trong form, không redirect — tăng conversion 2.3x', 'In-form payments, no redirect — 2.3× conversion uplift'),
      ],
      right: <FormMock {...ctx} />,
    },
    {
      title: t('gán bib & chia wave. 1 click.', 'assign BIBs & split waves. one click.'),
      sub: t('Import VĐV → 5BIB tự động gán BIB theo cự ly, chia wave theo pace dự kiến, xuất start list PDF in ấn. Đổi BIB, đổi cự ly trước ngày giải 1 lần bấm.', 'Import athletes → 5BIB auto-assigns BIBs by distance, splits waves by predicted pace, exports a print-ready start-list PDF. Swap BIBs or distances before race day in one click.'),
      bullets: [
        t('Auto BIB numbering theo range cự ly (5K = 1000–, 10K = 2000–…)', 'Auto BIB numbering by distance range (5K = 1000–, 10K = 2000–…)'),
        t('Chia wave theo pace dự kiến, giới tính, độ tuổi, đồng đội', 'Wave splits by predicted pace, gender, age, team'),
        t('VĐV tự đổi cự ly trên Athlete Dashboard — BIB cập nhật tự động', 'Athletes swap distance on their dashboard — BIB updates automatically'),
      ],
      right: <BibMock {...ctx} />,
    },
    {
      title: t('check-in & kit pickup bằng qr. 3 giây / vđv.', 'QR check-in & kit pickup. 3 seconds per runner.'),
      sub: t('App scan BIB QR → xác thực VĐV → đánh dấu đã nhận kit → đồng bộ lên dashboard. Offline-first: mất mạng vẫn scan được.', 'Scan BIB QR → verify athlete → mark kit received → sync to dashboard. Offline-first: keeps working when the network drops.'),
      bullets: [
        t('App iOS/Android cho tình nguyện viên — không cần hardware', 'iOS/Android app for volunteers — no extra hardware'),
        t('Offline-first — scan xong đồng bộ khi có mạng', 'Offline-first — syncs when the network returns'),
        t('Dashboard realtime: bao nhiêu VĐV đã nhận kit, còn lại bao nhiêu', 'Realtime dashboard: kits picked up vs. remaining'),
      ],
      right: <CheckinMock {...ctx} />,
    },
    {
      title: t('email / sms / zalo. gửi 10,000 vđv trong 30 giây.', 'email / sms / zalo. blast 10,000 runners in 30 seconds.'),
      sub: t('Template có sẵn cho xác nhận đơn, nhắc lịch, thay đổi thời tiết, bib pickup, cảm ơn sau giải. Phân khúc theo cự ly, wave, thành phố.', 'Ready-made templates for order confirmation, schedule reminders, weather updates, bib pickup, post-race thanks. Segment by distance, wave, city.'),
      bullets: [
        t('Zalo OA gửi trực tiếp — open rate 80% (vs email 22%)', 'Zalo OA delivery — 80% open rate (vs. email 22%)'),
        t('SMS brandname "5BIB" cho nhắc lịch ngày race', 'SMS brandname "5BIB" for race-day reminders'),
        t('Personalize theo tên VĐV, BIB, wave, cự ly', 'Personalize by athlete name, BIB, wave, distance'),
      ],
      right: <CommsMock {...ctx} />,
    },
    {
      title: t('mỗi vđv có dashboard riêng.', 'every athlete gets their own dashboard.'),
      sub: t('VĐV xem đơn, đổi cự ly, cập nhật size áo, tải BIB/certificate, xem wave, xem checkpoint. Giảm 80% tin nhắn "chị ơi BIB em đâu?"', 'Athletes view orders, change distance, update shirt size, download BIB/certificate, see wave and checkpoints. 80% fewer "where\'s my BIB?" messages.'),
      bullets: [
        t('Đổi cự ly, đổi size áo — VĐV tự xử, không cần email BTC', 'Change distance, swap shirt size — self-service, no BTC email'),
        t('Tải BIB A5, certificate, lịch race cá nhân', 'Download BIB A5, certificate, personal race schedule'),
        t('Một tài khoản dùng cho mọi giải trên network 5BIB', 'One account, every race on the 5BIB network'),
      ],
      right: <AthleteDashMock {...ctx} />,
    },
    {
      title: t('btc dashboard — doanh thu, conversion, funnel.', 'organizer dashboard — revenue, conversion, funnel.'),
      sub: t('Theo dõi doanh thu realtime, conversion rate landing → ticket, funnel bỏ dở giữa chừng, phân tích theo cự ly / kênh / ngày. Export PDF báo cáo nhà tài trợ.', 'Track realtime revenue, landing → ticket conversion, drop-off funnel, breakdowns by distance / channel / day. Export sponsor-ready PDF reports.'),
      bullets: [
        t('Realtime revenue, order count, avg order value', 'Realtime revenue, order count, average order value'),
        t('Funnel landing → cart → payment → confirmed', 'Funnel landing → cart → payment → confirmed'),
        t('Export PDF tiếng Việt cho nhà tài trợ', 'Vietnamese PDF export for sponsors'),
      ],
      right: <BtcDashMock {...ctx} />,
    },
  ];

  const p = panels[tab]!;

  return (
    <section id="features" style={{ background: 'var(--5s-surface)', borderTop: '1px solid var(--5s-border)', borderBottom: '1px solid var(--5s-border)', padding: '80px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <div className="solution-cta-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, marginBottom: 40, alignItems: 'end' }}>
          <div>
            <div className="type-eyebrow" style={{ color: accent }}>{t('6 tính năng cốt lõi', '6 core features')}</div>
            <h2 className="type-campaign" style={{ fontSize: 'clamp(40px, 5vw, 72px)', color: 'var(--5s-text)', margin: '10px 0 0' }}>
              {t('mọi bước, trên một nền tảng.', 'every step, on one platform.')}<br />
              <span style={{ color: 'var(--5s-blue)' }}>{t('không cần tích hợp thêm.', 'no extra integrations.')}</span>
            </h2>
          </div>
          <p className="type-lead" style={{ margin: 0 }}>
            {t('Từ lúc BTC bấm "mở bán", đến VĐV nhận BIB, qua check-in, lên vạch xuất phát — 5BIB vận hành toàn bộ flow.', 'From the moment an organizer hits "go live," to the athlete receiving a BIB, through check-in, to the start line — 5BIB runs the entire flow.')}
          </p>
        </div>

        <div className="solution-tab-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28, padding: 6, background: '#fff', borderRadius: 14, border: '1px solid var(--5s-border)', boxShadow: 'var(--shadow-xs)' }}>
          {tabs.map((tb, i) => (
            <button key={tb.id} onClick={() => setTab(i)} className="solution-tab-btn" style={{ flex: '1 1 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', background: tab === i ? 'var(--5s-blue)' : 'transparent', color: tab === i ? '#fff' : 'var(--5s-text-muted)', border: 'none', borderRadius: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12.5, letterSpacing: '-0.01em', cursor: 'pointer', transition: 'all 200ms', textTransform: 'uppercase' }}>
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid var(--5s-border)', boxShadow: 'var(--shadow-sm)', minHeight: 540, overflow: 'hidden' }}>
          <TabShell accent={accent} title={p.title} sub={p.sub} bullets={p.bullets} right={p.right} />
        </div>
      </div>
    </section>
  );
}
