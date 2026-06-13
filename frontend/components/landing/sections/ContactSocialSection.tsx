import type { ReactElement } from 'react';
import type { SectionProps } from '../types';
import styles from './contact-social.module.css';

/**
 * FEATURE-083 — Contact + Zalo/FB section (dark bookend).
 * Ported from sections-prototype.html (#contact). Server Component — links only (Phase 1).
 * Theme: brand-energy accents via var(--main); Zalo/Messenger keep their official brand blues.
 */

interface ContactSocialData {
  hotline?: string;
  email?: string;
  address?: string;
  mapEmbed?: string;
  zaloUrl?: string;
  zaloOaName?: string;
  fbPageUrl?: string;
  socials?: { platform?: string; url?: string }[];
  finalCtaHref?: string;
}

type SocialPlatform = 'facebook' | 'instagram' | 'youtube' | 'strava';

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

const PinIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const FbGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
  </svg>
);

const SOCIAL_ICON: Record<SocialPlatform, () => ReactElement> = {
  facebook: FbGlyph,
  instagram: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2c2.7 0 3 0 4.1.1 1 .1 1.7.2 2.3.5.6.2 1.1.5 1.6 1 .5.5.8 1 1 1.6.3.6.4 1.3.5 2.3.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c-.1 1-.2 1.7-.5 2.3a4.4 4.4 0 0 1-1 1.6 4.4 4.4 0 0 1-1.6 1c-.6.3-1.3.4-2.3.5-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-1-.1-1.7-.2-2.3-.5a4.4 4.4 0 0 1-1.6-1 4.4 4.4 0 0 1-1-1.6c-.3-.6-.4-1.3-.5-2.3C2 15 2 14.7 2 12s0-3 .1-4.1c.1-1 .2-1.7.5-2.3a4.4 4.4 0 0 1 1-1.6 4.4 4.4 0 0 1 1.6-1c.6-.3 1.3-.4 2.3-.5C9 2 9.3 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm5.2-8.4a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" />
    </svg>
  ),
  youtube: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.7-1.7C19.4 5.2 12 5.2 12 5.2s-7.4 0-8.9.4A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.7 1.7c1.5.4 8.9.4 8.9.4s7.4 0 8.9-.4a2.5 2.5 0 0 0 1.7-1.7C23 15.2 23 12 23 12zM9.7 15.3V8.7l6 3.3-6 3.3z" />
    </svg>
  ),
  strava: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.4 14.2 13 9.4l-2.4 4.8H7.2L13 2.5l5.8 11.7h-3.4zm.6 1.4h2.3L15.9 21l-2.4-5.4h2.3l.1.3.1-.3z" />
    </svg>
  ),
};

const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  strava: 'Strava',
};

function isKnownPlatform(p: string): p is SocialPlatform {
  return p === 'facebook' || p === 'instagram' || p === 'youtube' || p === 'strava';
}

export default function ContactSocialSection({ section }: SectionProps) {
  const d = section.data as ContactSocialData;

  const hotline = d.hotline?.trim();
  const email = d.email?.trim();
  const address = d.address?.trim();
  const zaloUrl = d.zaloUrl?.trim();
  const zaloOaName = d.zaloOaName?.trim();
  const fbPageUrl = d.fbPageUrl?.trim();
  const finalCtaHref = d.finalCtaHref?.trim() || '#pricing';

  const socials = (Array.isArray(d.socials) ? d.socials : [])
    .map((s) => ({ platform: s?.platform?.trim().toLowerCase() ?? '', url: s?.url?.trim() ?? '' }))
    .filter((s) => s.url && isKnownPlatform(s.platform)) as { platform: SocialPlatform; url: string }[];

  const hasContactRows = Boolean(hotline || email || address);
  const hasChat = Boolean(zaloUrl || fbPageUrl);

  // Derive a clean display label for the Facebook page (strip protocol/trailing slash).
  const fbDisplay = fbPageUrl
    ? fbPageUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    : '';

  return (
    <section
      className={`landing-sec landing-dark ${styles.contact}`}
      id={section.anchor || 'contact'}
      data-section="contact"
    >
      <div className={styles.mesh} aria-hidden="true" />
      <div className="landing-shell">
        <span className="landing-kicker">Hỗ trợ · Liên hệ</span>
        <h2 className="landing-h2">
          Cần <em>hỗ trợ?</em>
        </h2>
        <p className="landing-lead">
          Đội ngũ BTC trực Zalo &amp; Fanpage hằng ngày — phản hồi trong vài phút.
        </p>

        <div className={styles.cgrid}>
          {/* ── left: contact rows + socials ── */}
          <div>
            {hasContactRows ? (
              <>
                {hotline ? (
                  <a className={styles.crow} href={`tel:${hotline.replace(/\s+/g, '')}`}>
                    <span className={styles.ic}>
                      <PhoneIcon />
                    </span>
                    <span>
                      <span className={styles.k}>Hotline</span>
                      <span className={styles.val}>{hotline}</span>
                    </span>
                  </a>
                ) : null}
                {email ? (
                  <a className={styles.crow} href={`mailto:${email}`}>
                    <span className={styles.ic}>
                      <MailIcon />
                    </span>
                    <span>
                      <span className={styles.k}>Email</span>
                      <span className={styles.val}>{email}</span>
                    </span>
                  </a>
                ) : null}
                {address ? (
                  <div className={styles.crow}>
                    <span className={styles.ic}>
                      <PinIcon />
                    </span>
                    <span>
                      <span className={styles.k}>Địa điểm</span>
                      <span className={styles.val}>{address}</span>
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className={styles.emptyLeft}>Thông tin liên hệ đang được cập nhật.</p>
            )}

            {socials.length > 0 ? (
              <div className={styles.socials}>
                {socials.map((s, i) => {
                  const Icon = SOCIAL_ICON[s.platform];
                  return (
                    <a
                      key={`${s.platform}-${i}`}
                      className={styles.soc}
                      href={s.url}
                      target="_blank"
                      rel="noopener"
                      aria-label={SOCIAL_LABEL[s.platform]}
                    >
                      <Icon />
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* ── right: chat card ── */}
          {hasChat ? (
            <div className={styles.chatcard}>
              <div className={styles.h}>Chat trực tiếp</div>
              <div className={styles.s}>
                Bấm để mở Zalo OA hoặc Messenger của BTC — không cần điền form.
              </div>

              {zaloUrl ? (
                <a
                  className={`${styles.chat} ${styles.zalo}`}
                  href={zaloUrl}
                  target="_blank"
                  rel="noopener"
                >
                  <span className={styles.ci}>
                    <b>Z</b>
                  </span>
                  <span className={styles.label}>
                    Chat qua Zalo
                    <small>{zaloOaName || 'Zalo OA'}</small>
                  </span>
                  <span className={styles.ar}>→</span>
                </a>
              ) : null}

              {fbPageUrl ? (
                <a
                  className={`${styles.chat} ${styles.fb}`}
                  href={fbPageUrl}
                  target="_blank"
                  rel="noopener"
                >
                  <span className={styles.ci}>
                    <FbGlyph />
                  </span>
                  <span className={styles.label}>
                    Nhắn Fanpage
                    <small>{fbDisplay}</small>
                  </span>
                  <span className={styles.ar}>→</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.finalcta}>
          <div className={styles.big}>
            Sẵn sàng <em>bứt tốc?</em>
          </div>
          <a className={styles.ctabtn} href={finalCtaHref}>
            Đăng ký ngay <span>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
