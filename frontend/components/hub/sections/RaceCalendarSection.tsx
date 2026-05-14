/**
 * FEATURE-027 — Race Calendar section.
 *
 * Config: { title, limit, filter: { status } }
 *
 * Server-side fetch races from backend (filtered by status). KHÔNG dùng
 * SDK client functions vì Server Component. Direct fetch với cache tags.
 */

import type { SectionResponseDto } from "@/lib/api-generated";
import { getRaceUrl } from "../internal-urls";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

type RaceCalendarConfig = {
  title?: string;
  limit?: number;
  filter?: { status?: string };
};

type RaceListItem = {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  date?: string;
  location?: string;
  imageUrl?: string;
  status?: string;
};

async function fetchRaces(filter?: { status?: string }, limit = 6): Promise<RaceListItem[]> {
  try {
    const params = new URLSearchParams();
    if (filter?.status) params.set("status", filter.status);
    params.set("limit", String(limit));
    const res = await fetch(`${BACKEND_URL}/api/races?${params.toString()}`, {
      next: { revalidate: 60, tags: ["promo-hub-races"] },
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

export async function RaceCalendarSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as RaceCalendarConfig;
  const races = await fetchRaces(c.filter, c.limit ?? 6);

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.title && (
          <h2 className="mb-8 font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {c.title}
          </h2>
        )}
        {races.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-stone-50 py-12 text-center text-sm text-stone-500">
            Chưa có giải đấu phù hợp.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((r) => (
              <a
                key={r.id ?? r._id}
                href={getRaceUrl(r.slug)}
                data-promo-cta
                data-promo-section-id={section._id}
                data-promo-cta-label={r.name}
                data-promo-cta-url={getRaceUrl(r.slug)}
                className="group block overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-lg"
              >
                <div
                  className="aspect-[16/9] bg-stone-200 bg-cover bg-center"
                  style={
                    r.imageUrl
                      ? { backgroundImage: `url(${encodeURI(r.imageUrl)})` }
                      : undefined
                  }
                />
                <div className="p-4">
                  <h3 className="font-bold transition-colors group-hover:text-[var(--promo-primary)]">
                    {r.name}
                  </h3>
                  {r.location && (
                    <div className="mt-1 text-xs text-stone-500">📍 {r.location}</div>
                  )}
                  {r.date && (
                    <div className="mt-1 font-mono text-xs text-stone-500">
                      {new Date(r.date).toLocaleDateString("vi-VN")}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
