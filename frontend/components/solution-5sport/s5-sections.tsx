'use client';

import * as React from 'react';
import {
  Lang,
  useT,
  Section,
  ICheck,
  IArr,
  ITicket,
  IUsers,
  ITrophy,
  IStar,
  IPin,
  IQr,
  IBolt,
  IShield,
  ICamera,
  IMoney,
  IChart,
  CountUpStat,
} from './s5-shared';

const sectionEyebrowStyle: React.CSSProperties = {
  color: 'var(--s5-blue)',
  marginBottom: 14,
  display: 'inline-block',
};

/* ═════════ Trust Bar ═════════ */
export function S5TrustBar({ lang }: { lang: Lang }) {
  const t = useT(lang);
  return (
    <section
      style={{
        background: 'var(--s5-lime)',
        color: 'var(--s5-navy)',
        padding: '28px 24px',
        borderTop: '1px solid rgba(10,13,46,0.08)',
        borderBottom: '1px solid rgba(10,13,46,0.08)',
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 36,
          alignItems: 'center',
        }}
        className="s5-2col"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase' }}>
            {t('Đối tác', 'Partners')}:
          </span>
          {['LPBank', 'VPBank', 'VNPAY', 'VTV', 'Thành An'].map((n) => (
            <span
              key={n}
              style={{
                fontFamily: 'var(--font-display-5s)',
                fontWeight: 900,
                fontSize: 16,
                letterSpacing: '-0.01em',
                opacity: 0.85,
              }}
            >
              {n}
            </span>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 22,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            fontFamily: 'var(--font-mono-5s)',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <span><CountUpStat value="195" />+ {t('giải', 'events')}</span>
          <span>·</span>
          <span><CountUpStat value="94" />K+ {t('VĐV', 'athletes')}</span>
          <span>·</span>
          <span><CountUpStat value="42" />K+ {t('đơn vé', 'orders')}</span>
          <span>·</span>
          <span><CountUpStat value="6" /> {t('năm', 'years')}</span>
        </div>
      </div>
    </section>
  );
}

/* ═════════ Pain Points ═════════ */
export function S5Pain({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const cards = [
    {
      e: '📋',
      vi: 'Vận hành rời rạc',
      en: 'Scattered tools',
      dvi: 'Bán vé một nơi, đăng ký một nơi, kết quả một nơi. Không có gì kết nối với nhau.',
      den: 'Ticket sales here, registration there, results somewhere else — nothing is connected.',
    },
    {
      e: '👥',
      vi: 'Check-in ngốn nhân lực',
      en: 'Exhausting check-in',
      dvi: 'Hàng chục tình nguyện viên, xếp hàng 45 phút, VĐV bực bội trước khi bước ra sân.',
      den: 'Dozens of volunteers, 45-minute queues, athletes already frustrated before they play.',
    },
    {
      e: '📵',
      vi: 'VĐV không có di sản',
      en: 'No lasting legacy',
      dvi: 'Đánh xong, về. Không có hồ sơ thành tích, không có ảnh, không có thứ hạng.',
      den: 'Game over, go home — no profile, no photos, no ranking. As if it never happened.',
    },
  ];

  return (
    <Section id="pain">
      <div style={{ maxWidth: 820, marginBottom: 56 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>
          {t('Vấn đề thị trường', 'Market problem')}
        </span>
        <h2 className="type-h1" style={{ marginBottom: 20 }}>
          {t('Bạn vẫn đang tổ chức giải', 'Still running your tournament')}
          <br />
          <span style={{ color: 'var(--s5-magenta)' }}>
            {t('bằng Excel và Zalo?', 'on Excel and chat apps?')}
          </span>
        </h2>
        <p className="type-lead">
          {t(
            'Hàng triệu người chơi cầu lông và pickleball ở Việt Nam — nhưng mỗi giải đấu vẫn là một mớ hỗn độn: đăng ký Google Form, chuyển khoản thủ công, xếp bảng bằng tay, check-in bằng giấy A4.',
            'Millions of badminton and pickleball players in Vietnam — yet every tournament is still a mess: Google Form signups, manual bank transfers, hand-drawn brackets, paper check-ins.',
          )}
        </p>
      </div>

      <div className="s5-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {cards.map((c) => (
          <div key={c.vi} className="s5-card">
            <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 14 }}>{c.e}</div>
            <h3 className="type-h3" style={{ marginBottom: 10 }}>{t(c.vi, c.en)}</h3>
            <p className="type-body" style={{ color: 'var(--s5-text-muted)' }}>
              {t(c.dvi, c.den)}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 56,
          textAlign: 'center',
          fontFamily: 'var(--font-display-5s)',
          fontWeight: 900,
          fontSize: 22,
          letterSpacing: '-0.02em',
        }}
      >
        {t('5Sport ra đời để thay đổi điều đó.', '5Sport is here to change that.')}
      </div>
    </Section>
  );
}

/* ═════════ Solution Overview ═════════ */
export function S5Pillars({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const pillars = [
    {
      icon: <ITicket s={28} />,
      tag: t('Sàn vé', 'Marketplace'),
      vi: 'Bán vé — Bán slot thi đấu',
      en: 'Sell tickets & tournament slots',
      dvi: 'Trang đăng ký chuyên nghiệp, vé khán giả + vé thi đấu trên cùng 1 nơi. VNPAY, Momo, QR Pay — VĐV đăng ký trong 60 giây.',
      den: 'Pro registration pages for both spectator and player tickets. VNPAY, Momo, QR Pay — signup in 60 seconds.',
      link: '#features',
    },
    {
      icon: <IUsers s={28} />,
      tag: t('Cộng đồng', 'Community'),
      vi: 'Tìm bạn chơi. Tìm sân. Xây CLB.',
      en: 'Find players, courts, clubs.',
      dvi: 'Ghép đôi theo trình độ (5Sport Rating), bản đồ sân toàn quốc, quản lý CLB phong trào. Thể thao không cần cô đơn.',
      den: 'Skill-based match-ups (5Sport Rating), nationwide court map, club management. Sport is better together.',
      link: '#community',
    },
    {
      icon: <ITrophy s={28} />,
      tag: t('Vận hành Giải', 'Tournament Pro'),
      vi: 'Tổ chức giải chuyên nghiệp.',
      en: 'Pro-grade tournament ops.',
      dvi: 'Wizard tạo giải, bốc thăm tự động, live scoring, báo cáo sau giải — BTC chỉ cần giám sát, không cần chạy.',
      den: 'Event wizard, auto-draw, live scoring, post-event reports — organizers oversee, they don\u2019t run around.',
      link: '#tournament',
    },
  ];

  return (
    <Section id="features" style={{ background: 'var(--s5-surface)' }}>
      <div style={{ maxWidth: 820, marginBottom: 56 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>
          {t('Giải pháp', 'Solution')}
        </span>
        <h2 className="type-h1" style={{ marginBottom: 16 }}>
          {t('1 nền tảng. 3 giải pháp.', 'One platform. Three solutions.')}
          <br />
          <span style={{ color: 'var(--s5-blue)' }}>{t('Từ A đến Z.', 'End to end.')}</span>
        </h2>
      </div>

      <div className="s5-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {pillars.map((p) => (
          <a
            key={p.vi}
            href={p.link}
            className="s5-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'var(--s5-blue)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--s5-glow-blue)',
              }}
            >
              {p.icon}
            </div>
            <span className="type-eyebrow" style={{ color: 'var(--s5-text-muted)' }}>{p.tag}</span>
            <h3 className="type-h3">{t(p.vi, p.en)}</h3>
            <p className="type-body" style={{ color: 'var(--s5-text-muted)', flex: 1 }}>
              {t(p.dvi, p.den)}
            </p>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--s5-blue)',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {t('Xem thêm', 'Learn more')} <IArr s={14} />
            </span>
          </a>
        ))}
      </div>
    </Section>
  );
}

/* ═════════ Deep Dive: Marketplace ═════════ */
export function S5Marketplace({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const leftCol = [
    ['Sơ đồ ghế ngồi tương tác', 'Interactive seat map'],
    ['Vé ngày / vé cả giải / VIP', 'Day pass · event pass · VIP'],
    ['E-ticket + QR Check-in', 'E-ticket with QR check-in'],
    ['Chuyển nhượng vé linh hoạt', 'Flexible ticket transfer'],
    ['Watch Party (nhóm 10+)', 'Watch Party (10+)'],
    ['Season Pass — mua 1 lần, xem cả mùa', 'Season Pass'],
  ];
  const rightCol = [
    ['Đăng ký cá nhân + đôi', 'Singles & doubles entry'],
    ['Phân hạng tự động theo 5Sport Rating', 'Auto-seeding by 5Sport Rating'],
    ['Early Bird, countdown, waitlist', 'Early Bird, countdown, waitlist'],
    ['Đăng ký đồng đội (CLB) 1 lần', 'Team/club bulk entry'],
    ['Package: vé + thuê sân tập', 'Packages: ticket + court rental'],
    ['Thay đổi thông tin self-service', 'Self-service edits'],
  ];

  return (
    <Section id="marketplace">
      <div style={{ maxWidth: 820, marginBottom: 40 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>🎫 {t('Sàn vé & Đăng ký', 'Ticketing & Registration')}</span>
        <h2 className="type-h2" style={{ marginBottom: 16 }}>
          {t('Vé khán giả. Vé thi đấu.', 'Spectator tickets. Player tickets.')}
          <br />
          <span style={{ color: 'var(--s5-blue)' }}>{t('Cùng 1 link.', 'Single link.')}</span>
        </h2>
        <p className="type-lead">
          {t(
            'Eventbrite cho vé xem, Google Form cho VĐV, chuyển khoản riêng — 5Sport hợp nhất tất cả: một trang giải, một luồng thanh toán, một dashboard.',
            'Spectator tickets, player signups, and payments — all unified under one race page, one payment flow, one dashboard.',
          )}
        </p>
      </div>

      <div
        className="s5-2col"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
      >
        {[
          { title: '🎟 ' + t('Vé Khán Giả', 'Spectator tickets'), items: leftCol },
          { title: '🏸 ' + t('Vé Thi Đấu (VĐV)', 'Player tickets'), items: rightCol },
        ].map((col) => (
          <div key={col.title} className="s5-card">
            <h3 className="type-h3" style={{ marginBottom: 18 }}>{col.title}</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {col.items.map(([vi, en]) => (
                <li key={vi} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--s5-blue)', marginTop: 2 }}>
                    <ICheck s={16} sw={2.5} />
                  </span>
                  <span className="type-body">{t(vi, en)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ═════════ Deep Dive: Community ═════════ */
export function S5Community({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const features = [
    {
      icon: <IStar s={24} />,
      vi: '5Sport Rating',
      en: '5Sport Rating',
      dvi: 'Hệ thống rating đầu tiên cho cầu lông và pickleball phong trào VN. Cập nhật sau mỗi trận — giải, giao hữu, CLB cuối tuần.',
      den: 'First community rating system in VN for badminton & pickleball. Updated after every match.',
      badge: t('Sắp ra mắt', 'Coming soon'),
    },
    {
      icon: <IPin s={24} />,
      vi: 'Bản đồ Sân',
      en: 'Court Finder',
      dvi: 'Tất cả sân trên toàn quốc. Filter: indoor/outdoor, giá, rating, khoảng cách. Đặt sân trực tiếp nếu sân là đối tác.',
      den: 'Nationwide map. Filter by indoor/outdoor, price, rating, distance. Book partnered courts directly.',
    },
    {
      icon: <IUsers s={24} />,
      vi: 'Tìm Bạn Chơi & CLB',
      en: 'Match & club finder',
      dvi: 'Xem profile → ghép đôi theo skill → hẹn sân. Hoặc join CLB trong khu vực, thách đấu CLB khác.',
      den: 'Profiles → skill-matched partners → book a court. Or join local clubs and challenge others.',
    },
  ];
  return (
    <Section id="community" style={{ background: 'var(--s5-surface)' }}>
      <div style={{ maxWidth: 820, marginBottom: 40 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>
          👥 {t('Kết nối Cộng đồng', 'Community')}
        </span>
        <h2 className="type-h2" style={{ marginBottom: 16 }}>
          {t('Tìm người chơi cùng trình độ.', 'Find players at your level.')}
          <br />
          <span style={{ color: 'var(--s5-blue)' }}>{t('Cách nhà bạn 2km.', '2km from home.')}</span>
        </h2>
        <p className="type-lead">
          {t(
            '5Sport biết bạn đang ở đâu, biết rating của bạn, và gợi ý đúng người — đúng trình, đúng giờ, đúng sân.',
            '5Sport knows where you are and what you play — and matches you with the right partner, time, and court.',
          )}
        </p>
      </div>

      <div className="s5-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {features.map((f) => (
          <div key={f.vi} className="s5-card">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(20,0,255,0.08)',
                color: 'var(--s5-blue)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              {f.icon}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <h3 className="type-h3">{t(f.vi, f.en)}</h3>
              {f.badge && (
                <span
                  style={{
                    background: 'var(--s5-lime)',
                    color: 'var(--s5-navy)',
                    fontSize: 10,
                    fontWeight: 900,
                    padding: '3px 8px',
                    borderRadius: 6,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  {f.badge}
                </span>
              )}
            </div>
            <p className="type-body" style={{ color: 'var(--s5-text-muted)' }}>
              {t(f.dvi, f.den)}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ═════════ Deep Dive: Tournament ═════════ */
export function S5Tournament({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const steps = [
    ['Tạo giải (10 phút)', 'Create event (10 min)', 'Wizard: tên, hạng mục, format, sân, lịch, publish.', 'Wizard: name, divisions, format, courts, schedule, publish.'],
    ['Mở đăng ký', 'Open registration', 'Link chia sẻ, thanh toán tự động, xác nhận email.', 'Shareable link, auto payments, email confirmations.'],
    ['Bốc thăm & chia bảng', 'Auto draw & seeding', 'Tự động theo 5Sport Rating, tránh cùng CLB gặp sớm.', 'Auto by 5Sport Rating, avoids same-club early clashes.'],
    ['Race Day', 'Race day', 'QR check-in, trọng tài nhập score real-time, bracket cập nhật.', 'QR check-in, real-time scoring, live bracket.'],
    ['Kết quả & Báo cáo', 'Results & reports', 'Kết quả live, ảnh 5Pix, báo cáo sponsor.', 'Live results, 5Pix photos, sponsor reports.'],
  ];

  const blocks = [
    { icon: <IBolt s={22} />, vi: 'Phần mềm Quản lý Giải', en: 'Tournament software', dvi: 'Bracket tự động: Round Robin, Knockout, Swiss, King of Court. Court Assignment Engine tối ưu thời gian chờ.', den: 'Auto brackets: RR, Knockout, Swiss, King of Court. Court Assignment Engine minimizes waits.' },
    { icon: <IShield s={22} />, vi: 'Trọng tài & VAR Phong trào', en: 'Referees & community VAR', dvi: 'Trọng tài có bằng cấp + công nghệ xem lại tình huống tranh chấp. Không còn "tao không thấy".', den: 'Certified referees + review tech for disputed calls. No more "I didn\u2019t see it".' },
    { icon: <IStar s={22} />, vi: 'Vận hành Toàn diện', en: 'Full-stack operations', dvi: 'Concept, in ấn, cúp, huy chương, sân khấu, âm thanh, y tế — trọn gói hoặc từng phần.', den: 'Concept, print, trophies, stage, sound, medical — full package or à la carte.' },
  ];

  return (
    <Section id="tournament">
      <div style={{ maxWidth: 820, marginBottom: 40 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>
          🏆 {t('Tournament Pro', 'Tournament Pro')}
        </span>
        <h2 className="type-h2" style={{ marginBottom: 16 }}>
          {t('Tổ chức giải trong 10 phút.', 'Launch a tournament in 10 minutes.')}
          <br />
          <span style={{ color: 'var(--s5-blue)' }}>{t('Vận hành như chuyên nghiệp.', 'Run it like the pros.')}</span>
        </h2>
      </div>

      {/* 5-step flow */}
      <div
        className="s5-scroll-hide"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 14,
          marginBottom: 56,
          overflowX: 'auto',
        }}
      >
        {steps.map(([vi, en, dvi, den], idx) => (
          <div
            key={vi}
            style={{
              background: '#fff',
              border: '1px solid var(--s5-border)',
              borderRadius: 14,
              padding: 18,
              minWidth: 180,
              position: 'relative',
            }}
          >
            <div
              className="type-data"
              style={{ fontSize: 28, color: 'var(--s5-blue)', lineHeight: 1, marginBottom: 10 }}
            >
              0{idx + 1}
            </div>
            <h4 className="type-h3" style={{ fontSize: 15, marginBottom: 8 }}>{t(vi, en)}</h4>
            <p className="type-small">{t(dvi, den)}</p>
          </div>
        ))}
      </div>

      <div className="s5-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {blocks.map((b) => (
          <div key={b.vi} className="s5-card" id={b.vi === 'Phần mềm Quản lý Giải' ? 'btc' : undefined}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'var(--s5-navy)',
                color: 'var(--s5-lime)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              {b.icon}
            </div>
            <h3 className="type-h3" style={{ marginBottom: 10 }}>{t(b.vi, b.en)}</h3>
            <p className="type-body" style={{ color: 'var(--s5-text-muted)' }}>{t(b.dvi, b.den)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ═════════ Media & Monetization ═════════ */
export function S5Media({ lang }: { lang: Lang }) {
  const t = useT(lang);
  return (
    <Section id="media" style={{ background: 'var(--s5-surface)' }}>
      <div style={{ maxWidth: 820, marginBottom: 40 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>📺 {t('Truyền thông', 'Media')}</span>
        <h2 className="type-h2" style={{ marginBottom: 16 }}>
          {t('Giải của bạn xứng đáng', 'Your event deserves')}
          <br />
          <span style={{ color: 'var(--s5-magenta)' }}>
            {t('được chiếu đẹp như VPBank Hanoi Marathon.', 'broadcast-grade coverage.')}
          </span>
        </h2>
      </div>

      <div className="s5-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="s5-card">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--s5-blue)', marginBottom: 14 }}>
            <ICamera s={22} />
            <span className="type-eyebrow">{t('Media Package', 'Media Package')}</span>
          </div>
          <h3 className="type-h3" style={{ marginBottom: 10 }}>{t('Highlight AI + Livestream Multicam', 'AI highlights + Multicam livestream')}</h3>
          <p className="type-body" style={{ color: 'var(--s5-text-muted)' }}>
            {t(
              'Sản xuất video Highlight bằng AI từ footage giải. Livestream Multicam với bình luận viên. Clip từng trận gửi thẳng cho VĐV — VĐV share lên mạng, giải được marketing miễn phí.',
              'AI-generated highlight reels. Multicam livestream with commentary. Per-match clips sent to each athlete — they share, your event gets free reach.',
            )}
          </p>
        </div>

        <div className="s5-card">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--s5-blue)', marginBottom: 14 }}>
            <IMoney s={22} />
            <span className="type-eyebrow">{t('Kết nối Tài trợ', 'Sponsor matchmaking')}</span>
          </div>
          <h3 className="type-h3" style={{ marginBottom: 10 }}>{t('Sponsor × Cộng đồng thể thao', 'Sponsor × athlete community')}</h3>
          <p className="type-body" style={{ color: 'var(--s5-text-muted)' }}>
            {t(
              'Banner tại sân, sponsor trang giải, sponsored challenge. Báo cáo impressions & exposure time cho nhãn hàng.',
              'On-court banners, event-page sponsors, sponsored challenges. Full impressions & exposure-time reports.',
            )}
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ═════════ Rating Showcase (Dark) ═════════ */
export function S5Rating({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const bullets = [
    ['Cập nhật real-time sau mỗi trận', 'Real-time update after every match'],
    ['Tính cả trận giao hữu và CLB — không chỉ giải chính thức', 'Counts friendlies & club matches, not just official events'],
    ['Dùng để seeding trong giải → ghép đôi công bằng', 'Used for event seeding → fair draws'],
    ['Đầu tiên cho cầu lông phong trào tại VN', 'First of its kind for community badminton in VN'],
  ];

  return (
    <Section id="rating" dark style={{ background: 'linear-gradient(140deg, var(--s5-navy) 0%, #0F1337 50%, #06082A 100%)' }}>
      <div
        className="s5-2col"
        style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center' }}
      >
        <div>
          <span
            className="type-eyebrow"
            style={{ color: 'var(--s5-lime)', marginBottom: 14, display: 'inline-block' }}
          >
            🏅 {t('5Sport Rating', '5Sport Rating')}
          </span>
          <h2 className="type-h1" style={{ color: '#fff', marginBottom: 16 }}>
            {t('Di sản thi đấu của bạn —', 'Your match legacy —')}
            <br />
            <span style={{ color: 'var(--s5-lime)' }}>
              {t('được ghi lại đúng nghĩa.', 'properly recorded.')}
            </span>
          </h2>
          <p className="type-lead" style={{ color: 'rgba(255,255,255,0.72)', marginBottom: 28 }}>
            {t(
              'Mỗi trận bạn chơi đều có giá trị. Bạn không chỉ chơi — bạn đang xây dựng lịch sử thi đấu.',
              'Every match matters. You\u2019re not just playing — you\u2019re building a record.',
            )}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bullets.map(([vi, en]) => (
              <li key={vi} style={{ display: 'flex', gap: 12, color: 'rgba(255,255,255,0.88)' }}>
                <span style={{ color: 'var(--s5-lime)' }}>
                  <ICheck s={18} sw={2.5} />
                </span>
                <span className="type-body" style={{ color: 'inherit' }}>{t(vi, en)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Profile mockup */}
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
            border: '1px solid rgba(200,255,0,0.25)',
            borderRadius: 20,
            padding: 28,
            boxShadow: 'var(--s5-glow-lime)',
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--s5-lime), #8AE000)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--s5-navy)',
                fontFamily: 'var(--font-display-5s)',
                fontWeight: 900,
                fontSize: 20,
              }}
            >
              NA
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>Nguyễn Văn A</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>TP.HCM · CLB Quận 7</div>
            </div>
          </div>

          {[
            { sport: '🏸 ' + t('Cầu lông', 'Badminton'), rating: 5.1, pct: 82 },
            { sport: '🎯 Pickleball', rating: 4.2, pct: 68 },
          ].map((r) => (
            <div key={r.sport} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#fff' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{r.sport}</span>
                <span className="type-data" style={{ color: 'var(--s5-lime)', fontSize: 16 }}>{r.rating}</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ width: `${r.pct}%`, height: '100%', background: 'var(--s5-lime)' }} />
              </div>
            </div>
          ))}

          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 16,
              marginTop: 20,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              fontSize: 12,
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            <div><strong style={{ color: '#fff' }}>126</strong> {t('trận', 'matches')} · <strong style={{ color: 'var(--s5-lime)' }}>Win 62%</strong></div>
            <div>🥇 3 {t('lần vô địch', 'titles')}</div>
            <div style={{ gridColumn: '1 / -1', color: 'var(--s5-lime)', fontWeight: 700 }}>
              {t('Ranking toàn quốc', 'National ranking')}: #342
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ═════════ Ecosystem ═════════ */
export function S5Ecosystem({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const cards = [
    { e: '🎟', n: '5Ticket', d: t('Sàn vé sự kiện & thể thao', 'Event & sports marketplace') },
    { e: '🏃', n: '5BIB', d: t('Nền tảng chạy bộ & timing', 'Running & timing platform') },
    { e: '📸', n: '5Pix', d: t('AI nhận diện ảnh giải đấu', 'AI photo recognition') },
    { e: '⚙️', n: '5Tech', d: t('Hạ tầng công nghệ', 'Tech infrastructure') },
    { e: '🏸', n: '5Sport', d: t('Kết nối & vận hành thể thao vợt', 'Racket sports ops & community'), here: true },
  ];

  return (
    <Section id="ecosystem">
      <div style={{ maxWidth: 820, marginBottom: 40 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>
          {t('Hệ sinh thái', 'Ecosystem')}
        </span>
        <h2 className="type-h2" style={{ marginBottom: 16 }}>
          {t('Không chỉ là 5Sport.', 'More than just 5Sport.')}
          <br />
          <span style={{ color: 'var(--s5-blue)' }}>{t('Cả hệ sinh thái.', 'An entire ecosystem.')}</span>
        </h2>
        <p className="type-lead">
          {t(
            '5Sport là sản phẩm của 5Solution — team đã vận hành 195+ giải chạy bộ, 94K VĐV, 42K đơn hàng vé qua 5BIB và 5Ticket.',
            '5Sport is built by 5Solution — the team behind 195+ running events, 94K athletes, 42K ticket orders via 5BIB and 5Ticket.',
          )}
        </p>
      </div>

      <div className="s5-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {cards.map((c) => (
          <div
            key={c.n}
            className="s5-card"
            style={{
              padding: 20,
              ...(c.here
                ? {
                    background: 'var(--s5-navy)',
                    color: '#fff',
                    border: '1px solid var(--s5-lime)',
                    boxShadow: 'var(--s5-glow-lime)',
                  }
                : null),
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>{c.e}</div>
            <h4
              className="type-h3"
              style={{ fontSize: 16, marginBottom: 6, color: c.here ? 'var(--s5-lime)' : undefined }}
            >
              {c.n}
            </h4>
            <p style={{ fontSize: 12, color: c.here ? 'rgba(255,255,255,0.75)' : 'var(--s5-text-muted)', lineHeight: 1.5 }}>
              {c.d}
            </p>
            {c.here && (
              <span
                style={{
                  marginTop: 10,
                  display: 'inline-block',
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--s5-navy)',
                  background: 'var(--s5-lime)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                }}
              >
                {t('Bạn đang ở đây', 'You are here')}
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 32,
          padding: '20px 24px',
          background: 'linear-gradient(90deg, rgba(20,0,255,0.06), rgba(200,255,0,0.08))',
          border: '1px solid var(--s5-blue-100)',
          borderRadius: 16,
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ color: 'var(--s5-blue)', fontFamily: 'var(--font-display-5s)', fontSize: 18 }}>
          {t('Unified Sports ID', 'Unified Sports ID')}
        </strong>
        <span className="type-body">
          {t(
            '1 tài khoản → toàn bộ ecosystem. Mua vé qua 5Ticket, thi đấu với 5Sport, nhận ảnh qua 5Pix — không cần đăng ký lại.',
            'One account unlocks the whole ecosystem. Buy tickets on 5Ticket, compete on 5Sport, receive photos on 5Pix — no re-signup.',
          )}
        </span>
      </div>
    </Section>
  );
}

/* ═════════ Testimonials ═════════ */
export function S5Testimonials({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const items = [
    {
      q: t(
        'Trước đây tổ chức giải pickleball 100 người mất 3-4 người cả tuần chuẩn bị. Với 5Sport, 2 người làm trong 2 ngày là xong.',
        'A 100-player pickleball event used to take 3–4 people a full week. With 5Sport, 2 people finish in 2 days.',
      ),
      a: t('BTC Giải Pickleball Phong trào', 'Community pickleball organizer'),
      tag: 'BTC',
    },
    {
      q: t(
        'Lần đầu tiên tôi có profile lưu toàn bộ thành tích thi đấu. Xem lại cũng thấy mình progress được bao nhiêu.',
        'First time I have a profile tracking my full match history. It\u2019s satisfying to see real progress.',
      ),
      a: t('VĐV, Rating 4.8 Pickleball', 'Player, Rating 4.8 Pickleball'),
      tag: 'VĐV',
    },
    {
      q: t(
        'Báo cáo exposure của giải chi tiết hơn bất kỳ platform nào tôi từng dùng — biết được bao nhiêu người xem, bao nhiêu click.',
        'Exposure reports are more detailed than anything I\u2019ve used — views, clicks, all there.',
      ),
      a: t('Title Sponsor, nhãn hàng thể thao', 'Title sponsor, sports brand'),
      tag: 'Sponsor',
    },
  ];
  return (
    <Section style={{ background: 'var(--s5-surface)' }}>
      <div style={{ maxWidth: 820, marginBottom: 40 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>
          {t('Voices', 'Voices')}
        </span>
        <h2 className="type-h2">
          {t('Những người đã chọn 5Sport', 'People who chose 5Sport')}
        </h2>
      </div>
      <div className="s5-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {items.map((it, i) => (
          <div key={i} className="s5-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span
              style={{
                alignSelf: 'flex-start',
                fontSize: 10,
                fontWeight: 900,
                color: 'var(--s5-blue)',
                background: 'var(--s5-blue-50)',
                padding: '4px 10px',
                borderRadius: 6,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
              }}
            >
              {it.tag}
            </span>
            <p className="type-body" style={{ fontSize: 15, color: 'var(--s5-text)', lineHeight: 1.65 }}>
              &ldquo;{it.q}&rdquo;
            </p>
            <div
              style={{
                color: 'var(--s5-text-muted)',
                fontSize: 13,
                fontWeight: 700,
                borderTop: '1px solid var(--s5-border)',
                paddingTop: 12,
                marginTop: 'auto',
              }}
            >
              — {it.a}
            </div>
          </div>
        ))}
      </div>
      <p
        style={{
          marginTop: 24,
          fontSize: 11,
          color: 'var(--s5-text-subtle)',
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        {t(
          '* Placeholder — sẽ thay thế bằng testimonials thật sau beta.',
          '* Placeholder quotes — to be replaced with real testimonials post-beta.',
        )}
      </p>
    </Section>
  );
}

/* ═════════ Pricing ═════════ */
export function S5Pricing({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const tiers = [
    {
      name: t('Free — Cộng đồng', 'Free — Community'),
      price: t('Miễn phí', 'Free'),
      sub: t('Người chơi cá nhân, CLB nhỏ', 'Individual players, small clubs'),
      features: [
        t('Profile VĐV + 5Sport Rating', 'Athlete profile + 5Sport Rating'),
        t('Tìm bạn chơi, Court Finder', 'Partner & court finder'),
        t('Tham gia giải đấu', 'Join tournaments'),
        t('Quản lý CLB ≤ 20 thành viên', 'Manage clubs ≤ 20 members'),
      ],
      accent: 'var(--s5-border)',
      featured: false,
    },
    {
      name: t('Pro — BTC Phong trào', 'Pro — Community organizers'),
      price: '299,000đ',
      priceSub: t('/tháng · 2.499.000đ/năm', '/mo · 2.499.000đ/yr'),
      sub: t('BTC tổ chức ≤ 5 giải/năm', 'Organizers with ≤ 5 events/yr'),
      features: [
        t('Tất cả Free +', 'Everything in Free +'),
        t('Giải không giới hạn VĐV', 'Unlimited athletes per event'),
        t('Bracket tự động (RR, KO, KOTC)', 'Auto brackets (RR, KO, KOTC)'),
        t('QR Check-in + Live Scoring', 'QR check-in + live scoring'),
        t('Bán vé thi đấu (5.5% + phí cổng)', 'Entry sales (5.5% + gateway)'),
        t('Dashboard & báo cáo', 'Dashboard & reports'),
      ],
      accent: 'var(--s5-blue)',
      featured: true,
    },
    {
      name: t('Enterprise — BTC Chuyên nghiệp', 'Enterprise — Pro operators'),
      price: t('Liên hệ', 'Contact us'),
      sub: t('BTC lớn, Tour, League', 'Large events, tours, leagues'),
      features: [
        t('Tất cả Pro +', 'Everything in Pro +'),
        t('Bán vé khán giả (Seat Map)', 'Spectator tickets (Seat Map)'),
        t('Tích hợp 5Pix (ảnh giải)', '5Pix integration (photos)'),
        t('Sponsor management + reports', 'Sponsor management + reports'),
        t('Media Package (Highlight AI, Livestream)', 'Media Package (AI highlights, livestream)'),
        t('Dedicated account manager', 'Dedicated account manager'),
      ],
      accent: 'var(--s5-magenta)',
      featured: false,
    },
  ];
  return (
    <Section id="pricing">
      <div style={{ maxWidth: 820, marginBottom: 40 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>Pricing</span>
        <h2 className="type-h2" style={{ marginBottom: 16 }}>
          {t('Bảng giá rõ ràng.', 'Clear pricing.')}
          <br />
          <span style={{ color: 'var(--s5-blue)' }}>{t('Không phí ẩn.', 'No hidden fees.')}</span>
        </h2>
        <p className="type-lead">
          {t(
            'Phí chỉ phát sinh khi có giao dịch. Bạn chưa bán được vé — bạn không mất tiền.',
            'You only pay when you sell. No sales, no fees.',
          )}
        </p>
      </div>

      <div className="s5-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="s5-card"
            style={{
              border: `2px solid ${tier.featured ? tier.accent : 'var(--s5-border)'}`,
              position: 'relative',
              ...(tier.featured ? { boxShadow: 'var(--s5-glow-blue)' } : null),
            }}
          >
            {tier.featured && (
              <span
                style={{
                  position: 'absolute',
                  top: -12,
                  left: 24,
                  background: 'var(--s5-lime)',
                  color: 'var(--s5-navy)',
                  fontSize: 10,
                  fontWeight: 900,
                  padding: '5px 12px',
                  borderRadius: 6,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                }}
              >
                {t('Phổ biến nhất', 'Most popular')}
              </span>
            )}
            <h3 className="type-h3" style={{ marginBottom: 6 }}>{tier.name}</h3>
            <p className="type-small" style={{ marginBottom: 18 }}>{tier.sub}</p>
            <div style={{ marginBottom: 20 }}>
              <span
                className="type-data"
                style={{ fontSize: 32, color: tier.featured ? tier.accent : 'var(--s5-text)' }}
              >
                {tier.price}
              </span>
              {tier.priceSub && (
                <span style={{ color: 'var(--s5-text-muted)', fontSize: 13, marginLeft: 6 }}>
                  {tier.priceSub}
                </span>
              )}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {tier.features.map((f, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: tier.accent, marginTop: 2 }}><ICheck s={16} sw={2.5} /></span>
                  <span className="type-body" style={{ fontSize: 14 }}>{f}</span>
                </li>
              ))}
            </ul>
            <a
              href="#lead-form"
              className={tier.featured ? 's5-btn s5-btn-primary' : 's5-btn s5-btn-outline'}
              style={{ width: '100%' }}
            >
              {tier.price === t('Liên hệ', 'Contact us')
                ? t('Liên hệ', 'Contact us')
                : tier.featured
                  ? t('Bắt đầu dùng Pro', 'Start with Pro')
                  : t('Đăng ký miễn phí', 'Sign up free')}
            </a>
          </div>
        ))}
      </div>

      <p
        style={{
          marginTop: 18,
          fontSize: 12,
          color: 'var(--s5-text-subtle)',
          textAlign: 'center',
        }}
      >
        * {t(
          'Phí giao dịch vé: 5.5%/đơn. VNPAY Omni: 10-15% (đã gồm phí cổng).',
          'Ticket fee: 5.5%/order. VNPAY Omni: 10–15% (gateway fee included).',
        )}
      </p>
    </Section>
  );
}

/* ═════════ FAQ ═════════ */
export function S5FAQ({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const items = [
    [
      'Q: 5Sport chỉ dành cho cầu lông và pickleball?',
      'Q: Is 5Sport only for badminton and pickleball?',
      'Hiện tại 5Sport tập trung vào 2 môn vợt này. Chúng tôi đang mở rộng sang tennis và padel. Liên hệ nếu bạn có nhu cầu cho môn khác.',
      'We currently focus on these two racket sports. Tennis and padel are next. Contact us for other sports.',
    ],
    [
      'Q: Tôi cần bao lâu để setup giải đấu đầu tiên?',
      'Q: How long to set up my first tournament?',
      'Với thông tin giải sẵn sàng, setup cơ bản mất khoảng 10-15 phút. Đội ngũ 5Sport hỗ trợ onboarding trực tiếp cho lần đầu.',
      'With info ready, basic setup is 10–15 minutes. Our team walks you through your first event.',
    ],
    [
      'Q: 5Sport Rating tính như thế nào? Có như DUPR không?',
      'Q: How does 5Sport Rating work? Is it like DUPR?',
      'Rating tự xây cho thị trường VN — cho cả pickleball và cầu lông. Với pickleball, chúng tôi đang tích hợp DUPR. Với cầu lông phong trào, đây là rating đầu tiên tại VN.',
      'A custom system for Vietnam, covering both sports. DUPR integration is in progress for pickleball; for community badminton, this is a first for VN.',
    ],
    [
      'Q: VĐV thanh toán thế nào?',
      'Q: How do athletes pay?',
      'VNPAY, MoMo, ViettelPay, ATM nội địa, QR Pay. Xử lý dưới 3 giây.',
      'VNPAY, MoMo, ViettelPay, domestic ATM, QR Pay. Processed in under 3 seconds.',
    ],
    [
      'Q: BTC nhận tiền khi nào?',
      'Q: When do organizers get paid?',
      'T+3 với Pro. Enterprise có thể đàm phán T+1.',
      'T+3 for Pro. Enterprise can negotiate T+1.',
    ],
    [
      'Q: 5Sport có tích hợp được với hệ thống của chúng tôi không?',
      'Q: Can 5Sport integrate with our system?',
      'Có API và webhook cho các đối tác. Liên hệ team kỹ thuật để trao đổi custom.',
      'We have APIs and webhooks for partners. Contact our tech team for custom integrations.',
    ],
  ];
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <Section id="faq" style={{ background: 'var(--s5-surface)' }}>
      <div style={{ maxWidth: 820, marginBottom: 40 }}>
        <span className="type-eyebrow" style={sectionEyebrowStyle}>FAQ</span>
        <h2 className="type-h2">{t('Câu hỏi thường gặp', 'Frequently asked questions')}</h2>
      </div>
      <div style={{ maxWidth: 840, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(([qvi, qen, avi, aen], i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              style={{
                background: '#fff',
                border: '1px solid var(--s5-border)',
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '18px 22px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  fontFamily: 'var(--font-display-5s)',
                  fontWeight: 800,
                  fontSize: 15,
                  color: 'var(--s5-text)',
                }}
              >
                <span>{t(qvi, qen)}</span>
                <span style={{ color: 'var(--s5-blue)', fontSize: 20, lineHeight: 1, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 200ms' }}>+</span>
              </button>
              {isOpen && (
                <div
                  style={{
                    padding: '0 22px 20px',
                    color: 'var(--s5-text-muted)',
                    fontSize: 14,
                    lineHeight: 1.65,
                  }}
                >
                  {t(avi, aen)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
