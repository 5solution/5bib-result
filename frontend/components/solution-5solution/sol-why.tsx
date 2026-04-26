import { Reveal } from './sol-shared';

const REASONS = [
  {
    num: '01',
    title: 'All-in-one — không cần ghép 5 vendor',
    desc: 'Bán vé, chip timing, ảnh AI, kết quả live, marketing — tất cả ở một nơi. BTC chỉ ký một hợp đồng, làm việc với một đầu mối.',
  },
  {
    num: '02',
    title: 'Sẵn sàng quy mô lớn',
    desc: '99.9% uptime · <1s response · 50.000+ req/s. Đã chạy 195 sự kiện với 94K+ VĐV — không lo crash ngày race day.',
  },
  {
    num: '03',
    title: 'Made for Vietnam',
    desc: 'Tích hợp VNPAY, các bank Việt, ngôn ngữ Việt, SLA giờ Việt. Không phải SaaS dịch máy.',
  },
];

export function SolWhy() {
  return (
    <section
      id="why"
      className="sol-section sol-scroll-mt"
      style={{ background: 'var(--sol-surface-2)' }}
    >
      <div className="sol-container">
        <Reveal>
          <div style={{ marginBottom: 56, maxWidth: '50ch' }}>
            <span className="sol-kicker">03 · Vì sao chọn 5Solution</span>
            <h2 className="sol-h2" style={{ marginTop: 12, marginBottom: 16 }}>
              Ba lý do BTC đầu ngành đã chọn{' '}
              <span style={{ color: 'var(--sol-magenta)' }}>5Solution</span>.
            </h2>
            <p className="sol-lead">
              Không phải vì rẻ. Vì đáng tin và vận hành mượt.
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(20px, 3vw, 36px)',
          }}
        >
          {REASONS.map((r, idx) => (
            <Reveal key={r.num} delay={idx * 100}>
              <article
                className="sol-card"
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <span className="sol-num-badge" style={{ marginBottom: 24 }}>
                  {r.num}
                </span>
                <h3 className="sol-h3" style={{ marginBottom: 12 }}>
                  {r.title}
                </h3>
                <p className="sol-body" style={{ margin: 0 }}>
                  {r.desc}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
