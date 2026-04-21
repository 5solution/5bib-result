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
import SolutionContactModal from '@/components/solution/SolutionContactModal';
import type { Lang } from '@/components/solution/solution-icons';

export default function SolutionPage() {
  const searchParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null;
  const initialLang: Lang = (searchParams?.get('lang') === 'en' ? 'en' : 'vi') as Lang;

  const [lang, setLang] = React.useState<Lang>(initialLang);
  const [showModal, setShowModal] = React.useState(false);
  const accent = '#D4145A';

  const onCTA = React.useCallback(() => {
    if (typeof window !== 'undefined' && typeof (window as unknown as { gtag?: Function }).gtag === 'function') {
      (window as unknown as { gtag: Function }).gtag('event', 'solution_cta_click', {
        event_category: 'engagement',
        event_label: 'solution_landing',
      });
    }
    setShowModal(true);
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
      <SolutionContactModal
        open={showModal}
        onClose={() => setShowModal(false)}
        lang={lang}
        accent={accent}
      />
    </>
  );
}
