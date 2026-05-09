'use client';

import * as React from 'react';
import { LenisProvider } from '@/components/solution/s2-lenis-provider';
import { S2Cursor } from '@/components/solution/s2-cursor';
import { S2Header } from '@/components/solution/s2-header';
import { S2Hero } from '@/components/solution/s2-hero';
import { S2Marquee } from '@/components/solution/s2-marquee';
import {
  S2Pain,
  S2Features,
  S2Process,
  S2CaseStudy,
  S2Testimonials,
  S2Pricing,
  S2FAQ,
  S2FinalCTA,
  S2Footer,
} from '@/components/solution/s2-sections';
import { S2ContactModal } from '@/components/solution/s2-contact-modal';
import { S2MascotRunner } from '@/components/solution/s2-mascot-runner';

export default function SolutionPage() {
  const [contactOpen, setContactOpen] = React.useState(false);

  return (
    <LenisProvider>
      <S2Cursor />
      <S2MascotRunner />
      <S2Header />
      <main>
        <S2Hero />
        <S2Marquee />
        <S2Pain />
        <S2Features />
        <S2Process />
        <S2CaseStudy />
        <S2Testimonials />
        <S2Pricing />
        <S2FAQ />
        <S2FinalCTA onOpenContact={() => setContactOpen(true)} />
      </main>
      <S2Footer />
      <S2ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </LenisProvider>
  );
}
