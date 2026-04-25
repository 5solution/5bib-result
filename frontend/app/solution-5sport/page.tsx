'use client';

import * as React from 'react';
import { S5Header } from '@/components/solution-5sport/s5-header';
import { S5Hero } from '@/components/solution-5sport/s5-hero';
import {
  S5TrustBar,
  S5Pain,
  S5Pillars,
  S5Marketplace,
  S5Community,
  S5Tournament,
  S5Media,
  S5Rating,
  S5Ecosystem,
  S5Testimonials,
  S5Pricing,
  S5FAQ,
} from '@/components/solution-5sport/s5-sections';
import { S5LeadForm } from '@/components/solution-5sport/s5-lead-form';
import { S5Footer } from '@/components/solution-5sport/s5-footer';
import S5Analytics from '@/components/solution-5sport/S5Analytics';
import type { Lang } from '@/components/solution-5sport/s5-shared';

export default function Sport5LandingPage() {
  const [lang, setLang] = React.useState<Lang>('vi');

  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('lang');
    if (p === 'en' || p === 'vi') setLang(p);
  }, []);

  return (
    <>
      <S5Header lang={lang} setLang={setLang} />
      <main>
        <S5Hero lang={lang} />
        <S5TrustBar lang={lang} />
        <S5Pain lang={lang} />
        <S5Pillars lang={lang} />
        <S5Marketplace lang={lang} />
        <S5Community lang={lang} />
        <S5Tournament lang={lang} />
        <S5Media lang={lang} />
        <S5Rating lang={lang} />
        <S5Ecosystem lang={lang} />
        <S5Testimonials lang={lang} />
        <S5Pricing lang={lang} />
        <S5FAQ lang={lang} />
        <S5LeadForm lang={lang} />
      </main>
      <S5Footer lang={lang} />
      {/* GTM event listeners — mounts once, renders null */}
      <S5Analytics />
    </>
  );
}
