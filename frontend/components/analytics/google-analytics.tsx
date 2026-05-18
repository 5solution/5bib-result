'use client';

import Script from 'next/script';

/**
 * Google Analytics 4 loader — dual-tracker + Consent Mode v2 (Vietnam PDPA).
 *
 * F-041 extension (2026-05-18, Manager Adjustment #2):
 * - Inject `gtag('consent', 'default', {...denied})` BEFORE `gtag('config', ...)`
 *   so GA4 SDK starts in denied state (BR-41-03 — Vietnam PDPA Decree
 *   13/2023/NĐ-CP requires explicit consent before tracking).
 * - CookieConsentBanner emits `gtag('consent', 'update', granted)` after user
 *   click "Đồng ý". Until then, GA4 buffers events without sending data.
 * - `wait_for_update: 1500` matches CookieConsentBanner SHOW_DELAY_MS so any
 *   events queued in the first 1.5s wait for banner choice before send/drop.
 *
 * Dual-tracker pattern preserved: NEXT_PUBLIC_GA_SOLUTION_ID still supported
 * (currently unused per F-041 v1.0 — single property `G-PNVB69YRL2`).
 *
 * Mount in `frontend/app/(main)/layout.tsx` <body>.
 * NOT mounted in root `app/layout.tsx` per Manager Adjustment #1 — solution
 * sub-layouts (`/solution`, `/solution-5sport`, etc.) have their own GTM/GA
 * trackers, would conflict if F-041 mounted root.
 */
export default function GoogleAnalytics() {
  const mainId = process.env.NEXT_PUBLIC_GA_ID;
  const solutionId = process.env.NEXT_PUBLIC_GA_SOLUTION_ID;
  if (!mainId && !solutionId) return null;

  const bootstrapId = mainId ?? solutionId!;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${bootstrapId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            'analytics_storage': 'denied',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied',
            'wait_for_update': 1500
          });
          gtag('js', new Date());
          ${mainId ? `gtag('config', '${mainId}', { send_page_view: true, anonymize_ip: true });` : ''}
          ${solutionId ? `gtag('config', '${solutionId}', { send_page_view: true, anonymize_ip: true });` : ''}
        `}
      </Script>
    </>
  );
}
