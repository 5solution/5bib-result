import type { SectionProps } from '../types';
import styles from './about.module.css';

/**
 * FEATURE-083 — About section. Ported from sections-4-prototype.html (#about).
 * Variants: "image-right" | "image-left" | "stats".
 * Server Component — no browser JS needed (variant is static per render).
 */

interface AboutStat {
  num: string;
  label: string;
}

interface AboutCta {
  label: string;
  href: string;
}

interface AboutData {
  title?: string;
  richText?: string;
  paragraphs?: string[];
  stats?: AboutStat[];
  image?: string;
  cta?: AboutCta;
  cornerBadge?: string;
}

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ImagePlaceholderIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function AboutSection({ section }: SectionProps) {
  const d = section.data as AboutData;
  const variant = section.variant === 'image-left' ? 'left' : section.variant === 'stats' ? 'stats' : 'right';

  const title = typeof d.title === 'string' ? d.title : '';
  const richText = typeof d.richText === 'string' ? d.richText : '';
  const paragraphs = Array.isArray(d.paragraphs) ? d.paragraphs.filter((p) => typeof p === 'string' && p.trim()) : [];
  const stats = Array.isArray(d.stats)
    ? d.stats.filter((s): s is AboutStat => !!s && typeof s.num === 'string' && typeof s.label === 'string')
    : [];
  const image = typeof d.image === 'string' && d.image.trim() ? d.image : '';
  const cornerBadge = typeof d.cornerBadge === 'string' && d.cornerBadge.trim() ? d.cornerBadge : '';
  const cta = d.cta && typeof d.cta.label === 'string' && typeof d.cta.href === 'string' ? d.cta : null;

  const hasBody = !!richText || paragraphs.length > 0;
  const hasContent = hasBody || stats.length > 0 || !!image || !!title;

  // Graceful empty state — nothing meaningful to show.
  if (!hasContent) return null;

  const ctaIsExternal = cta ? /^https?:\/\//i.test(cta.href) : false;

  const renderBody = () => {
    if (richText) {
      return <div className={styles.richText} dangerouslySetInnerHTML={{ __html: richText }} />;
    }
    if (paragraphs.length > 0) {
      return (
        <div className={styles.richText}>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderStats = () =>
    stats.length > 0 ? (
      <div className={styles.pgrid}>
        {stats.map((s, i) => (
          <div key={i} className={styles.pcell}>
            <div className={styles.num}>{s.num}</div>
            <div className={styles.cap}>{s.label}</div>
          </div>
        ))}
      </div>
    ) : null;

  const renderCta = () =>
    cta ? (
      <div className={styles.ctaRow}>
        <a
          className={styles.cta}
          href={cta.href}
          {...(ctaIsExternal ? { target: '_blank', rel: 'noopener' } : {})}
        >
          {cta.label}
          <ArrowIcon />
        </a>
      </div>
    ) : null;

  const renderImage = () => (
    <div className={`${styles.img} ${image ? '' : styles.imgPlaceholder}`}>
      {image ? (
        // plain <img> per contract (NOT next/image)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={title || 'About'} loading="lazy" />
      ) : (
        <ImagePlaceholderIcon />
      )}
      {cornerBadge ? <span className={styles.corner}>{cornerBadge}</span> : null}
    </div>
  );

  return (
    <section className="landing-sec" id={section.anchor || 'about'}>
      <div className="landing-shell">
        <span className="landing-kicker">Giới thiệu · About</span>
        {title ? <h2 className="landing-h2">{title}</h2> : null}

        {variant === 'stats' ? (
          <div className={`${styles.about} ${styles.stats}`}>
            {renderBody()}
            {image ? renderImage() : null}
            {renderStats()}
            {renderCta()}
          </div>
        ) : (
          <div className={`${styles.about} ${variant === 'left' ? styles.left : ''}`}>
            <div className={styles.txt}>
              {renderBody()}
              {renderStats()}
              {renderCta()}
            </div>
            {renderImage()}
          </div>
        )}
      </div>
    </section>
  );
}
