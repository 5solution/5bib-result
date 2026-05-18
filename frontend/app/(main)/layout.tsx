import Header from '@/components/Header';
import Footer from '@/components/Footer';
import GoogleAnalytics from '@/components/analytics/google-analytics';
import PageViewTracker from '@/lib/analytics/page-view-tracker';
import CookieConsentBanner from '@/components/CookieConsentBanner';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* F-041 GA4 + Consent Mode v2 (Vietnam PDPA — BR-41-01, BR-41-03).
          Mounted in (main)/ ONLY per Manager Adjustment #1 — avoid conflict
          với solution layouts có gtag/GTM riêng. */}
      <GoogleAnalytics />
      <PageViewTracker />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CookieConsentBanner />
    </>
  );
}
