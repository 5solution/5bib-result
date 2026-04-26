import { SolWordmark } from './sol-shared';

export function SolFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        background: 'var(--sol-navy)',
        color: 'rgba(255,255,255,0.72)',
        paddingTop: 56,
        paddingBottom: 32,
      }}
    >
      <div className="sol-container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 36,
            marginBottom: 40,
          }}
        >
          <div>
            <SolWordmark size={26} invert />
            <p style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)' }}>
              Hệ sinh thái giải pháp toàn diện cho ngành sự kiện thể thao Việt Nam.
            </p>
          </div>

          <FooterCol
            title="Sản phẩm"
            items={[
              { label: '5BIB · Race Result', href: 'https://solution.5bib.com' },
              { label: '5Sport · Cầu lông & Pickleball', href: 'https://solution.5sport.vn' },
              { label: '5Ticket · Concert', href: '#contact' },
              { label: '5Pix · AI Photo', href: '#contact' },
              { label: '5Tech · Outsourcing', href: '#contact' },
            ]}
          />

          <FooterCol
            title="Khám phá"
            items={[
              { label: 'Hệ sinh thái', href: '#ecosystem' },
              { label: 'Vì sao chọn', href: '#why' },
              { label: 'Đối tác', href: '#partners' },
              { label: 'Liên hệ tư vấn', href: '#contact' },
            ]}
          />

          <FooterCol
            title="Liên hệ"
            items={[
              { label: 'Hồ Gươm Plaza, Hà Nội', href: '#contact' },
              { label: '0986 587 345', href: 'tel:+84986587345' },
              { label: 'contact@5bib.com', href: 'mailto:contact@5bib.com' },
            ]}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 16,
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <span>
            © {year} Công ty Cổ phần 5BIB. Mọi quyền được bảo lưu.
          </span>
          <span>
            <a
              href="https://5bib.com"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              5bib.com
            </a>
            {' · '}
            <a
              href="https://solution.5bib.com"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              solution.5bib.com
            </a>
            {' · '}
            <a
              href="https://solution.5sport.vn"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              solution.5sport.vn
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          margin: '0 0 14px 0',
        }}
      >
        {title}
      </h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => (
          <li key={it.label}>
            <a
              href={it.href}
              style={{
                color: 'rgba(255,255,255,0.78)',
                textDecoration: 'none',
                fontSize: 14,
                transition: 'color 200ms',
              }}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
