'use client';

import * as React from 'react';
import { ICheck, IX, IPalette, IZap, IShare, useT, type Lang } from './solution-icons';

export function SolutionSocialProof({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const clients = [
    { n: 'ZAHA', s: 'Zaha Legacy Marathon' },
    { n: 'VTV–LPB', s: 'VTV–LPBank Marathon' },
    { n: 'Racejungle', s: t('Hệ thống sự kiện', 'Event series') },
    { n: '5Sport', s: t('Giải chạy phong trào', 'Community races') },
    { n: 'Thành An Media', s: t('Bán vé & check-in', 'Ticketing & check-in') },
    { n: 'MCC', s: 'MuCangChai Ultra Trail' },
  ];
  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 32px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div className="type-eyebrow" style={{ color: 'var(--5s-magenta)' }}>
          {t('Được tin dùng bởi', 'Trusted by')}
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em', margin: '8px 0 0', color: 'var(--5s-text)' }}>
          {t("BTC hàng đầu Việt Nam mở bán vé trên 5BIB", "Vietnam's leading organizers sell tickets on 5BIB")}
        </h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 0, borderTop: '1px solid var(--5s-border)', borderBottom: '1px solid var(--5s-border)' }}>
        {clients.map((c, i) => (
          <div key={i} style={{ padding: '22px 18px', borderRight: i < clients.length - 1 ? '1px solid var(--5s-border)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--5s-blue)' }}>{c.n}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--5s-text-muted)', fontWeight: 600 }}>{c.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SolutionPainSolution({ lang, accent = '#FF0E65' }: { lang: Lang; accent?: string }) {
  const t = useT(lang);
  const rows = [
    {
      icon: <IPalette s={20} />,
      pain: t('Google Form + Excel + chuyển khoản thủ công — mất 2 tuần để đối soát 3,000 đơn.', 'Google Form + Excel + manual bank transfers — two weeks to reconcile 3,000 orders.'),
      sol: t('Form builder + thanh toán tích hợp (VNPay, Momo, ZaloPay, thẻ quốc tế). Đối soát tự động, báo cáo theo ngày.', 'Form builder + built-in payments (VNPay, Momo, ZaloPay, international cards). Auto reconciliation, daily reports.'),
      k: t('Thay Google Form', 'Replaces Google Form'),
    },
    {
      icon: <IZap s={20} />,
      pain: t('Các nền tảng đăng ký online đóng thu phí cao, không tuỳ biến được form, không cho export data, không có athlete dashboard.', "Closed online registration platforms charge steep fees, don't let you customize the form, block data export, and offer no athlete dashboard."),
      sol: t('Chi phí minh bạch theo giao dịch. Custom domain, white-label, export CSV mọi lúc. VĐV có dashboard riêng.', 'Transparent per-transaction pricing. Custom domain, white-label, CSV export anytime. Athletes get their own dashboard.'),
      k: t('Thay platform đóng', 'Replaces closed platforms'),
    },
    {
      icon: <IShare s={20} />,
      pain: t('Tự build: 6 tháng dev, 150 triệu, phải maintain mỗi năm — chưa kể bug ngày mở bán.', 'In-house build: 6 months of dev, 150M₫, ongoing maintenance — plus launch-day bugs.'),
      sol: t('Setup trong 72h. Team 5BIB vận hành. Slot mùa giải Q1/2026 đang mở — đăng ký giữ slot ngay.', 'Setup in 72h. The 5BIB team runs ops. Q1/2026 season slots are open — reserve yours now.'),
      k: t('Thay tự build', 'Replaces in-house build'),
    },
  ];
  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 32px 20px' }} id="product">
      <div style={{ marginBottom: 50, maxWidth: 820 }}>
        <div className="type-eyebrow" style={{ color: 'var(--5s-magenta)' }}>{t('Vấn đề & giải pháp', 'The problem & the fix')}</div>
        <h2 className="type-campaign" style={{ fontSize: 'clamp(36px, 4.4vw, 64px)', color: 'var(--5s-text)', margin: '10px 0 0' }}>
          {t('3 cách BTC đang làm hiện tại.', 'three ways organizers do it today.')}<br />
          <span style={{ color: 'var(--5s-blue)' }}>{t('cả 3 đều đau.', 'all three hurt.')}</span>
        </h2>
        <p className="type-lead" style={{ marginTop: 18 }}>
          {t('BTC Việt Nam đang mất 2 tuần đối soát, 150 triệu build tool, hoặc chịu phí cao từ platform đóng. 5BIB làm cả ba việc đó trong một hệ thống — và rẻ hơn.', 'Vietnamese organizers lose two weeks on reconciliation, 150M₫ on in-house tools, or pay steep fees to closed platforms. 5BIB does all three in one system — for less.')}
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid var(--5s-border)', borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden', transition: 'all 280ms' }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = 'var(--shadow-lg)'; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--5s-blue-50)', color: 'var(--5s-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.icon}</div>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: accent, background: 'rgba(255,14,101,0.08)', padding: '4px 10px', borderRadius: 9999 }}>{r.k}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', marginBottom: 10 }}>
              <span style={{ marginTop: 2, color: '#DC2626', flexShrink: 0 }}><IX s={14} /></span>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13.5, lineHeight: 1.45, color: 'var(--5s-text)' }}>{r.pain}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--5s-blue-50)' }}>
              <span style={{ marginTop: 2, color: 'var(--5s-blue)', flexShrink: 0 }}><ICheck s={14} /></span>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, lineHeight: 1.5, color: 'var(--5s-text)' }}>{r.sol}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
