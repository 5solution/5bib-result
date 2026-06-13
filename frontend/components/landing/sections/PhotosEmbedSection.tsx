import type { SectionProps } from '../types';
import styles from './photos-embed.module.css';

/**
 * FEATURE-083 — Photos embed (5pix) section.
 * BR-83-14: auto-hide when no pixEventUrl configured.
 * BIB search row is a deep-link to 5pix (NOT a real in-page search).
 */
export default function PhotosEmbedSection({ section }: SectionProps) {
  const d = section.data as {
    pixEventUrl?: string;
    sampleImages?: string[];
  };

  const pixEventUrl = typeof d.pixEventUrl === 'string' ? d.pixEventUrl.trim() : '';

  // BR-83-14 — no event URL means nothing to embed: render nothing.
  if (!pixEventUrl) return null;

  const samples = Array.isArray(d.sampleImages)
    ? d.sampleImages.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];

  // Tasteful empty grid: 4 placeholder tiles when no sample images supplied.
  const tiles = samples.length > 0 ? samples : ['', '', '', ''];

  return (
    <section
      className={`landing-sec landing-dark ${styles.section}`}
      id={section.anchor || 'photos'}
      data-section="photos_embed"
    >
      <div className={styles.mesh} aria-hidden="true" />
      <div className="landing-shell">
        <span className="landing-kicker">Ảnh giải · Powered by 5pix</span>
        <h2 className="landing-h2">
          Tìm <em>ảnh của bạn</em>
        </h2>
        <p className="landing-lead">
          Nhập số BIB — AI của <b>5pix</b> nhận diện và trả về toàn bộ ảnh có bạn trong khung hình.
        </p>

        <div className={styles.search}>
          <input
            className={styles.input}
            type="text"
            placeholder="Nhập số BIB…"
            aria-label="Nhập số BIB để tìm ảnh trên 5pix"
          />
          <a
            className={styles.searchBtn}
            href={pixEventUrl}
            target="_blank"
            rel="noopener"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            Tìm ảnh
          </a>
        </div>

        <div className={styles.grid}>
          {tiles.map((src, i) =>
            src ? (
              <a
                key={`pix-${i}`}
                className={styles.tile}
                href={pixEventUrl}
                target="_blank"
                rel="noopener"
              >
                <img src={src} alt="" loading="lazy" />
              </a>
            ) : (
              <div key={`pix-empty-${i}`} className={`${styles.tile} ${styles.empty}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.6" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
            )
          )}
        </div>

        <a className={styles.foot} href={pixEventUrl} target="_blank" rel="noopener">
          Bấm để xem toàn bộ trên 5pix →
        </a>
      </div>
    </section>
  );
}
