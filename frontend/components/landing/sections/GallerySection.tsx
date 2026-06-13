'use client';

/**
 * FEATURE-083 — Gallery section (Thư viện ảnh & video).
 * Ports #gallery bento from sections-3-prototype.html.
 * Dark section with client-side filter pills (Tất cả / Ảnh / Video).
 */
import { useMemo, useState } from 'react';
import type { SectionProps } from '../types';
import styles from './gallery.module.css';

interface GalleryItem {
  type: 'image' | 'video';
  url: string;
  thumb?: string;
  bib?: string;
  duration?: string;
}

type GalleryFilter = 'all' | 'image' | 'video';

const PLAY_PATH = 'M8 5v14l11-7z';

/** Bento span pattern (variant "bento"): big @ 0, wide @ 3 and 7 — every 8 tiles. */
function bentoSpanClass(index: number): string {
  const pos = index % 8;
  if (pos === 0) return styles.big;
  if (pos === 3 || pos === 7) return styles.wide;
  return '';
}

export default function GallerySection({ section }: SectionProps) {
  const d = section.data as {
    kicker?: string;
    title?: string;
    titleEm?: string;
    lead?: string;
    items?: GalleryItem[];
  };

  const items = useMemo<GalleryItem[]>(
    () => (Array.isArray(d.items) ? d.items.filter((it) => it && typeof it.url === 'string') : []),
    [d.items],
  );

  const isBento = section.variant !== 'grid';
  const [filter, setFilter] = useState<GalleryFilter>('all');

  const imageCount = items.filter((it) => it.type === 'image').length;
  const videoCount = items.filter((it) => it.type === 'video').length;

  const visible = useMemo(
    () => items.filter((it) => filter === 'all' || it.type === filter),
    [items, filter],
  );

  const kicker = d.kicker ?? 'Thư viện';
  const title = d.title ?? 'Khoảnh khắc';
  const titleEm = d.titleEm ?? 'đường đua';
  const lead =
    d.lead ??
    'Ảnh & video từ các mùa giải — trộn lẫn trong lưới bento, bấm để xem lớn / phát video.';

  const filters: { key: GalleryFilter; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'image', label: 'Ảnh' },
    { key: 'video', label: 'Video' },
  ];

  return (
    <section
      className={`landing-sec landing-dark ${styles.section}`}
      id={section.anchor || 'gallery'}
      data-section="gallery"
    >
      <div className={styles.mesh} aria-hidden="true" />
      <div className="landing-shell">
        <span className="landing-kicker">{kicker}</span>
        <h2 className="landing-h2">
          {title} <em>{titleEm}</em>
        </h2>
        {lead ? <p className="landing-lead">{lead}</p> : null}

        {items.length > 0 ? (
          <>
            <div className={styles.gfilter} role="tablist" aria-label="Lọc thư viện">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  className={filter === f.key ? styles.on : undefined}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className={`${styles.bento} ${isBento ? styles.variantBento : styles.variantGrid}`}>
              {visible.map((item, i) => {
                const span = isBento ? bentoSpanClass(i) : '';
                const src = item.type === 'video' ? item.thumb || item.url : item.url;
                if (item.type === 'video') {
                  return (
                    <div
                      key={`${item.url}-${i}`}
                      className={`${styles.tile} ${span}`.trim()}
                      data-type="video"
                    >
                      {src ? <img src={src} alt={item.bib ? `BIB ${item.bib}` : ''} loading="lazy" /> : null}
                      <div className={styles.ov} />
                      <span className={styles.vtag}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                          <path d={PLAY_PATH} />
                        </svg>
                        VIDEO
                      </span>
                      <div className={styles.play}>
                        <span className={styles.pb}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d={PLAY_PATH} />
                          </svg>
                        </span>
                      </div>
                      {item.duration ? <span className={styles.dur}>{item.duration}</span> : null}
                    </div>
                  );
                }
                return (
                  <div
                    key={`${item.url}-${i}`}
                    className={`${styles.tile} ${span}`.trim()}
                    data-type="image"
                  >
                    <img src={src} alt={item.bib ? `BIB ${item.bib}` : ''} loading="lazy" />
                    <div className={styles.ov} />
                  </div>
                );
              })}
            </div>

            <div className={styles.gfoot}>
              {imageCount} ảnh · {videoCount} video
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <p>Chưa có ảnh hoặc video cho mùa giải này.</p>
          </div>
        )}
      </div>
    </section>
  );
}
