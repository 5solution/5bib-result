/**
 * FEATURE-027 — Sponsors section (logo strip from Sponsors collection).
 *
 * Config: { title, levels: ('silver'|'gold'|'diamond')[] }
 *
 * Server-side fetch /api/sponsors (public endpoint) → filter by levels.
 */

import type { SectionResponseDto } from "@/lib/api-generated";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

type SponsorsConfig = {
  title?: string;
  levels?: ("silver" | "gold" | "diamond")[];
};

type Sponsor = {
  id?: string;
  _id?: string;
  name?: string;
  logoUrl?: string;
  websiteUrl?: string;
  level?: string;
};

async function fetchSponsors(): Promise<Sponsor[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/sponsors`, {
      next: { revalidate: 300, tags: ["sponsors"] },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  } catch {
    return [];
  }
}

const LEVEL_ORDER = { diamond: 0, gold: 1, silver: 2 } as const;

export async function SponsorsSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as SponsorsConfig;
  const levels = c.levels ?? ["diamond", "gold", "silver"];
  const all = await fetchSponsors();
  const filtered = all
    .filter((s) => s.logoUrl && (!s.level || levels.includes(s.level as "diamond" | "gold" | "silver")))
    .sort((a, b) => {
      const la = LEVEL_ORDER[(a.level as keyof typeof LEVEL_ORDER) ?? "silver"] ?? 99;
      const lb = LEVEL_ORDER[(b.level as keyof typeof LEVEL_ORDER) ?? "silver"] ?? 99;
      return la - lb;
    });

  if (filtered.length === 0) return null;

  return (
    <section className="bg-stone-50 px-6 py-14">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)] text-center">
        {c.title && (
          <h2 className="mb-8 font-[var(--promo-font)] text-2xl font-bold tracking-tight">
            {c.title}
          </h2>
        )}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {filtered.map((s) => {
            const logo = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={encodeURI(s.logoUrl!)}
                alt={s.name ?? ""}
                className="block h-12 w-auto object-contain md:h-16"
                loading="lazy"
              />
            );
            const key = s.id ?? s._id ?? s.name;
            return s.websiteUrl ? (
              <a
                key={key}
                href={s.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-promo-cta
                data-promo-section-id={section._id}
                data-promo-cta-label={s.name ?? "sponsor"}
                data-promo-cta-url={s.websiteUrl}
                className="grayscale opacity-80 transition-all hover:grayscale-0 hover:opacity-100"
              >
                {logo}
              </a>
            ) : (
              <div key={key} className="grayscale opacity-80">
                {logo}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
