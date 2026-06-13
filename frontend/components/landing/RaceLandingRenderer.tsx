import type { LandingData } from './types';
import { SECTION_COMPONENTS } from './sections/registry';

/**
 * FEATURE-083 — Section dispatcher. Renders enabled sections in order; each
 * wrapped in an anchor div (id = anchor ?? type) for nav deep-links. Unknown
 * types render null (forward-compat — BR-83-05).
 */
export default function RaceLandingRenderer({ data }: { data: LandingData }) {
  const sections = [...data.sections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <main>
      {sections.map((section) => {
        const Comp = SECTION_COMPONENTS[section.type];
        if (!Comp) return null;
        return (
          <div id={section.anchor ?? section.type} key={section.id}>
            <Comp section={section} theme={data.theme} />
          </div>
        );
      })}
    </main>
  );
}
