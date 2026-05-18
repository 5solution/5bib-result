'use client';

/**
 * F-041 Cookie Consent Banner — Vietnam PDPA Decree 13/2023/NĐ-CP compliance
 * (BR-41-08..11).
 *
 * Behavior:
 * - Mount → check localStorage `5bib_consent_v1` (loadConsent helper)
 * - Missing / expired / version mismatch → setTimeout 1500ms → fade-in
 * - User click "Đồng ý" → updateGtagConsent(true) + emit `consent_accept`
 *   + saveConsent(true) + emit pending page_view (consent now granted) + hide
 * - User click "Từ chối" → updateGtagConsent(false) + saveConsent(false) + hide
 * - User click "Tìm hiểu thêm" → navigate `/privacy-policy` (placeholder Phase 1)
 *
 * Position: fixed bottom-0, full-width, z-50, max ~120px height. Does NOT cause
 * CLS > 0.1 (fixed positioning, NOT push content).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';
import { loadConsent, saveConsent, updateGtagConsent } from '@/lib/analytics/consent-manager';
import { EVENTS } from '@/lib/analytics/events';
import { emitGtagEvent } from '@/lib/analytics/consent-manager';

const SHOW_DELAY_MS = 1500;

export default function CookieConsentBanner() {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fade-in animation control
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    const existing = loadConsent();
    if (existing) return; // Hidden — choice already persisted within TTL

    const timer = setTimeout(() => {
      setVisible(true);
      // Trigger fade-in next tick
      requestAnimationFrame(() => setAnimateIn(true));
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    if (submitting) return;
    setSubmitting(true);
    const lang = (i18n.language?.startsWith('en') ? 'en' : 'vi') as 'vi' | 'en';
    updateGtagConsent(true);
    // Emit consent_accept directly via gtag (bypass useGAEvent hook because consent
    // record not yet persisted at this microtask — saveConsent runs next line).
    emitGtagEvent(EVENTS.CONSENT_ACCEPT, { lang });
    const ok = saveConsent(true);
    if (!ok) {
      // localStorage write failed (private mode / quota) — banner stays visible,
      // user can retry. Don't auto-hide because next visit will re-prompt.
      setSubmitting(false);
      return;
    }
    setAnimateIn(false);
    setTimeout(() => setVisible(false), 200);
  };

  const handleReject = () => {
    if (submitting) return;
    setSubmitting(true);
    updateGtagConsent(false);
    const ok = saveConsent(false);
    if (!ok) {
      setSubmitting(false);
      return;
    }
    setAnimateIn(false);
    setTimeout(() => setVisible(false), 200);
  };

  // SSR safety: render null until mounted + visible
  if (!mounted || !visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('cookie.consent.aria_label', 'Cookie consent')}
      className={[
        'fixed inset-x-0 bottom-0 z-50',
        'border-t border-[var(--5bib-border,#e7e5e4)]',
        'bg-[var(--5bib-surface,#ffffff)]/95 backdrop-blur-md',
        'shadow-[0_-4px_20px_rgba(0,0,0,0.08)]',
        'transition-opacity duration-200 ease-out',
        animateIn ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 size-5 shrink-0 text-[var(--5bib-energy,#ea580c)]" aria-hidden="true" />
          <p className="text-sm leading-snug text-[var(--5bib-text,#1c1917)]">
            {t(
              'cookie.consent.message',
              '🍪 5BIB sử dụng cookie để phân tích lưu lượng và cải thiện trải nghiệm. Bạn có đồng ý không?',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <Link
            href="/privacy-policy"
            className="px-2 text-xs font-medium text-[var(--5bib-accent,#1d4ed8)] underline-offset-4 hover:underline"
          >
            {t('cookie.consent.learn_more', 'Tìm hiểu thêm')}
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            disabled={submitting}
            data-testid="cookie-consent-reject"
          >
            {t('cookie.consent.reject', 'Từ chối')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleAccept}
            disabled={submitting}
            data-testid="cookie-consent-accept"
          >
            {t('cookie.consent.accept', 'Đồng ý')}
          </Button>
        </div>
      </div>
    </div>
  );
}
