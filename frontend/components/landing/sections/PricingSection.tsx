import type { SectionProps } from '../types';
import styles from './pricing.module.css';

/** FEATURE-083 — Pricing / ticket tiers section (deep-link CTA only, NO purchase form). */

interface PricingCta {
  label?: string;
  href?: string;
}

interface PricingTier {
  name?: string;
  sub?: string;
  price?: number;
  compareAtPrice?: number;
  earlyBirdLabel?: string;
  includes?: string[];
  cta?: PricingCta;
  featured?: boolean;
}

interface PricingData {
  kicker?: string;
  title?: string;
  lead?: string;
  note?: string;
  tiers?: PricingTier[];
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('vi-VN');
}

export default function PricingSection({ section }: SectionProps) {
  const d = section.data as PricingData;
  const tiers = Array.isArray(d.tiers) ? d.tiers : [];

  const kicker = d.kicker?.trim() || 'Vé · Đăng ký';
  const note = d.note?.trim() || 'Thanh toán an toàn qua cổng 5bib.com';

  return (
    <section
      className="landing-sec"
      id={section.anchor || 'pricing'}
      data-section="pricing"
    >
      <div className={styles.bg} aria-hidden="true" />
      <div className="landing-shell">
        <span className="landing-kicker">{kicker}</span>
        {d.title ? (
          <h2 className="landing-h2">{d.title}</h2>
        ) : (
          <h2 className="landing-h2">
            Chọn <em>cự ly của bạn</em>
          </h2>
        )}
        {d.lead ? <p className="landing-lead">{d.lead}</p> : null}

        {tiers.length === 0 ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7h18M3 7l1.5 12.5A2 2 0 0 0 6.5 21h11a2 2 0 0 0 2-1.5L21 7M3 7l2-4h14l2 4M9 11v6M15 11v6" />
            </svg>
            <p>Bảng giá vé đang được cập nhật. Vui lòng quay lại sau.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {tiers.map((t, i) => {
              const name = t.name?.trim() || `Cự ly ${i + 1}`;
              const hasPrice =
                typeof t.price === 'number' && Number.isFinite(t.price);
              const hasCompare =
                typeof t.compareAtPrice === 'number' &&
                Number.isFinite(t.compareAtPrice);
              const includes = Array.isArray(t.includes)
                ? t.includes.filter((x) => typeof x === 'string' && x.trim())
                : [];
              const ctaLabel = t.cta?.label?.trim() || 'Đăng ký';
              const ctaHref = t.cta?.href?.trim();

              return (
                <article
                  key={i}
                  className={`${styles.card} ${t.featured ? styles.feat : ''}`}
                >
                  {t.featured ? (
                    <span className={styles.pop}>Phổ biến nhất</span>
                  ) : null}

                  <div className={styles.dist}>
                    {name}
                    {t.sub ? <span>{t.sub}</span> : null}
                  </div>

                  {hasCompare ? (
                    <div className={styles.old}>
                      {formatPrice(t.compareAtPrice as number)}đ
                    </div>
                  ) : null}

                  {hasPrice ? (
                    <div className={styles.now}>
                      <b>{formatPrice(t.price as number)}</b>
                      <span className={styles.cur}>đ</span>
                    </div>
                  ) : (
                    <div className={styles.now}>
                      <b className={styles.tba}>Liên hệ</b>
                    </div>
                  )}

                  {t.earlyBirdLabel?.trim() ? (
                    <span className={styles.eb}>
                      <span className={styles.dot}>●</span>
                      {t.earlyBirdLabel.trim()}
                    </span>
                  ) : null}

                  {includes.length > 0 ? (
                    <ul className={styles.inc}>
                      {includes.map((line, k) => (
                        <li key={k}>
                          <CheckIcon />
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {ctaHref ? (
                    <a
                      className={styles.btn}
                      href={ctaHref}
                      target="_blank"
                      rel="noopener"
                    >
                      {ctaLabel} <span className={styles.ar}>→</span>
                    </a>
                  ) : (
                    <span className={`${styles.btn} ${styles.btnOff}`}>
                      Sắp mở bán
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <div className={styles.note}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {note}
        </div>
      </div>
    </section>
  );
}
