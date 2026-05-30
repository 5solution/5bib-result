/**
 * solution.5bib.com landing — Server Component per FEATURE-060 BR-20.
 *
 * All stateful interactivity (language switcher, CTA callback, cursor
 * effects, hero canvas, scroll reveal animations) is encapsulated in
 * `<SolutionShell>` which is a client island. Next.js still SSRs the
 * client island so initial HTML contains the page body — this satisfies
 * the BR-20 grep test `curl ... | grep -c '<h1' >= 1`.
 *
 * FEATURE-060
 */

import SolutionShell from '@/components/solution/solution-shell';

export default function SolutionPage() {
  return <SolutionShell />;
}
