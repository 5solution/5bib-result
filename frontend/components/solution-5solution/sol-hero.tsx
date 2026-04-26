import { Reveal } from './sol-shared';

export function SolHero() {
  return (
    <section
      id="top"
      className="sol-cover-slash sol-scroll-mt"
      style={{
        position: 'relative',
        minHeight: '100vh',
        paddingTop: 'clamp(120px, 18vh, 220px)',
        paddingBottom: 'clamp(80px, 12vh, 160px)',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      <div className="sol-container" style={{ position: 'relative' }}>
        <Reveal delay={60}>
          <span className="sol-pill sol-pill-on-dark" style={{ marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, background: '#fff', borderRadius: 9999 }} />
            5Solution Ecosystem · 2025
          </span>
        </Reveal>

        <Reveal delay={120}>
          <h1
            className="sol-h1"
            style={{
              color: '#fff',
              maxWidth: '14ch',
              marginBottom: 24,
            }}
          >
            Một nền tảng.
            <br />
            <span style={{ color: 'var(--sol-magenta)' }}>Toàn bộ</span> hành trình.
          </h1>
        </Reveal>

        <Reveal delay={200}>
          <p
            className="sol-lead"
            style={{
              color: 'rgba(255,255,255,0.78)',
              maxWidth: '52ch',
              marginBottom: 36,
            }}
          >
            Giải pháp toàn diện cho ngành sự kiện thể thao Việt Nam — bán vé, chip
            timing, kết quả live, ảnh AI và phần mềm vận hành. Năm sản phẩm. Một
            hệ sinh thái.
          </p>
        </Reveal>

        <Reveal delay={280}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              alignItems: 'center',
            }}
          >
            <a href="#contact" className="sol-btn sol-btn-magenta">
              Liên hệ tư vấn ngay →
            </a>
            <a href="#ecosystem" className="sol-btn sol-btn-ghost-on-dark">
              Khám phá hệ sinh thái
            </a>
          </div>
        </Reveal>

        <Reveal delay={420}>
          <div
            style={{
              marginTop: 'clamp(56px, 9vh, 112px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'clamp(20px, 3vw, 40px)',
              maxWidth: 880,
            }}
          >
            {[
              { num: '195+', label: 'sự kiện đã chạy' },
              { num: '94K+', label: 'vận động viên' },
              { num: '58+', label: 'đối tác BTC' },
              { num: '200K+', label: 'lượt giao dịch' },
            ].map((s) => (
              <div key={s.label}>
                <div
                  className="sol-stat-num"
                  style={{ color: '#fff', fontSize: 'clamp(32px, 4.5vw, 56px)' }}
                >
                  {s.num}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.62)',
                    fontWeight: 500,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Brand stripe at bottom */}
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
