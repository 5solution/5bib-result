/**
 * FEATURE-027 — Featured Races section.
 *
 * Config: { title, raceIds: string[] }
 *
 * Admin picks specific race ObjectIds. Server-side fetch each race
 * (parallel). Failed lookups silently skipped (race deleted etc).
 */

import type { SectionResponseDto } from "@/lib/api-generated";
import { getRaceUrl } from "../internal-urls";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

type FeaturedRacesConfig = {
  title?: string;
  raceIds?: string[];
};

type Race = {
  id?: string;
  _id?: string;
  name?: string;
  slug?: string;
  imageUrl?: string;
  date?: string;
  location?: string;
};

async function fetchRaceById(id: string): Promise<Race | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/races/${encodeURIComponent(id)}`, {
      next: { revalidate: 300, tags: [`race:${id}`] },
    });
    if (!res.ok) return null;
    return (await res.json()) as Race;
  } catch {
    return null;
  }
}

export async function FeaturedRacesSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as FeaturedRacesConfig;
  const ids = (c.raceIds ?? []).filter(Boolean);
  const races = (await Promise.all(ids.map(fetchRaceById))).filter(
    (r): r is Race => r !== null && !!r.slug,
  );

  if (races.length === 0) {
    return null;
  }

  return (
    <section className="bg-stone-50 px-6 py-16">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.title && (
          <h2 className="mb-8 font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {c.title}
          </h2>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {races.map((r) => (
            <a
              key={r.id ?? r._id}
              href={getRaceUrl(r.slug!)}
              data-promo-cta
              data-promo-section-id={section._id}
              data-promo-cta-label={r.name}
              data-promo-cta-url={getRaceUrl(r.slug!)}
              className="group relative block overflow-hidden rounded-2xl bg-white shadow-md transition-transform hover:scale-[1.01] hover:shadow-xl"
            >
              <div
                className="aspect-[16/8] bg-cover bg-center"
                style={
                  r.imageUrl
                    ? { backgroundImage: `linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7)), url(${encodeURI(r.imageUrl)})` }
                    : { background: "linear-gradient(135deg, var(--promo-primary), var(--promo-secondary))" }
                }
              />
              <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                <h3 className="font-[var(--promo-font)] text-2xl font-black">
                  {r.name}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-xs opacity-90">
                  {r.date && <span>📅 {new Date(r.date).toLocaleDateString("vi-VN")}</span>}
                  {r.location && <span>📍 {r.location}</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
