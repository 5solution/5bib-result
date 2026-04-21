import type { Metadata } from 'next';
import ContactForm from './ContactForm';
import TimingEffects from './TimingEffects';

export const metadata: Metadata = {
  title: '5BIB Timing — Dịch vụ bấm giờ chip chuyên nghiệp',
  description:
    'Chip timing RaceResult (Đức) · 100+ giải đã triển khai · 94,000+ VĐV · Báo giá 24h. Liên hệ info@5bib.com.',
};

const Logo = () => (
  <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="34" height="34" rx="9" fill="#2B5EE8" />
    <text
      x="17"
      y="23"
      textAnchor="middle"
      fontFamily="Be Vietnam Pro,sans-serif"
      fontWeight={900}
      fontSize={13}
      fill="white"
    >
      5BIB
    </text>
  </svg>
);

export default function TimingLandingPage() {
  return (
    <>
      <TimingEffects />

      {/* NAV */}
      <nav className="tl-nav">
        <div className="tl-nav-inner">
          <div className="tl-nav-logo">
            <Logo />
            5BIB Timing
          </div>
          <ul className="tl-nav-links">
            <li>
              <a href="#why">Tại sao chọn 5BIB</a>
            </li>
            <li>
              <a href="#process">Quy trình</a>
            </li>
            <li>
              <a href="#packages">Gói dịch vụ</a>
            </li>
            <li>
              <a href="#tech">Công nghệ</a>
            </li>
            <li>
              <a href="#contact" className="tl-nav-cta">
                Nhận báo giá
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* HERO */}
      <section className="tl-hero">
        <video
          className="tl-hero-video-bg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster=""
        >
          <source src="/timing/hero-5bib.mp4" type="video/mp4" media="(min-width: 768px)" />
          <source src="/timing/hero-5bib-mobile.mp4" type="video/mp4" />
        </video>
        <div className="tl-hero-overlay" />
        <div className="tl-hero-grain" />

        <div className="tl-hero-inner">
          <div>
            <div className="tl-hero-eyebrow">
              <span className="tl-badge">🏅 Chip Timing Professional</span>
              <span className="tl-badge tl-badge-pink">RaceResult Certified</span>
            </div>
            <h1>
              100+ giải. 94,000+ VĐV.
              <br />
              <span className="tl-accent">Đội ngũ bấm giờ chip</span>
              <br />
              hàng đầu Việt Nam.
            </h1>
            <p className="tl-hero-sub">
              Từ 2020 đến nay, 5BIB là nhà vận hành chip timing tin cậy của các BTC lớn nhất
              Việt Nam — công nghệ RaceResult (Đức), nhân sự thực chiến, giá cả minh bạch.
            </p>
            <div className="tl-hero-actions">
              <a href="#contact" className="tl-btn-primary">
                📋 Nhận báo giá ngay
              </a>
              <a
                href="#packages"
                className="tl-btn-outline"
                style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
              >
                Xem gói dịch vụ
              </a>
            </div>
            <div className="tl-hero-stats">
              <div>
                <div className="tl-hero-stat-num">
                  <span className="tl-counter" data-target="100" data-suffix="+">
                    100+
                  </span>
                </div>
                <div className="tl-hero-stat-label">Giải đã bấm giờ</div>
              </div>
              <div>
                <div className="tl-hero-stat-num">
                  <span className="tl-counter" data-target="94" data-suffix="K+">
                    94K+
                  </span>
                </div>
                <div className="tl-hero-stat-label">Vận động viên</div>
              </div>
              <div>
                <div className="tl-hero-stat-num">0.01s</div>
                <div className="tl-hero-stat-label">Độ chính xác</div>
              </div>
            </div>
          </div>

          <div className="tl-hero-visual">
            <div className="tl-hero-card">
              <div className="tl-hero-card-header">
                <div className="tl-hero-card-icon">🏃</div>
                <div>
                  <div className="tl-hero-card-title">
                    VTV LPBank 2025 – Nhịp điệu xuyên thời gian
                  </div>
                  <div className="tl-hero-card-subtitle">7,196 VĐV hoàn thành · 3 cự ly</div>
                </div>
              </div>
              {[
                { rank: 1, name: 'GLADY KIPTOO', bib: '#92976 · 🇰🇪 Kenya', time: '1:14:56', cat: 'M31-40' },
                { rank: 2, name: 'Nguyễn Quốc Anh', bib: '#90008 · 🇻🇳 VN', time: '1:15:34', cat: 'OPEN M' },
                { rank: 3, name: 'Đào Bá Thành', bib: '#92433 · 🇻🇳 VN', time: '1:16:46', cat: 'M U30' },
                { rank: 4, name: 'Trương Văn Quân', bib: '#90118 · 🇻🇳 VN', time: '1:18:44', cat: 'M31-40' },
              ].map((r) => (
                <div key={r.rank} className="tl-hero-result-row">
                  <div className="tl-result-rank">{r.rank}</div>
                  <div>
                    <div className="tl-result-name">{r.name}</div>
                    <div className="tl-result-bib">{r.bib}</div>
                  </div>
                  <div className="tl-result-time">{r.time}</div>
                  <div className="tl-result-cat">{r.cat}</div>
                </div>
              ))}
            </div>
            <div className="tl-hero-badge-float">
              <span className="big">⚡</span>
              Kết quả live
              <br />
              realtime
            </div>
          </div>
        </div>

        <div className="tl-hero-scroll">
          <div className="tl-hero-scroll-dot" />
          Scroll
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="tl-trust-bar">
        <div className="tl-trust-inner">
          <div className="tl-trust-item">
            <span className="tl-trust-icon">📡</span> RaceResult Decoder (Đức)
          </div>
          <div className="tl-trust-item">
            <span className="tl-trust-icon">🏅</span> 100+ giải tại Việt Nam
          </div>
          <div className="tl-trust-item">
            <span className="tl-trust-icon">👥</span> 94,000+ VĐV đã bấm giờ
          </div>
          <div className="tl-trust-item">
            <span className="tl-trust-icon">🎯</span> Độ chính xác 0.01 giây
          </div>
          <div className="tl-trust-item">
            <span className="tl-trust-icon">🔄</span> Multi-read redundancy
          </div>
          <div className="tl-trust-item">
            <span className="tl-trust-icon">📱</span> Kết quả live realtime
          </div>
        </div>
      </div>

      {/* WHY */}
      <section className="tl-why" id="why">
        <div className="tl-container">
          <div className="tl-why-head">
            <div className="tl-section-label">Tại sao chọn 5BIB</div>
            <h2 className="tl-section-title">
              Kinh nghiệm. Công nghệ.
              <br />
              Giá cả minh bạch.
            </h2>
            <p className="tl-section-sub" style={{ margin: '0 auto' }}>
              Ba yếu tố cốt lõi khiến BTC tin tưởng giao phó giải chạy cho đội ngũ 5BIB.
            </p>
          </div>
          <div className="tl-why-grid">
            <div className="tl-why-card">
              <div className="tl-why-icon">🏆</div>
              <div className="tl-why-card-title">Bề dày kinh nghiệm thực chiến</div>
              <div className="tl-why-card-body">
                Đã triển khai bấm giờ cho hơn 100 giải chạy tại Việt Nam — từ giải địa phương vài
                trăm VĐV đến các sự kiện quy mô quốc gia hàng chục nghìn người. Không có giải nào
                là thử nghiệm với đội ngũ 5BIB.
              </div>
              <div className="tl-why-card-stat">
                100+<span>giải đã triển khai thành công</span>
              </div>
            </div>
            <div className="tl-why-card">
              <div className="tl-why-icon">⚙️</div>
              <div className="tl-why-card-title">Công nghệ RaceResult hàng đầu thế giới</div>
              <div className="tl-why-card-body">
                Thiết bị RaceResult Decoder nhập khẩu từ Đức — chuẩn công nghệ của các giải
                marathon quốc tế lớn. Chip RFID thụ động, độ chính xác 0.01 giây, hệ thống
                multi-read đảm bảo không bỏ sót một VĐV nào.
              </div>
              <div className="tl-why-card-stat">
                0.01s<span>độ chính xác đạt chuẩn quốc tế</span>
              </div>
            </div>
            <div className="tl-why-card">
              <div className="tl-why-icon">💰</div>
              <div className="tl-why-card-title">Giá cả phải chăng, minh bạch</div>
              <div className="tl-why-card-body">
                Chi phí hợp lý, không phát sinh ẩn. Gói dịch vụ rõ ràng từ cơ bản đến toàn diện —
                phù hợp với mọi quy mô giải và ngân sách BTC. Báo giá trong vòng 24 giờ.
              </div>
              <div className="tl-why-card-stat">
                3 gói<span>linh hoạt theo quy mô giải</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="tl-process" id="process">
        <div className="tl-container">
          <div className="tl-process-head">
            <div className="tl-section-label">Quy trình làm việc</div>
            <h2 className="tl-section-title">5 bước — từ tư vấn đến kết quả chính thức</h2>
            <p className="tl-section-sub" style={{ margin: '0 auto' }}>
              Quy trình chuyên nghiệp, minh bạch. BTC luôn biết 5BIB đang ở bước nào.
            </p>
          </div>
          <div className="tl-process-steps">
            {[
              {
                icon: '📋',
                title: 'Tư vấn & Báo giá',
                body: 'Khảo sát cung đường, số VĐV, yêu cầu kỹ thuật — báo giá chi tiết trong 24h',
              },
              {
                icon: '🏷️',
                title: 'Chuẩn bị BIB & Chip',
                body: 'In BIB, gắn chip RFID, kiểm tra từng chip trước ngày thi đấu',
              },
              {
                icon: '📡',
                title: 'Lắp đặt Decoder',
                body: 'Lắp thiết bị tại start, finish và các checkpoint. Test toàn bộ hệ thống trước race',
              },
              {
                icon: '⚡',
                title: 'Bấm giờ Live',
                body: 'Ghi nhận thời gian thực từng VĐV qua start/finish, publish kết quả live trên result.5bib.com',
              },
              {
                icon: '📊',
                title: 'Kết quả chính thức',
                body: 'Xuất bảng xếp hạng đầy đủ, file Excel, kết nối Strava — bàn giao cho BTC trong 2h sau finish',
              },
            ].map((s, i) => (
              <div key={i} className="tl-step-item">
                <div className="tl-step-num">{s.icon}</div>
                <div className="tl-step-title">{s.title}</div>
                <div className="tl-step-body">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PACKAGES */}
      <section className="tl-packages" id="packages">
        <div className="tl-container">
          <div className="tl-packages-head">
            <div className="tl-section-label">Gói dịch vụ</div>
            <h2 className="tl-section-title">Báo giá linh hoạt theo quy mô</h2>
            <p className="tl-section-sub" style={{ margin: '0 auto' }}>
              Mọi gói đều bao gồm thiết bị RaceResult, nhân sự kỹ thuật chuyên nghiệp và trang kết
              quả 5BIB.
            </p>
          </div>

          <div className="tl-pkg-includes">
            <div className="tl-pkg-includes-label">✅ Tất cả gói dịch vụ đều bao gồm:</div>
            <div className="tl-pkg-include-item">Chip RFID thụ động gắn BIB</div>
            <div className="tl-pkg-include-item">Thiết bị RaceResult Decoder</div>
            <div className="tl-pkg-include-item">Nhân sự kỹ thuật tại hiện trường</div>
            <div className="tl-pkg-include-item">Trang kết quả result.5bib.com</div>
            <div className="tl-pkg-include-item">Kết quả live realtime</div>
            <div className="tl-pkg-include-item">Xuất Excel sau giải</div>
            <div className="tl-pkg-include-item">Hỗ trợ kỹ thuật 24/7</div>
          </div>

          <div className="tl-pkg-grid">
            {/* Basic */}
            <div className="tl-pkg-card">
              <div className="tl-pkg-name">Basic</div>
              <div className="tl-pkg-price">
                Liên hệ <span className="tl-unit">/ giải</span>
              </div>
              <div className="tl-pkg-desc">
                Dành cho giải quy mô nhỏ đến trung bình, 1 cự ly, cung đường đơn giản.
              </div>
              <ul className="tl-pkg-features">
                <li><span className="tl-check">✓</span> Tối đa 1,000 VĐV</li>
                <li><span className="tl-check">✓</span> 1–2 cự ly</li>
                <li><span className="tl-check">✓</span> 1 start, 1 finish</li>
                <li><span className="tl-check">✓</span> Kết quả live &amp; bảng xếp hạng</li>
                <li><span className="tl-check">✓</span> Xuất file Excel</li>
                <li><span className="tl-check">✓</span> Hỗ trợ ngày race</li>
              </ul>
              <a href="#contact" className="tl-pkg-cta" style={{ display: 'block', textAlign: 'center' }}>
                Nhận báo giá
              </a>
            </div>

            {/* Advanced */}
            <div className="tl-pkg-card featured">
              <div className="tl-pkg-popular-badge">Phổ biến nhất</div>
              <div className="tl-pkg-name">Advanced</div>
              <div className="tl-pkg-price">
                Liên hệ <span className="tl-unit">/ giải</span>
              </div>
              <div className="tl-pkg-desc">
                Phù hợp giải lớn nhiều cự ly, cần split time và phân tích sâu cho VĐV.
              </div>
              <ul className="tl-pkg-features">
                <li><span className="tl-check">✓</span> Tối đa 5,000 VĐV</li>
                <li><span className="tl-check">✓</span> Nhiều cự ly, nhiều nhóm tuổi</li>
                <li><span className="tl-check">✓</span> Nhiều checkpoint, split time</li>
                <li><span className="tl-check">✓</span> Pace analysis từng km</li>
                <li><span className="tl-check">✓</span> Rank progression chart</li>
                <li><span className="tl-check">✓</span> Share card cá nhân hóa</li>
                <li><span className="tl-check">✓</span> Kết nối Strava tự động</li>
              </ul>
              <a href="#contact" className="tl-pkg-cta" style={{ display: 'block', textAlign: 'center' }}>
                Nhận báo giá
              </a>
            </div>

            {/* Professional */}
            <div className="tl-pkg-card">
              <div className="tl-pkg-name">Professional</div>
              <div className="tl-pkg-price">
                Liên hệ <span className="tl-unit">/ giải</span>
              </div>
              <div className="tl-pkg-desc">
                Giải quy mô quốc gia, VIP timing, yêu cầu đặc biệt về kỹ thuật và truyền thông.
              </div>
              <ul className="tl-pkg-features">
                <li><span className="tl-check">✓</span> Không giới hạn VĐV</li>
                <li><span className="tl-check">✓</span> Tất cả tính năng Advanced</li>
                <li><span className="tl-check">✓</span> Branding BTC trên trang kết quả</li>
                <li><span className="tl-check">✓</span> Live leaderboard display</li>
                <li><span className="tl-check">✓</span> Tích hợp 5Pix AI photo matching</li>
                <li><span className="tl-check">✓</span> Tích hợp 5BIB App athlete profile</li>
                <li><span className="tl-check">✓</span> Project Manager chuyên trách</li>
              </ul>
              <a href="#contact" className="tl-pkg-cta" style={{ display: 'block', textAlign: 'center' }}>
                Nhận báo giá
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SHOWCASE */}
      <section className="tl-showcase" id="result">
        <div className="tl-container">
          <div className="tl-showcase-inner">
            <div>
              <div className="tl-section-label">Trang kết quả 5BIB</div>
              <h2 className="tl-section-title">
                Kết quả đẹp nhất,
                <br />
                VĐV tự hào chia sẻ
              </h2>
              <p className="tl-section-sub">
                Không chỉ bấm giờ — 5BIB cung cấp trang kết quả chuyên nghiệp tại result.5bib.com,
                nơi VĐV có thể xem lại hành trình của mình sau mỗi giải.
              </p>
              <div className="tl-showcase-features">
                <div className="tl-showcase-feat">
                  <div className="tl-sf-icon">⏱️</div>
                  <div>
                    <div className="tl-sf-title">Split time &amp; Pace từng km</div>
                    <div className="tl-sf-body">
                      Phân tích tốc độ theo từng đoạn đường, biểu đồ pace trực quan
                    </div>
                  </div>
                </div>
                <div className="tl-showcase-feat">
                  <div className="tl-sf-icon">📈</div>
                  <div>
                    <div className="tl-sf-title">Rank Progression Chart</div>
                    <div className="tl-sf-body">
                      VĐV theo dõi thứ hạng biến đổi qua từng checkpoint
                    </div>
                  </div>
                </div>
                <div className="tl-showcase-feat">
                  <div className="tl-sf-icon">🃏</div>
                  <div>
                    <div className="tl-sf-title">Share Card cá nhân hóa</div>
                    <div className="tl-sf-body">
                      Thiết kế đẹp, VĐV tự hào đăng Facebook/Instagram — viral tự nhiên cho BTC
                    </div>
                  </div>
                </div>
                <div className="tl-showcase-feat">
                  <div className="tl-sf-icon">🌐</div>
                  <div>
                    <div className="tl-sf-title">Kết nối Strava tự động</div>
                    <div className="tl-sf-body">
                      Kết quả tự động sync về Strava của VĐV sau khi giải kết thúc
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="tl-mockup-window">
              <div className="tl-mockup-bar">
                <div className="tl-dot tl-dot-r" />
                <div className="tl-dot tl-dot-y" />
                <div className="tl-dot tl-dot-g" />
                <div className="tl-mockup-url">result.5bib.com/vtv-lpbank-hue-2024</div>
              </div>
              <div className="tl-mockup-body">
                <div className="tl-mockup-header">
                  <div>
                    <div className="tl-mockup-race-name">
                      VTV LPBank 2025 – Nhịp điệu xuyên thời gian
                    </div>
                    <div className="tl-mockup-meta">
                      15–16/08/2025 · Đại Lải, Vĩnh Phúc · 7,196 VĐV
                    </div>
                  </div>
                  <span className="tl-badge tl-badge-pink">LIVE ●</span>
                </div>
                <div className="tl-mockup-filters">
                  <div className="tl-mf-pill active">21KM</div>
                  <div className="tl-mf-pill">10KM</div>
                  <div className="tl-mf-pill">6.8KM</div>
                </div>
                <table className="tl-mockup-table">
                  <thead>
                    <tr>
                      <th>Hạng</th>
                      <th>Tên VĐV</th>
                      <th>Thành tích</th>
                      <th>Nhóm</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="tl-td-rank">#1</td>
                      <td>GLADY KIPTOO 🇰🇪</td>
                      <td className="tl-td-time">1:14:56</td>
                      <td className="tl-td-cat">M31-40</td>
                    </tr>
                    <tr>
                      <td className="tl-td-rank">#2</td>
                      <td>Nguyễn Quốc Anh</td>
                      <td className="tl-td-time">1:15:34</td>
                      <td className="tl-td-cat">OPEN M</td>
                    </tr>
                    <tr>
                      <td className="tl-td-rank">#3</td>
                      <td>Đào Bá Thành</td>
                      <td className="tl-td-time">1:16:46</td>
                      <td className="tl-td-cat">M U30</td>
                    </tr>
                    <tr>
                      <td className="tl-td-rank">#4</td>
                      <td>Trương Văn Quân</td>
                      <td className="tl-td-time">1:18:44</td>
                      <td className="tl-td-cat">M31-40</td>
                    </tr>
                    <tr>
                      <td className="tl-td-rank">#5 ♀</td>
                      <td>Phạm Thị Hồng Lệ</td>
                      <td className="tl-td-time">1:21:21</td>
                      <td className="tl-td-cat">F U30</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="tl-proof" id="proof">
        <div className="tl-container">
          <div className="tl-proof-head">
            <div className="tl-section-label">Thực tế chứng minh</div>
            <h2 className="tl-section-title">Con số nói lên tất cả</h2>
            <p className="tl-section-sub">
              Từ 2020 đến nay, 5BIB là nhà vận hành chip timing tin cậy của các BTC lớn nhất Việt
              Nam.
            </p>
          </div>
          <div className="tl-stats-grid">
            <div className="tl-stat-box">
              <div className="tl-stat-num">100+</div>
              <div className="tl-stat-label">Giải chạy đã bấm giờ</div>
            </div>
            <div className="tl-stat-box">
              <div className="tl-stat-num">94K+</div>
              <div className="tl-stat-label">VĐV đã được bấm giờ</div>
            </div>
            <div className="tl-stat-box">
              <div className="tl-stat-num">50+</div>
              <div className="tl-stat-label">BTC &amp; đối tác doanh nghiệp</div>
            </div>
            <div className="tl-stat-box">
              <div className="tl-stat-num">0</div>
              <div className="tl-stat-label">Sự cố mất dữ liệu</div>
            </div>
          </div>
        </div>
      </section>

      {/* TECH */}
      <section className="tl-tech" id="tech">
        <div className="tl-container">
          <div className="tl-tech-inner">
            <div>
              <div className="tl-section-label">Công nghệ</div>
              <h2 className="tl-section-title">
                RaceResult — Thiết bị bấm giờ chuẩn quốc tế
              </h2>
              <p className="tl-section-sub">
                5BIB đầu tư và vận hành thiết bị RaceResult Decoder nhập khẩu từ Đức — công nghệ
                đang được sử dụng tại các marathon hàng đầu thế giới.
              </p>
              <div className="tl-tech-specs">
                {[
                  { icon: '📡', label: 'Thiết bị', val: 'RaceResult Decoder — Made in Germany' },
                  { icon: '🏷️', label: 'Chip', val: 'RFID Passive — gắn sau BIB, siêu nhẹ' },
                  { icon: '🎯', label: 'Độ chính xác', val: '0.01 giây — đạt chuẩn AIMS/WA' },
                  { icon: '🔋', label: 'Pin & Kết nối', val: '15Ah battery · 4G + GPS built-in' },
                  { icon: '🔄', label: 'Độ tin cậy', val: 'Multi-read redundancy — không bỏ sót VĐV' },
                  { icon: '💻', label: 'Phần mềm', val: 'Race Result 14 — phần mềm bấm giờ chuyên dụng' },
                ].map((s, i) => (
                  <div key={i} className="tl-spec-row">
                    <div className="tl-spec-icon">{s.icon}</div>
                    <div>
                      <div className="tl-spec-label">{s.label}</div>
                      <div className="tl-spec-val">{s.val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="tl-tech-visual">
              <div className="tl-tech-device">
                <div className="tl-tech-device-icon">📡</div>
                <div className="tl-tech-device-name">RaceResult Active Decoder</div>
                <div className="tl-tech-device-desc">
                  Thiết bị đọc chip RFID công suất cao
                  <br />
                  Phủ sóng 10m, đọc 1,000+ chip/giây
                  <br />
                  4G + GPS tích hợp, pin 15Ah
                </div>
              </div>
              <div className="tl-tech-chips">
                <div className="tl-tech-chip-item">
                  <strong>0.01s</strong>Độ chính xác
                </div>
                <div className="tl-tech-chip-item">
                  <strong>10m</strong>Phủ sóng đọc
                </div>
                <div className="tl-tech-chip-item">
                  <strong>1000+</strong>Chip/giây
                </div>
                <div className="tl-tech-chip-item">
                  <strong>15Ah</strong>Battery life
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ECOSYSTEM */}
      <section className="tl-ecosystem" id="ecosystem">
        <div className="tl-container">
          <div className="tl-eco-head">
            <div className="tl-section-label">Hệ sinh thái 5BIB</div>
            <h2 className="tl-section-title">
              Không chỉ bấm giờ —<br />
              Trải nghiệm toàn diện cho VĐV
            </h2>
            <p className="tl-section-sub" style={{ margin: '0 auto' }}>
              5BIB Timing là trung tâm kết nối với toàn bộ hệ sinh thái 5BIB — mang lại giá trị
              vượt trội cho cả BTC và VĐV.
            </p>
          </div>
          <div className="tl-eco-grid">
            <div className="tl-eco-card">
              <div className="tl-eco-icon">📱</div>
              <div className="tl-eco-title">5BIB App</div>
              <div className="tl-eco-sub">Hồ sơ vận động viên</div>
              <div className="tl-eco-desc">
                120,000+ VĐV đã có hồ sơ cá nhân. Lịch sử giải, thành tích, cộng đồng running.
              </div>
            </div>
            <div className="tl-eco-arrow">→</div>
            <div className="tl-eco-card highlight">
              <div className="tl-eco-icon">⏱️</div>
              <div className="tl-eco-title">5BIB Timing</div>
              <div className="tl-eco-sub">Dịch vụ bấm giờ chip</div>
              <div className="tl-eco-desc">
                Bấm giờ chính xác bằng RaceResult, kết quả live, trang result đẹp — trọn gói.
              </div>
            </div>
            <div className="tl-eco-arrow">→</div>
            <div className="tl-eco-card">
              <div className="tl-eco-icon">📸</div>
              <div className="tl-eco-title">5Pix</div>
              <div className="tl-eco-sub">AI photo matching</div>
              <div className="tl-eco-desc">
                Tự động ghép ảnh VĐV bằng AI nhận diện khuôn mặt + số BIB. VĐV nhận ảnh trong vài
                phút.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="tl-contact" id="contact">
        <div className="tl-container">
          <div className="tl-contact-inner">
            <div className="tl-contact-info">
              <div className="tl-section-label">Liên hệ</div>
              <div className="tl-contact-tagline">Sẵn sàng hỗ trợ giải của bạn</div>
              <p className="tl-contact-body">
                Điền thông tin — đội ngũ 5BIB sẽ liên hệ trong vòng 24 giờ với báo giá chi tiết và
                tư vấn phù hợp nhất cho quy mô giải của bạn.
              </p>
              <ul className="tl-contact-points">
                <li>
                  <span className="tl-cp-icon">📧</span> info@5bib.com
                </li>
                <li>
                  <span className="tl-cp-icon">📞</span> 0373 398 986
                </li>
                <li>
                  <span className="tl-cp-icon">🏢</span> TP. Hồ Chí Minh &amp; Hà Nội
                </li>
                <li>
                  <span className="tl-cp-icon">🕐</span> Phản hồi báo giá trong 24 giờ
                </li>
                <li>
                  <span className="tl-cp-icon">🤝</span> Tư vấn miễn phí, không ràng buộc
                </li>
              </ul>
            </div>
            <ContactForm />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="tl-footer">
        <div className="tl-container">
          <div className="tl-footer-inner">
            <div className="tl-footer-brand">
              <div className="tl-footer-logo">
                <Logo />
                5BIB Timing
              </div>
              <p className="tl-footer-desc">
                Dịch vụ bấm giờ chip chuyên nghiệp cho giải chạy tại Việt Nam. Công nghệ
                RaceResult (Đức), đội ngũ giàu kinh nghiệm, giá cả phải chăng.
              </p>
            </div>
            <div>
              <div className="tl-footer-col-title">Dịch vụ</div>
              <ul className="tl-footer-links">
                <li><a href="#packages">Gói Basic</a></li>
                <li><a href="#packages">Gói Advanced</a></li>
                <li><a href="#packages">Gói Professional</a></li>
                <li><a href="#contact">Báo giá</a></li>
              </ul>
            </div>
            <div>
              <div className="tl-footer-col-title">Sản phẩm</div>
              <ul className="tl-footer-links">
                <li><a href="https://5bib.com" target="_blank" rel="noopener">5BIB App</a></li>
                <li><a href="https://result.5bib.com" target="_blank" rel="noopener">result.5bib.com</a></li>
                <li><a href="#">timing.5bib.com</a></li>
                <li><a href="#">5Pix</a></li>
              </ul>
            </div>
            <div>
              <div className="tl-footer-col-title">Liên hệ</div>
              <ul className="tl-footer-links">
                <li><a href="mailto:info@5bib.com">info@5bib.com</a></li>
                <li><a href="https://www.facebook.com/5bibapp" target="_blank" rel="noopener">Facebook 5BIB</a></li>
                <li><a href="#contact">Nhận báo giá</a></li>
              </ul>
            </div>
          </div>
          <div className="tl-footer-bottom">
            <div>© {new Date().getFullYear()} 5BIB. Dịch vụ bấm giờ chip chuyên nghiệp tại Việt Nam.</div>
            <div>Powered by RaceResult Technology 🇩🇪</div>
          </div>
        </div>
      </footer>
    </>
  );
}
