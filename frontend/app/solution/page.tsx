'use client';

import * as React from 'react';
import SolutionHeader from '@/components/solution/solution-header';
import { S2Cursor } from '@/components/solution/s2-cursor';
import { S2Hero } from '@/components/solution/s2-hero';
import { Reveal } from '@/components/solution/s2-shared';
import {
  SolutionSocialProof,
  SolutionPainSolution,
} from '@/components/solution/solution-pain';
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
  const [lang, setLang] = React.useState<Lang>('vi');
  const accent = '#FF0E65';

  const onCTA = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'solution_cta_click', {
        event_category: 'engagement',
        event_label: 'solution_landing',
      });
    }
    window.open('https://5bib.com/partner-register', '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <>
      <S2Cursor />
      <SolutionHeader lang={lang} setLang={setLang} onCTA={onCTA} accent={accent} />
      <div className="s2-hero-shell">
        <S2Hero />
      </div>
      <Reveal><SolutionSocialProof lang={lang} /></Reveal>
      <Reveal><SolutionPainSolution lang={lang} accent={accent} /></Reveal>
      <Reveal><SolutionFeatureTabs lang={lang} accent={accent} /></Reveal>
      <Reveal><SolutionHowItWorks lang={lang} accent={accent} /></Reveal>
      <Reveal><SolutionTimeline lang={lang} accent={accent} /></Reveal>
      <Reveal><SolutionComparison lang={lang} accent={accent} /></Reveal>
      <Reveal><SolutionCaseStudy lang={lang} accent={accent} /></Reveal>
      <Reveal><SolutionTestimonials lang={lang} accent={accent} /></Reveal>
      <Reveal><SolutionPricing lang={lang} accent={accent} onCTA={onCTA} /></Reveal>
      <Reveal><SolutionFAQ lang={lang} accent={accent} /></Reveal>
      <Reveal><SolutionFinalCTA lang={lang} onCTA={onCTA} accent={accent} /></Reveal>
      <SolutionFooter lang={lang} />
    </>
  );
}
