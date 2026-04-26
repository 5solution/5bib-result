import { Reveal } from './sol-shared';

export function SolTrustBar() {
  return (
    <section
      className="sol-section sol-dots-bg"
      style={{ paddingTop: 'clamp(40px, 5vw, 64px)', paddingBottom: 'clamp(40px, 5vw, 64px)' }}
    >
      <div className="sol-container">
        <Reveal>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              padding: '20px 28px',
              background: '#fff',
              border: '1px solid var(--sol-border)',
              borderRadius: 16,
            }}
          >
            <div>
              <div
                className="sol-kicker"
                style={{ color: 'var(--sol-text-subtle)', marginBottom: 4 }}
              >
                Tin cậy bởi
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sol-text)' }}>
                BTC giải lớn nhất Việt Nam · Sponsor enterprise · Người chạy bộ
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 14,
                flexWrap: 'wrap',
                fontSize: 13,
                color: 'var(--sol-text-muted)',
                fontWeight: 600,
              }}
            >
              <span>VnExpress Marathon</span>
              <span>·</span>
              <span>Race Jungle</span>
              <span>·</span>
              <span>Color Run</span>
              <span>·</span>
              <span>UBND Cát Hải</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
