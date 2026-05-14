/**
 * FEATURE-027 + FEATURE-033 — Race Calendar section.
 *
 * Config: { title, limit, source?, filter?: { status }, sort? }
 *
 * `source` branch (BR-PH33-02 + BR-PH33-12):
 *   - 'platform_on_sale' → MySQL `5bib_platform_live.races` status=GENERATED_CODE
 *   - 'result_active' OR undefined → MongoDB `5bib_result.races` (F-027 legacy)
 */

import type { SectionResponseDto } from "@/lib/api-generated";
import { getRaceUrl, getTicketUrl } from "../internal-urls";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

type RaceCalendarConfig = {
  title?: string;
  limit?: number;
  source?: "platform_on_sale" | "result_active";
  filter?: { status?: string };
  sort?: "registration_start_time" | "event_date";
};

/* ─────────── Phase VẬN HÀNH (F-027 legacy MongoDB) ─────────── */

type ResultRaceItem = {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  date?: string;
  location?: string;
  imageUrl?: string;
  status?: string;
};

async function fetchResultRaces(
  filter?: { status?: string },
  limit = 6,
): Promise<ResultRaceItem[]> {
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

/* ─────────── Phase BÁN VÉ (F-033 MySQL platform) ─────────── */

type PlatformRaceItem = {
  raceId: string;
  title: string;
  urlName: string;
  logoUrl: string | null;
  eventStartDate: string | null;
  registrationEndTime: string | null;
  location: string | null;
  brand: string | null;
  ticketUrl: string;
};

async function fetchPlatformRacesOnSale(
  limit = 6,
  sort: "registration_start_time" | "event_date" = "registration_start_time",
): Promise<PlatformRaceItem[]> {
  try {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("sort", sort);
    const res = await fetch(
      `${BACKEND_URL}/api/promo-hubs/races-on-sale?${params.toString()}`,
      {
        next: { revalidate: 60, tags: ["promo-hub-races-on-sale"] },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

/* ─────────── Component ─────────── */

export async function RaceCalendarSection({
  section,
}: {
  section: SectionResponseDto;
}) {
  const c = section.config as RaceCalendarConfig;
  // BR-PH33-12 backward-compat: missing source → 'result_active'
  const source = c.source ?? "result_active";
  const limit = c.limit ?? 6;

  if (source === "platform_on_sale") {
    const races = await fetchPlatformRacesOnSale(limit, c.sort);
    return <PlatformRaceCalendar section={section} title={c.title} races={races} />;
  }

  const races = await fetchResultRaces(c.filter, limit);
  return <ResultRaceCalendar section={section} title={c.title} races={races} />;
}

/* ─────────── Result phase (F-027 legacy) ─────────── */

function ResultRaceCalendar({
  section,
  title,
  races,
}: {
  section: SectionResponseDto;
  title?: string;
  races: ResultRaceItem[];
}) {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {title && (
          <h2 className="mb-8 font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {title}
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

/* ─────────── Platform on-sale phase (F-033) ─────────── */

function PlatformRaceCalendar({
  section,
  title,
  races,
}: {
  section: SectionResponseDto;
  title?: string;
  races: PlatformRaceItem[];
}) {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {title && (
          <h2 className="mb-8 font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {title}
          </h2>
        )}
        {races.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-stone-50 py-12 text-center text-sm text-stone-500">
            Chưa có giải đấu nào đang bán vé.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((r) => {
              const href = r.ticketUrl || getTicketUrl(r.urlName);
              const daysLeft = computeDaysLeft(r.registrationEndTime);
              return (
                <a
                  key={r.raceId}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-promo-cta
                  data-promo-section-id={section._id}
                  data-promo-cta-label={r.title}
                  data-promo-cta-url={href}
                  className="group relative block overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-lg"
                >
                  <div
                    className="aspect-[16/9] bg-stone-200 bg-cover bg-center"
                    style={
                      r.logoUrl
                        ? { backgroundImage: `url(${encodeURI(r.logoUrl)})` }
                        : undefined
                    }
                  />
                  {daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && (
                    <span className="absolute right-2 top-2 rounded bg-[var(--promo-secondary)] px-2 py-0.5 text-[11px] font-bold uppercase text-white shadow-sm">
                      Còn {daysLeft} ngày
                    </span>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold leading-tight transition-colors group-hover:text-[var(--promo-primary)]">
                      {r.title}
                    </h3>
                    {r.location && (
                      <div className="mt-1.5 text-xs text-stone-500">📍 {r.location}</div>
                    )}
                    {r.eventStartDate && (
                      <div className="mt-1 font-mono text-xs text-stone-500">
                        📅 {new Date(r.eventStartDate).toLocaleDateString("vi-VN")}
                      </div>
                    )}
                    {r.brand && (
                      <div className="mt-1 text-[11px] uppercase tracking-wider text-stone-400">
                        {r.brand}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function computeDaysLeft(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) return null;
  const ms = target - Date.now();
  return Math.floor(ms / 86400000);
}
