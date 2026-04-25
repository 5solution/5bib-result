'use client';

import * as React from 'react';
import { Reveal, IArr } from './sol-shared';

/* ────────────────────────────────────────────────────────────────────────── */
/*  SolAbout — Find · Fine · Five (dark navy)                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function SolAbout() {
  return (
    <section
      id="about"
      className="sol-section sol-scroll-mt"
      style={{ background: 'var(--sol-navy)', color: '#fff' }}
    >
      <div className="sol-container">
        <Reveal>
          <span
            className="sol-kicker"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            01 · Về 5Solution
          </span>
          <h2
            className="sol-h2"
            style={{
              color: '#fff',
              maxWidth: '20ch',
              marginTop: 14,
              marginBottom: 56,
            }}
          >
            5BIB không đơn thuần
            <br />
            <span style={{ color: 'var(--sol-magenta)' }}>là một cái tên.</span>
          </h2>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'clamp(24px, 4vw, 48px)',
          }}
        >
          {[
            {
              tag: 'FIND',
              text: 'Tìm kiếm dễ dàng — thông tin mạch lạc, đầy đủ. Mọi vận động viên đều tìm thấy sự kiện, kết quả và hình ảnh của mình chỉ trong vài giây.',
            },
            {
              tag: 'FINE',
              text: 'Chất lượng ổn định cao nhất. Mỗi sản phẩm, mỗi dịch vụ đều vượt qua kỳ vọng của Ban tổ chức và vận động viên.',
            },
            {
              tag: 'FIVE',
              text: 'Hệ sinh thái 5 sản phẩm — 5BIB · 5Ticket · 5Pix · 5Sport · 5Tech. Một nền tảng. Toàn bộ hành trình.',
            },
          ].map((b, i) => (
            <Reveal key={b.tag} delay={i * 100}>
              <div>
                <div
                  style={{
                    display: 'inline-block',
                    fontFamily: 'var(--sol-font-mono)',
                    fontSize: 'clamp(40px, 5vw, 64px)',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: 'var(--sol-magenta)',
                    marginBottom: 18,
                    lineHeight: 1,
                  }}
                >
                  {b.tag}
                </div>
                <p
                  style={{
                    fontSize: 'clamp(15px, 1.3vw, 18px)',
                    lineHeight: 1.65,
                    color: 'rgba(255,255,255,0.78)',
                    margin: 0,
                  }}
                >
                  {b.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SolModule5BIB — Quản lý sự kiện thể thao (4 modules)                       */
/* ────────────────────────────────────────────────────────────────────────── */

const BIB_MODULES = [
  {
    badge: 'MODULE 01',
    title: 'Bán vé & Quản lý VĐV',
    tagline: 'Cổng bán vé tập trung, quy mô lên đến 10.000+ người',
    bullets: [
      'Giao diện sự kiện riêng biệt, tùy chỉnh đầy đủ',
      'Landing page sự kiện: hình ảnh, video, banner không giới hạn',
      'Thanh toán đa dạng: Visa, ATM, QR Code, Zalo Pay, VNPAY',
      'Mã giảm giá linh hoạt: theo cự ly, đơn hàng, thời gian',
      'Add-on: áo giải, huy chương, vé xe, bảo hiểm',
      'Bán vé doanh nghiệp: link riêng, giới hạn domain email',
      'Chuyển nhượng vé linh hoạt giữa VĐV',
    ],
  },
  {
    badge: 'MODULE 02',
    title: 'Dashboard BTC',
    tagline: 'Mọi thứ trong tầm mắt Ban tổ chức',
    bullets: [
      'Bộ lọc thông tin VĐV tùy chỉnh theo khoảng thời gian',
      'Doanh thu theo giờ/ngày/tháng/năm',
      'Thống kê check-in, tỷ lệ chuyển đổi',
      'Xuất CSV / Excel bất kỳ lúc nào',
      'BTC chủ động gửi email cho VĐV',
      'Quản lý toàn bộ sự kiện trên một màn hình',
    ],
  },
  {
    badge: 'MODULE 03',
    title: 'E-Waiver & Phát Racekit',
    tagline: 'Miễn trừ điện tử + QR Code racekit',
    bullets: [
      'VĐV ký miễn trừ điện tử ngay khi đăng ký',
      'Lưu trữ pháp lý đầy đủ, xuất PDF',
      'Hỗ trợ ủy quyền nhận BIB',
      'Quét QR → check-in lấy BIB ngay lập tức',
      'Kiểm soát số lượng, giảm sai sót tại quầy',
      'Báo cáo nhận BIB theo thời gian thực',
    ],
  },
  {
    badge: 'MODULE 04',
    title: 'BIB Lottery',
    tagline: 'Tạo khoảnh khắc hồi hộp trước ngày đua',
    bullets: [
      'Cấu hình số lượng BIB đặc biệt (VIP, lucky number)',
      'Quay số trực tiếp, minh bạch',
      'Thông báo tự động đến VĐV trúng thưởng',
      'Tích hợp social sharing — VĐV chia sẻ kết quả',
    ],
  },
];

const BIB_STATS = [
  { num: '42.000+', label: 'đơn hàng' },
  { num: '10.000+', label: 'VĐV/sự kiện' },
  { num: '99.8%', label: 'uptime' },
];

export function SolModule5BIB() {
  return (
    <section id="5bib" className="sol-section sol-scroll-mt">
      <div className="sol-container">
        <Reveal>
          <div style={{ marginBottom: 56, maxWidth: '56ch' }}>
            <span className="sol-kicker">02 · 5BIB Platform</span>
            <h2 className="sol-h2" style={{ marginTop: 12, marginBottom: 16 }}>
              Quản lý sự kiện thể thao theo cách{' '}
              <span style={{ color: 'var(--sol-blue)' }}>chưa từng có</span> tại
              Việt Nam.
            </h2>
            <p className="sol-lead">
              Từ bán vé, quản lý VĐV, phát racekit, đến báo cáo doanh thu — tất
              cả trong một nền tảng duy nhất.
            </p>
          </div>
        </Reveal>

        {/* Stats band */}
        <Reveal>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 24,
              padding: '28px 32px',
              background: 'var(--sol-blue)',
              borderRadius: 16,
              color: '#fff',
              marginBottom: 48,
            }}
          >
            {BIB_STATS.map((s) => (
              <div key={s.label}>
                <div
                  style={{
                    fontFamily: 'var(--sol-font-mono)',
                    fontSize: 'clamp(28px, 3.6vw, 44px)',
                    fontWeight: 900,
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {s.num}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.72)',
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 4 modules grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'clamp(20px, 2vw, 28px)',
          }}
        >
          {BIB_MODULES.map((m, i) => (
            <Reveal key={m.badge} delay={i * 80}>
              <article
                className="sol-card"
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <span
                  className="sol-pill"
                  style={{ alignSelf: 'flex-start', marginBottom: 16 }}
                >
                  {m.badge}
                </span>
                <h3 className="sol-h3" style={{ marginBottom: 8 }}>
                  {m.title}
                </h3>
                <p
                  className="sol-body"
                  style={{ marginBottom: 20, fontSize: 15 }}
                >
                  {m.tagline}
                </p>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
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
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SolModule5Ticket — Concert + 60s flow + Pricing anchor                     */
/* ────────────────────────────────────────────────────────────────────────── */

export function SolModule5Ticket() {
  return (
    <section
      id="5ticket"
      className="sol-section sol-scroll-mt"
      style={{ background: 'var(--sol-surface-2)' }}
    >
      <div className="sol-container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1.2fr)',
            gap: 'clamp(36px, 5vw, 72px)',
            alignItems: 'center',
          }}
        >
          <Reveal>
            <div>
              <span className="sol-kicker">03 · 5Ticket</span>
              <h2 className="sol-h2" style={{ marginTop: 12, marginBottom: 16 }}>
                Mua vé trong{' '}
                <span style={{ color: 'var(--sol-magenta)' }}>60 giây.</span>
                <br />
                Nhận QR ngay lập tức.
              </h2>
              <p className="sol-lead" style={{ marginBottom: 28 }}>
                Hệ sinh thái phân phối vé đa kênh đầu tiên tại Việt Nam dành riêng
                cho sự kiện thể thao và giải trí. Không chỉ cho giải chạy — 5Ticket
                phục vụ mọi loại sự kiện.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 28,
                }}
              >
                {[
                  'Visa',
                  'ATM',
                  'QR Code',
                  'Zalo Pay',
                  'MoMo',
                  'VNPAY',
                  'Internet Banking',
                ].map((p) => (
                  <span key={p} className="sol-pill">
                    {p}
                  </span>
                ))}
              </div>

              <div
                className="sol-card"
                style={{
                  background: 'var(--sol-blue)',
                  color: '#fff',
                  border: 'none',
                  padding: 22,
                }}
              >
                <div
                  className="sol-kicker"
                  style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}
                >
                  Pricing tiêu chuẩn
                </div>
                <div
                  style={{
                    fontFamily: 'var(--sol-font-mono)',
                    fontSize: 'clamp(40px, 6vw, 72px)',
                    fontWeight: 900,
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  Từ 5.5%
                </div>
                <p
                  style={{
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.85)',
                    margin: 0,
                  }}
                >
                  Đã bao gồm phí thanh toán thẻ. Import thủ công:{' '}
                  <strong>11.000đ/VĐV</strong>. Enterprise: liên hệ báo giá.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {[
                {
                  step: '01',
                  text: 'Tìm sự kiện theo tên, ngày, loại hình',
                },
                {
                  step: '02',
                  text: 'Chọn vé (cá nhân / nhóm) + add-on tuỳ chọn',
                },
                {
                  step: '03',
                  text: 'Thanh toán đa hình thức trong vài giây',
                },
                {
                  step: '04',
                  text: 'Nhận vé điện tử trong inbox + wallet',
                },
                {
                  step: '05',
                  text: 'Chuyển nhượng linh hoạt nếu cần',
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="sol-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    padding: '18px 22px',
                  }}
                >
                  <span
                    className="sol-num-badge"
                    style={{ width: 44, height: 44, borderRadius: 10, fontSize: 16 }}
                  >
                    {s.step}
                  </span>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sol-text)' }}>
                    {s.text}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* 4 features grid */}
        <Reveal>
          <div
            style={{
              marginTop: 'clamp(48px, 6vw, 80px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {[
              {
                title: 'Loại vé linh hoạt',
                items: [
                  'Vé thường, VIP, VVIP',
                  'Theo khu vực: Block A/B/C/D',
                  'Chọn chỗ ngồi/đứng',
                  'Form đăng ký tuỳ chỉnh',
                ],
              },
              {
                title: 'Quản lý danh sách',
                items: [
                  'Xuất theo khu vực, loại vé',
                  'Tìm kiếm: tên, email, mã vé',
                  'Trạng thái thanh toán real-time',
                ],
              },
              {
                title: 'Check-in thông minh',
                items: [
                  'QR Code scan offline/online',
                  'App check-in chuyên dụng',
                  'Hiển thị info VĐV khi scan',
                ],
              },
              {
                title: 'Báo cáo & đối soát',
                items: [
                  'Doanh thu theo khu vực',
                  'Tỷ lệ check-in',
                  'Xuất CSV/Excel',
                  'Tuỳ chỉnh branding',
                ],
              },
            ].map((f) => (
              <div key={f.title} className="sol-card">
                <h4
                  style={{
                    margin: '0 0 12px 0',
                    fontFamily: 'var(--sol-font-display)',
                    fontWeight: 700,
                    fontSize: 17,
                    color: 'var(--sol-blue)',
                  }}
                >
                  {f.title}
                </h4>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {f.items.map((it) => (
                    <li
                      key={it}
                      style={{
                        fontSize: 13,
                        color: 'var(--sol-text-muted)',
                        paddingLeft: 14,
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 8,
                          width: 6,
                          height: 6,
                          borderRadius: 9999,
                          background: 'var(--sol-blue)',
                        }}
                      />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SolResult — result.5bib.com kết quả live                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export function SolResult() {
  return (
    <section
      id="result"
      className="sol-section sol-scroll-mt"
      style={{
        background: 'var(--sol-navy)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="sol-dots-bg"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.15,
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)',
        }}
      />
      <div className="sol-container" style={{ position: 'relative' }}>
        <Reveal>
          <div style={{ maxWidth: '52ch', marginBottom: 56 }}>
            <span
              className="sol-kicker"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              04 · result.5bib.com
            </span>
            <h2
              className="sol-h2"
              style={{ color: '#fff', marginTop: 12, marginBottom: 16 }}
            >
              Kết quả của bạn.{' '}
              <span style={{ color: 'var(--sol-magenta)' }}>Sống mãi.</span>
            </h2>
            <p
              className="sol-lead"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              Nền tảng tra cứu thành tích thể thao chuyên biệt đầu tiên tại Việt
              Nam. Không chỉ là một trang kết quả — đây là hồ sơ thi đấu của
              mỗi vận động viên, được lưu trữ vĩnh viễn.
            </p>
          </div>
        </Reveal>

        {/* 3 pillars */}
        <Reveal>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 20,
              marginBottom: 56,
            }}
          >
            {[
              {
                tag: 'REAL-TIME',
                text: 'Kết quả xuất hiện ngay khi VĐV chạm chip finish',
              },
              {
                tag: 'LỊCH SỬ TOÀN DIỆN',
                text: 'Toàn bộ thành tích qua mọi mùa giải, mọi cự ly',
              },
              {
                tag: 'CHIA SẺ NGAY',
                text: 'Certificate số hoàn thành, share 1 chạm lên MXH',
              },
            ].map((p) => (
              <div
                key={p.tag}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14,
                  padding: 24,
                }}
              >
                <span
                  className="sol-kicker"
                  style={{ color: 'var(--sol-cyan)', marginBottom: 10, display: 'block' }}
                >
                  {p.tag}
                </span>
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.55,
                    color: 'rgba(255,255,255,0.88)',
                    margin: 0,
                  }}
                >
                  {p.text}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* BTC benefits + tech specs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(24px, 4vw, 56px)',
          }}
        >
          <Reveal>
            <div>
              <h3
                className="sol-h3"
                style={{ color: '#fff', marginBottom: 18 }}
              >
                Cho Ban tổ chức
              </h3>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {[
                  'Branded result page riêng cho giải của bạn',
                  'Logo, banner nhà tài trợ hiển thị nổi bật',
                  'Bảng kết quả embed được vào website BTC',
                  'Xuất toàn bộ kết quả CSV / Excel',
                  'API kết quả cho bên thứ ba (media, sponsor)',
                  'Lưu trữ vĩnh viễn — VĐV tra cứu mãi mãi',
                ].map((b) => (
                  <li
                    key={b}
                    className="sol-check-row"
                    style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}
                  >
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div
              style={{
                background: 'rgba(255,14,101,0.08)',
                border: '1px solid var(--sol-magenta)',
                borderRadius: 16,
                padding: 28,
              }}
            >
              <h3
                className="sol-h3"
                style={{ color: '#fff', marginBottom: 18 }}
              >
                Tech specs
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                {[
                  { num: '99.9%', label: 'uptime' },
                  { num: '< 1s', label: 'latency hiển thị kết quả' },
                  { num: '50.000+', label: 'concurrent requests/s' },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      paddingBottom: 14,
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--sol-font-mono)',
                        fontSize: 'clamp(24px, 3vw, 36px)',
                        fontWeight: 900,
                        color: 'var(--sol-magenta)',
                      }}
                    >
                      {s.num}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.7)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
              <blockquote
                style={{
                  marginTop: 20,
                  marginBottom: 0,
                  fontSize: 14,
                  fontStyle: 'italic',
                  color: 'rgba(255,255,255,0.75)',
                  borderLeft: '3px solid var(--sol-magenta)',
                  paddingLeft: 14,
                  lineHeight: 1.55,
                }}
              >
                "Runners share their results. Sponsors get seen. BTC gets credited.
                Tất cả đều thắng."
              </blockquote>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SolModule5Pix — AI photo + before/after                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export function SolModule5Pix() {
  return (
    <section id="5pix" className="sol-section sol-scroll-mt">
      <div className="sol-container">
        <Reveal>
          <div style={{ maxWidth: '52ch', marginBottom: 48 }}>
            <span className="sol-kicker">05 · 5Pix</span>
            <h2 className="sol-h2" style={{ marginTop: 12, marginBottom: 16 }}>
              Khoảnh khắc của bạn{' '}
              <span style={{ color: 'var(--sol-magenta)' }}>không bao giờ</span>{' '}
              bị bỏ lỡ.
            </h2>
            <p className="sol-lead">
              5Pix dùng AI nhận diện khuôn mặt kết hợp với số BIB để tự động tìm
              và giao ảnh đến từng vận động viên — không cần tìm kiếm thủ công,
              không cần nhớ thứ tự.
            </p>
          </div>
        </Reveal>

        {/* Pipeline + stats */}
        <Reveal>
          <div
            className="sol-card"
            style={{
              padding: 'clamp(24px, 3vw, 40px)',
              marginBottom: 48,
              background:
                'linear-gradient(135deg, var(--sol-blue-50), var(--sol-surface-2))',
              border: '1px solid var(--sol-blue-100)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 12,
                marginBottom: 24,
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--sol-blue-700)',
              }}
            >
              {[
                'Nhiếp ảnh gia chụp',
                'Upload lên 5Pix',
                'AI: Face + BIB',
                'Gán vào profile VĐV',
                'Push notification',
                'VĐV xem & share',
              ].map((step, i, arr) => (
                <React.Fragment key={step}>
                  <span
                    style={{
                      padding: '8px 14px',
                      background: '#fff',
                      borderRadius: 9999,
                      border: '1px solid var(--sol-blue-100)',
                    }}
                  >
                    {step}
                  </span>
                  {i < arr.length - 1 ? (
                    <IArr s={14} style={{ color: 'var(--sol-blue)' }} />
                  ) : null}
                </React.Fragment>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 16,
                paddingTop: 20,
                borderTop: '1px solid var(--sol-border)',
              }}
            >
              {[
                { num: '< 2 giờ', label: 'xử lý sau sự kiện' },
                { num: '98%+', label: 'độ chính xác AI' },
                { num: '0 thao tác', label: 'thủ công phía VĐV' },
              ].map((s) => (
                <div key={s.label}>
                  <div
                    style={{
                      fontFamily: 'var(--sol-font-mono)',
                      fontSize: 'clamp(20px, 2.4vw, 28px)',
                      fontWeight: 900,
                      color: 'var(--sol-blue)',
                      marginBottom: 4,
                    }}
                  >
                    {s.num}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--sol-text-muted)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Before / After */}
        <Reveal>
          <h3 className="sol-h3" style={{ marginBottom: 24, textAlign: 'center' }}>
            Trước 5Pix vs. Sau 5Pix
          </h3>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          <Reveal>
            <div
              className="sol-card"
              style={{
                background: 'var(--sol-surface)',
                borderColor: 'var(--sol-border-strong)',
              }}
            >
              <span
                className="sol-pill"
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  color: 'var(--sol-text-muted)',
                  marginBottom: 16,
                }}
              >
                CÁCH CŨ
              </span>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {[
                  'Cuộn hàng nghìn ảnh trong album event',
                  'Không biết ảnh của mình ở trang nào',
                  'Mua ảnh nhầm của người khác',
                  'Ảnh đẹp nhất bị người khác mua trước',
                  'Cần nhớ giờ chụp, vị trí, màu áo...',
                ].map((it) => (
                  <li
                    key={it}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: 14,
                      color: 'var(--sol-text-muted)',
                      textDecoration: 'line-through',
                      textDecorationColor: 'rgba(0,0,0,0.25)',
                    }}
                  >
                    <span style={{ color: 'var(--sol-magenta)', flexShrink: 0 }}>✕</span>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div
              className="sol-card"
              style={{
                background: 'var(--sol-blue-50)',
                borderColor: 'var(--sol-blue)',
              }}
            >
              <span
                className="sol-pill"
                style={{ marginBottom: 16 }}
              >
                VỚI 5PIX
              </span>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {[
                  'Nhận thông báo: "Bạn có 47 ảnh tại VnExpress Marathon"',
                  'Mở app, thấy ngay ảnh của mình',
                  'Chọn tải về hoặc chia sẻ trực tiếp',
                  'Ảnh được AI tag sẵn: km, giờ chụp, vị trí',
                  'Không cần tìm kiếm, không cần hỏi BTC',
                ].map((it) => (
                  <li
                    key={it}
                    className="sol-check-row"
                    style={{ fontSize: 14, color: 'var(--sol-text)' }}
                  >
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SolProcess — 4 bước Ticket Flow + 3 bước Timing                            */
/* ────────────────────────────────────────────────────────────────────────── */

export function SolProcess() {
  return (
    <section
      id="process"
      className="sol-section sol-scroll-mt"
      style={{ background: 'var(--sol-surface)' }}
    >
      <div className="sol-container">
        <Reveal>
          <div style={{ marginBottom: 56, maxWidth: '50ch' }}>
            <span className="sol-kicker">06 · Quy trình</span>
            <h2 className="sol-h2" style={{ marginTop: 12, marginBottom: 16 }}>
              4 bước đơn giản{' '}
              <span style={{ color: 'var(--sol-blue)' }}>để sự kiện</span> của
              bạn lên sàn.
            </h2>
            <p className="sol-lead">
              Một quy trình rõ ràng. Một đầu mối. Không đứt gãy từ tư vấn đến đối
              soát.
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {[
            {
              step: '01',
              title: 'Đề xuất & Chào giá',
              desc: '5Solution gửi bảng đề xuất và thông tin cần chuẩn bị cho sự kiện',
            },
            {
              step: '02',
              title: 'Duyệt & Ký hợp đồng',
              desc: 'Chỉnh sửa hạng mục, ký hợp đồng + tài liệu triển khai',
            },
            {
              step: '03',
              title: 'Triển khai bán vé',
              desc: 'Lên kế hoạch, điều phối nhân sự, vận hành tracking',
            },
            {
              step: '04',
              title: 'Đối soát & Nghiệm thu',
              desc: 'Báo cáo kết quả, quyết toán, nghiệm thu sau giải',
            },
          ].map((s, i) => (
            <Reveal key={s.step} delay={i * 80}>
              <div
                className="sol-card"
                style={{ height: '100%', position: 'relative' }}
              >
                <span className="sol-num-badge" style={{ marginBottom: 18 }}>
                  {s.step}
                </span>
                <h4
                  style={{
                    margin: '0 0 8px 0',
                    fontFamily: 'var(--sol-font-display)',
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {s.title}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: 'var(--sol-text-muted)',
                    lineHeight: 1.55,
                  }}
                >
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Timing 3-step */}
        <Reveal>
          <div
            style={{
              marginTop: 'clamp(40px, 5vw, 64px)',
              padding: 'clamp(24px, 3vw, 40px)',
              background: 'var(--sol-navy)',
              borderRadius: 16,
              color: '#fff',
            }}
          >
            <span
              className="sol-kicker"
              style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 14, display: 'block' }}
            >
              Quy trình Chip Timing
            </span>
            <h3
              className="sol-h3"
              style={{ color: '#fff', marginBottom: 24 }}
            >
              3 bước — từ yêu cầu đến kết quả live
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 18,
              }}
            >
              {[
                {
                  num: '1',
                  title: 'Lấy yêu cầu & chốt nội dung',
                  desc: 'Số VĐV · Điểm timing · Loại chip · Yêu cầu đặc biệt',
                },
                {
                  num: '2',
                  title: 'Vận hành tại sự kiện',
                  desc: 'Đội 5Tech deploy thiết bị tại start, finish, split points',
                },
                {
                  num: '3',
                  title: 'Xem & theo dõi kết quả',
                  desc: 'Kết quả live trên 5BIB.com. VĐV tra cứu ngay',
                },
              ].map((s) => (
                <div
                  key={s.num}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--sol-font-mono)',
                      fontSize: 32,
                      fontWeight: 900,
                      color: 'var(--sol-magenta)',
                      lineHeight: 1,
                      marginBottom: 10,
                    }}
                  >
                    {s.num}
                  </div>
                  <h5
                    style={{
                      margin: '0 0 6px 0',
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {s.title}
                  </h5>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.7)',
                      lineHeight: 1.5,
                    }}
                  >
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SolTestimonials — 3 quotes                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function SolTestimonials() {
  const quotes = [
    {
      text: '5BIB giúp chúng tôi quản lý 3.500 VĐV mà chỉ cần 3 người vận hành quầy racekit. Đội ngũ hỗ trợ luôn có mặt đúng lúc.',
      author: 'Trưởng BTC',
      org: 'Giải chạy phong trào',
      year: '2024',
    },
    {
      text: 'Từ khi dùng 5Pix, VĐV chia sẻ ảnh nhiều hơn 3 lần so với trước. Đây là marketing mà không tốn một đồng quảng cáo.',
      author: 'Marketing Lead',
      org: 'Sự kiện chạy đường dài',
      year: '2025',
    },
    {
      text: 'Dashboard của 5BIB cho phép tôi theo dõi doanh thu theo từng giờ, từ bất kỳ đâu. Không cần email, không cần gọi hỏi.',
      author: 'Founder',
      org: 'Race Series',
      year: '2025',
    },
  ];

  return (
    <section id="testimonials" className="sol-section sol-scroll-mt">
      <div className="sol-container">
        <Reveal>
          <div style={{ marginBottom: 48, maxWidth: '50ch' }}>
            <span className="sol-kicker">07 · Khách hàng nói</span>
            <h2 className="sol-h2" style={{ marginTop: 12, marginBottom: 12 }}>
              Họ đã tin tưởng.{' '}
              <span style={{ color: 'var(--sol-magenta)' }}>Và quay lại.</span>
            </h2>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {quotes.map((q, i) => (
            <Reveal key={q.author} delay={i * 80}>
              <article
                className="sol-card"
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--sol-font-display)',
                    fontSize: 56,
                    fontWeight: 900,
                    color: 'var(--sol-blue)',
                    lineHeight: 0.6,
                    marginBottom: 12,
                  }}
                >
                  &ldquo;
                </span>
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: 'var(--sol-text)',
                    fontWeight: 500,
                    flexGrow: 1,
                    margin: 0,
                  }}
                >
                  {q.text}
                </p>
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid var(--sol-border)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--sol-text)' }}>
                    {q.author}
                  </div>
                  <div style={{ color: 'var(--sol-text-muted)' }}>
                    {q.org} · {q.year}
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
/*  SolFinalCTA — Closing emotional                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export function SolFinalCTA() {
  return (
    <section
      className="sol-section"
      style={{
        background:
          'linear-gradient(135deg, var(--sol-blue) 0%, var(--sol-blue-700) 100%)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="sol-container" style={{ position: 'relative' }}>
        <Reveal>
          <h2
            className="sol-h2"
            style={{
              color: '#fff',
              maxWidth: '20ch',
              marginBottom: 24,
            }}
          >
            Hành trình của mỗi vận động viên bắt đầu từ một nút{' '}
            <span style={{ color: 'var(--sol-magenta)' }}>"Đăng ký."</span>
          </h2>
          <p
            className="sol-lead"
            style={{
              color: 'rgba(255,255,255,0.85)',
              maxWidth: '50ch',
              marginBottom: 32,
            }}
          >
            Từ tấm vé đầu tiên → kết quả trên result.5bib.com → tấm ảnh finish
            line trên 5Pix — chúng tôi ở đây ở mỗi bước.
          </p>
          <a
            href="#contact"
            className="sol-btn sol-btn-on-dark"
            style={{ padding: '18px 36px', fontSize: 16 }}
          >
            Liên hệ tư vấn ngay →
          </a>
        </Reveal>
      </div>
      <div
        className="sol-brand-stripe"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      >
        <span />
        <span />
      </div>
    </section>
  );
}
