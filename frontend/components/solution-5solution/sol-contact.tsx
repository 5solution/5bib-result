import { Reveal, IPin, IPhone, IMail } from './sol-shared';
import { SolLeadForm } from './sol-lead-form';

export function SolContact() {
  return (
    <section
      id="contact"
      className="sol-section sol-scroll-mt"
      style={{
        background:
          'linear-gradient(180deg, var(--sol-surface) 0%, var(--sol-bg) 100%)',
      }}
    >
      <div className="sol-container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1fr) minmax(360px, 1.2fr)',
            gap: 'clamp(32px, 5vw, 72px)',
            alignItems: 'start',
          }}
        >
          <Reveal>
            <div>
              <span className="sol-kicker">05 · Liên hệ</span>
              <h2
                className="sol-h2"
                style={{ marginTop: 12, marginBottom: 20 }}
              >
                Sẵn sàng đồng hành cùng sự kiện của bạn.
              </h2>
              <p className="sol-lead" style={{ marginBottom: 36 }}>
                Một cuộc gọi 15 phút — bạn sẽ biết 5Solution có phù hợp với event
                của mình không.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  marginBottom: 36,
                }}
              >
                <ContactRow
                  icon={<IPin s={18} />}
                  title="Văn phòng"
                  detail="Tầng 9, Hồ Gươm Plaza, 102 Trần Phú, Hà Đông, Hà Nội"
                />
                <ContactRow
                  icon={<IPhone s={18} />}
                  title="Hotline"
                  detail="0986 587 345"
                  href="tel:+84986587345"
                />
                <ContactRow
                  icon={<IMail s={18} />}
                  title="Email"
                  detail="contact@5bib.com"
                  href="mailto:contact@5bib.com"
                />
              </div>

              <div
                style={{
                  padding: 20,
                  background: '#fff',
                  border: '1px solid var(--sol-border)',
                  borderRadius: 14,
                  fontSize: 14,
                  color: 'var(--sol-text-muted)',
                }}
              >
                <strong style={{ color: 'var(--sol-text)' }}>
                  Mr. Minh Nguyen Binh
                </strong>{' '}
                · Business Development
                <br />
                Phụ trách hợp tác BTC & sponsor enterprise.
              </div>
            </div>
          </Reveal>

          <SolLeadForm />
        </div>
      </div>
    </section>
  );
}

function ContactRow({
  icon,
  title,
  detail,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--sol-blue-50)',
          color: 'var(--sol-blue)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--sol-text-subtle)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--sol-text)',
            lineHeight: 1.4,
          }}
        >
          {detail}
        </div>
      </div>
    </div>
  );

  return href ? (
    <a
      href={href}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      {content}
    </a>
  ) : (
    content
  );
}
