import { SolHeader } from '@/components/solution-5solution/sol-header';
import { SolHero } from '@/components/solution-5solution/sol-hero';
import { SolTrustBar } from '@/components/solution-5solution/sol-trustbar';
import { SolEcosystem } from '@/components/solution-5solution/sol-ecosystem';
import { SolWhy } from '@/components/solution-5solution/sol-why';
import { SolPartners } from '@/components/solution-5solution/sol-partners';
import { SolContact } from '@/components/solution-5solution/sol-contact';
import { SolFooter } from '@/components/solution-5solution/sol-footer';
import SolAnalytics from '@/components/solution-5solution/SolAnalytics';

export const dynamic = 'force-static';

export default function Solution5SolutionPage() {
  return (
    <>
      <SolHeader />
      <main>
        <SolHero />
        <SolTrustBar />
        <SolEcosystem />
        <SolWhy />
        <SolPartners />
        <SolContact />
      </main>
      <SolFooter />
      {/* GTM event listeners — mounts once, renders null */}
      <SolAnalytics />
    </>
  );
}
