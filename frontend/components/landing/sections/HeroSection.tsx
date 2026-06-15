'use client';

import { useEffect, useState } from 'react';
import type { SectionProps } from '../types';
import styles from './hero.module.css';

/** Narrowed view of section.data for the Hero section (FEATURE-083). */
interface HeroCta {
  label: string;
  href: string;
  style?: string;
}
interface HeroData {
  title?: string;
  subtitle?: string;
  media?: string;
  countdownTo?: string;
  overlay?: number;
  date?: string;
  location?: string;
  distances?: string;
  ctaButtons?: HeroCta[];
}

type HeroVariant = 'video' | 'image' | 'text' | 'split';

const VARIANTS: HeroVariant[] = ['video', 'image', 'text', 'split'];

function normalizeVariant(raw: string | undefined): HeroVariant {
  return VARIANTS.includes(raw as HeroVariant) ? (raw as HeroVariant) : 'image';
}

function isVideo(url: string | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
}

/* ── Countdown ───────────────────────────────────────────────── */
interface Remaining {
  dd: string;
  hh: string;
  mm: string;
  ss: string;
}
const ZERO: Remaining = { dd: '00', hh: '00', mm: '00', ss: '00' };
const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');

function remainingFrom(targetMs: number): Remaining {
  const diff = Math.max(0, targetMs - Date.now());
  const s = Math.floor(diff / 1000);
  return {
    dd: pad(Math.floor(s / 86400)),
    hh: pad(Math.floor((s % 86400) / 3600)),
    mm: pad(Math.floor((s % 3600) / 60)),
    ss: pad(s % 60),
  };
}

function Countdown({ iso }: { iso: string }) {
  const targetMs = new Date(iso).getTime();
  const valid = Number.isFinite(targetMs);
  // Render zeros on the server / first paint to avoid hydration mismatch,
  // then tick live once mounted.
  const [time, setTime] = useState<Remaining>(ZERO);

  useEffect(() => {
    if (!valid) return;
    const update = () => setTime(remainingFrom(targetMs));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [targetMs, valid]);

  if (!valid) return null;

  const blocks: { n: string; u: string }[] = [
    { n: time.dd, u: 'Ngày' },
    { n: time.hh, u: 'Giờ' },
    { n: time.mm, u: 'Phút' },
    { n: time.ss, u: 'Giây' },
  ];

  return (
    <div className={`${styles.count} ${styles.rise} ${styles.d5}`} aria-label="Đếm ngược ngày đua">
      {blocks.map((b) => (
        <div key={b.u} className={styles.blk}>
          <div className={styles.n} suppressHydrationWarning>
            {b.n}
          </div>
          <div className={styles.u}>{b.u}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Inline icons (ported from prototype) ────────────────────── */
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </svg>
  );
}

/* ── Section ─────────────────────────────────────────────────── */
export default function HeroSection({ section, theme }: SectionProps) {
  const d = section.data as HeroData;
  const variant = normalizeVariant(section.variant);

  const title = d.title?.trim();
  const subtitle = d.subtitle?.trim();
  const media = d.media?.trim();
  const ctaButtons = (d.ctaButtons ?? []).filter((b) => b?.label && b?.href);

  // Empty state — nothing to show.
  if (!title && !subtitle && ctaButtons.length === 0) {
    return null;
  }

  // Overlay intensity: data.overlay → theme.heroOverlay → 0.45 default.
  const overlay =
    typeof d.overlay === 'number'
      ? d.overlay
      : typeof theme.heroOverlay === 'number'
        ? theme.heroOverlay
        : 0.45;
  const overlayVar = { ['--hero-overlay' as string]: String(overlay) } as React.CSSProperties;

  const showMedia = (variant === 'image' || variant === 'video' || variant === 'split') && !!media;
  const mediaIsVideo = variant === 'video' && isVideo(media);

  const hasMeta = !!(d.date || d.location || d.distances);

  return (
    <header
      className={`landing-dark ${styles.stage}`}
      data-variant={variant}
      style={overlayVar}
      {...(section.anchor ? { id: section.anchor } : {})}
    >
      {/* split: solid editorial panel behind the text column */}
      {variant === 'split' && <div className={styles.splitpanel} aria-hidden="true" />}

      {/* media layer */}
      {showMedia && (
        <div className={styles.media}>
          {mediaIsVideo ? (
            <video
              className={styles.mediaEl}
              autoPlay
              muted
              loop
              playsInline
              poster={media}
              src={media}
            />
          ) : (
            <>
              <img className={styles.mediaBackdrop} alt="" src={media} aria-hidden="true" />
              <img className={styles.mediaFg} alt="" src={media} />
            </>
          )}
        </div>
      )}

      {/* text variant background: mesh gradient + animated topo lines */}
      {variant === 'text' && (
        <>
          <div className={styles.mesh} aria-hidden="true" />
          <svg
            className={styles.topo}
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <path d="M-20,180 C 320,90 560,260 820,180 1080,100 1300,250 1480,170" />
            <path d="M-20,320 C 300,230 600,400 900,300 1160,215 1320,360 1480,300" />
            <path
              className={styles.accent}
              d="M-20,470 C 320,360 600,560 920,450 1180,360 1340,520 1480,440"
            />
            <path d="M-20,620 C 280,520 620,700 940,600 1180,525 1360,660 1480,600" />
            <path d="M-20,760 C 320,660 600,820 900,740 1160,675 1340,800 1480,750" />
          </svg>
        </>
      )}

      {/* cinematic scrims */}
      <div className={`${styles.scrim} ${styles.grad}`} aria-hidden="true" />
      <div className={`${styles.scrim} ${styles.vignette}`} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      {/* live badge — only when media is an ACTUAL video, not a static image */}
      {mediaIsVideo && (
        <div className={styles.badgeVid}>
          <b />
          Video nền · Highlight reel
        </div>
      )}

      <div className={styles.wrap}>
        <div className={styles.inner}>
          <span className={`landing-kicker ${styles.kicker} ${styles.rise} ${styles.d1}`}>
            <span className={styles.dot} />
            {subtitle || 'Race 2026'}
          </span>

          {title && (
            <h1 className={styles.h1}>
              <span className={`${styles.rise} ${styles.d2}`}>{title}</span>
            </h1>
          )}

          {hasMeta && (
            <div className={`${styles.meta} ${styles.rise} ${styles.d4}`}>
              {d.date && (
                <span>
                  <IconCalendar />
                  {d.date}
                </span>
              )}
              {d.location && (
                <span>
                  <IconPin />
                  {d.location}
                </span>
              )}
              {d.distances && (
                <span>
                  <IconBolt />
                  {d.distances}
                </span>
              )}
            </div>
          )}

          {d.countdownTo && <Countdown iso={d.countdownTo} />}

          {ctaButtons.length > 0 && (
            <div className={`${styles.cta} ${styles.rise} ${styles.d6}`}>
              {ctaButtons.map((b, i) => {
                const primary = (b.style ?? (i === 0 ? 'primary' : 'ghost')) !== 'ghost';
                const external = /^https?:\/\//i.test(b.href);
                return (
                  <a
                    key={`${b.href}-${i}`}
                    className={`${styles.btn} ${primary ? styles.btnPrimary : styles.btnGhost}`}
                    href={b.href}
                    {...(external ? { target: '_blank', rel: 'noopener' } : {})}
                  >
                    {b.label}
                    {primary && <span className={styles.ar}>→</span>}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {variant !== 'split' && (
        <div className={styles.scroll} aria-hidden="true">
          <span>Cuộn</span>
          <span className={styles.line} />
        </div>
      )}
    </header>
  );
}
