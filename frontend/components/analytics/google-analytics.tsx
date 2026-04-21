'use client';

import Script from 'next/script';

/**
 * Google Analytics 4 loader — dual-tracker.
 *
 * Fires one pageview to the main 5BIB property AND a second one to a
 * Solution-specific property if NEXT_PUBLIC_GA_SOLUTION_ID is set, so the
 * marketing team can track the landing page in isolation without leaving
 * the rest of the app.
 *
 * Drop <GoogleAnalytics /> into frontend/app/layout.tsx <body>.
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
          gtag('js', new Date());
          ${mainId ? `gtag('config', '${mainId}', { send_page_view: true });` : ''}
          ${solutionId ? `gtag('config', '${solutionId}', { send_page_view: true });` : ''}
        `}
      </Script>
    </>
  );
}
