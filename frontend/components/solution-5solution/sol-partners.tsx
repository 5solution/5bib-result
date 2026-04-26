import { Reveal } from './sol-shared';

const PARTNERS = [
  'VNPAY',
  'VPBank',
  'VietinBank',
  'Vietcombank',
  'Agribank',
  'BIDV',
  'Race Jungle',
  'Great Race Solution',
  'TNG',
  'UBND Cát Hải',
  'VnExpress Marathon',
  'Color Run',
];

export function SolPartners() {
  return (
    <section id="partners" className="sol-section sol-scroll-mt">
      <div className="sol-container">
        <Reveal>
          <div
            style={{
              marginBottom: 48,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 24,
            }}
          >
            <div style={{ maxWidth: '50ch' }}>
              <span className="sol-kicker">04 · Đối tác</span>
              <h2 className="sol-h2" style={{ marginTop: 12, marginBottom: 16 }}>
                58+ thương hiệu đồng hành.
              </h2>
              <p className="sol-lead">
                Từ ngân hàng quốc dân, tổ chức BTC race lớn nhất Việt Nam, đến UBND
                các tỉnh — họ đã tin và chạy cùng 5Solution.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {PARTNERS.map((p) => (
              <div key={p} className="sol-wordmark">
                {p}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
