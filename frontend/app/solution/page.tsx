'use client';

import * as React from 'react';
import SolutionHeader from '@/components/solution/solution-header';
import SolutionHero from '@/components/solution/solution-hero';
import { SolutionSocialProof, SolutionPainSolution } from '@/components/solution/solution-pain';
import SolutionFeatureTabs from '@/components/solution/solution-feature-tabs';
import {
  SolutionHowItWorks,
  SolutionTimeline,
  SolutionComparison,
  SolutionCaseStudy,
  SolutionTestimonials,
  SolutionPricing,
  SolutionFAQ,
  SolutionFinalCTA,
  SolutionFooter,
} from '@/components/solution/solution-sections';
import type { Lang } from '@/components/solution/solution-icons';

export default function SolutionPage() {
  const searchParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null;
  const initialLang: Lang = (searchParams?.get('lang') === 'en' ? 'en' : 'vi') as Lang;

  const [lang, setLang] = React.useState<Lang>(initialLang);
  const accent = '#FF0E65';

  const onCTA = React.useCallback(() => {
    // GA4 event — only fires if window.gtag is available (set by GoogleAnalytics in layout)
    if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'solution_cta_click', {
        event_category: 'engagement',
        event_label: 'solution_landing',
      });
    }
    // Route to partner lead-capture — swap to internal /contact once the form ships.
    if (typeof window !== 'undefined') {
      window.open('https://5bib.com/partner-register', '_blank', 'noopener,noreferrer');
    }
  }, []);

  return (
    <>
      <SolutionHeader lang={lang} setLang={setLang} onCTA={onCTA} accent={accent} />
      <SolutionHero lang={lang} style="blue" onCTA={onCTA} accent={accent} />
      <SolutionSocialProof lang={lang} />
      <SolutionPainSolution lang={lang} accent={accent} />
      <SolutionFeatureTabs lang={lang} accent={accent} />
      <SolutionHowItWorks lang={lang} accent={accent} />
      <SolutionTimeline lang={lang} accent={accent} />
      <SolutionComparison lang={lang} accent={accent} />
      <SolutionCaseStudy lang={lang} accent={accent} />
      <SolutionTestimonials lang={lang} accent={accent} />
      <SolutionPricing lang={lang} accent={accent} onCTA={onCTA} />
      <SolutionFAQ lang={lang} accent={accent} />
      <SolutionFinalCTA lang={lang} onCTA={onCTA} accent={accent} />
      <SolutionFooter lang={lang} />
    </>
  );
}
