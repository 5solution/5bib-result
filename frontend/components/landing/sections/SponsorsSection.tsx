import type { SectionProps } from '../types';
import styles from './sponsors.module.css';

/**
 * FEATURE-083 — Sponsors section.
 * Variants:
 *   - "tier": logos grouped by level (diamond big / gold medium / silver small),
 *             each group with a labelled divider line.
 *   - "wall": single uniform logo grid (any tier logos flattened).
 * Server component — purely presentational, no browser JS.
 */

type SponsorLevel = 'diamond' | 'gold' | 'silver';

interface SponsorLogo {
  name?: string;
  imageUrl?: string;
}

interface SponsorTier {
  level: SponsorLevel;
  logos: SponsorLogo[];
}

interface SponsorsData {
  tiers?: SponsorTier[];
}

const TIER_ORDER: SponsorLevel[] = ['diamond', 'gold', 'silver'];

const TIER_LABEL: Record<SponsorLevel, string> = {
  diamond: 'Kim cương',
  gold: 'Vàng',
  silver: 'Bạc & Đồng hành',
};

const TIER_MARK: Record<SponsorLevel, string> = {
  diamond: '◆',
  gold: '●',
  silver: '●',
};

const TIER_LABEL_CLASS: Record<SponsorLevel, string> = {
  diamond: styles.tierDiamond,
  gold: styles.tierGold,
  silver: styles.tierSilver,
};

const TIER_GRID_CLASS: Record<SponsorLevel, string> = {
  diamond: styles.gridD,
  gold: styles.gridG,
  silver: styles.gridS,
};

/** Split a logo name so a trailing word can carry the --main accent (e.g. SUN·WORLD). */
function splitLabel(name: string): { head: string; tail: string } {
  const trimmed = name.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace > 0) {
    return { head: trimmed.slice(0, lastSpace), tail: trimmed.slice(lastSpace + 1) };
  }
  // No space: accent the back half of a single token so a chip still pops.
  if (trimmed.length >= 6) {
    const mid = Math.ceil(trimmed.length / 2);
    return { head: trimmed.slice(0, mid), tail: trimmed.slice(mid) };
  }
  return { head: trimmed, tail: '' };
}

function LogoCell({ logo }: { logo: SponsorLogo }) {
  if (logo.imageUrl) {
    return (
      <div className={styles.logo}>
        <img className={styles.logoImg} src={logo.imageUrl} alt={logo.name ?? 'Nhà tài trợ'} loading="lazy" />
      </div>
    );
  }
  const name = logo.name?.trim();
  if (!name) {
    return <div className={`${styles.logo} ${styles.logoEmpty}`} aria-hidden="true" />;
  }
  const { head, tail } = splitLabel(name);
  return (
    <div className={styles.logo}>
      <span className={styles.logoText}>
        {head}
        {tail ? <span className={styles.tm}>{tail}</span> : null}
      </span>
    </div>
  );
}

export default function SponsorsSection({ section }: SectionProps) {
  const d = section.data as SponsorsData;
  const variant = section.variant === 'wall' ? 'wall' : 'tier';

  const rawTiers = Array.isArray(d.tiers) ? d.tiers : [];

  // Normalize: keep only tiers with at least one logo, ordered diamond → silver.
  const tiers = rawTiers
    .filter(
      (t): t is SponsorTier =>
        !!t &&
        TIER_ORDER.includes(t.level) &&
        Array.isArray(t.logos) &&
        t.logos.length > 0
    )
    .sort((a, b) => TIER_ORDER.indexOf(a.level) - TIER_ORDER.indexOf(b.level));

  const allLogos: SponsorLogo[] = tiers.flatMap((t) => t.logos);
  const hasLogos = allLogos.length > 0;

  return (
    <section className="landing-sec" id={section.anchor ?? 'sponsors'} data-section="sponsors">
      <div className="landing-shell">
        <span className="landing-kicker">Đồng hành · Sponsors</span>
        <h2 className="landing-h2">
          Nhà <em>tài trợ</em>
        </h2>

        {!hasLogos ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" className={styles.emptyIcon} aria-hidden="true">
              <path d="M20 7h-3.5V5.5A2.5 2.5 0 0 0 14 3h-4a2.5 2.5 0 0 0-2.5 2.5V7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM9.5 5.5A.5.5 0 0 1 10 5h4a.5.5 0 0 1 .5.5V7h-5z" />
            </svg>
            <p className={styles.emptyText}>Danh sách nhà tài trợ sẽ được cập nhật.</p>
          </div>
        ) : variant === 'wall' ? (
          <div className={styles.tier}>
            <div className={`${styles.logos} ${styles.gridWall}`}>
              {allLogos.map((logo, i) => (
                <LogoCell key={`wall-${i}`} logo={logo} />
              ))}
            </div>
          </div>
        ) : (
          tiers.map((tier) => (
            <div className={styles.tier} key={tier.level}>
              <div className={`${styles.tierlabel} ${TIER_LABEL_CLASS[tier.level]}`}>
                <span className={styles.tierMark} aria-hidden="true">
                  {TIER_MARK[tier.level]}
                </span>
                {TIER_LABEL[tier.level]}
              </div>
              <div className={`${styles.logos} ${TIER_GRID_CLASS[tier.level]}`}>
                {tier.logos.map((logo, i) => (
                  <LogoCell key={`${tier.level}-${i}`} logo={logo} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
