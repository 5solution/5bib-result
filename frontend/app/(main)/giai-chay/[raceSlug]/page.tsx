/**
 * FEATURE-036 — /giai-chay/[raceSlug] — Race landing page (Server Component).
 *
 * BR-09: CTA per status — RaceCTA component handles.
 * BR-10/11: NO inline form for purchase; only <a href> to selling-web.
 * BR-14: self-canonical via generateMetadata.
 * BR-24: ISR — 1h for active, 24h for ended.
 * BR-25/26: SportsEvent + BreadcrumbList JSON-LD.
 * BR-27: ≥3 similar races sidebar.
 * BR-29/30: notFound() for non-existent OR draft.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllRaces,
  getRaceBySlug,
  getRaceYear,
  type Race,
} from "@/lib/seo-api";
import {
  buildSportsEventJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo-structured-data";
import { normalizeProvince, getCityDisplayName } from "@/lib/province-normalize";
import { RaceCTA } from "@/components/giai-chay/RaceCTA";
import { CountdownTimer } from "@/components/giai-chay/CountdownTimer";

type Props = { params: Promise<{ raceSlug: string }> };

// Cannot be both `pre_race=3600` and `ended=86400` statically. Use min (3600).
// Per-status difference: backend cache is the long-term layer for ended races.
export const revalidate = 3600;

function formatDateRange(start?: string, end?: string): string {
  if (!start) return "";
  const f = (s: string) => {
    try {
      return new Date(s).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return s;
    }
  };
  if (!end || end === start) return f(start);
  return `${f(start)} – ${f(end)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { raceSlug } = await params;
  const race = await getRaceBySlug(raceSlug);
  if (!race) return { title: "Không tìm thấy giải — 5BIB" };

  const year = getRaceYear(race) ?? new Date().getFullYear();
  const isActive = race.status === "pre_race" || race.status === "live";

  const title = isActive
    ? `Đăng ký ${race.title} — Mua BIB giải chạy ${race.province ?? "Việt Nam"} ${year} | 5BIB`
    : `Kết quả ${race.title} — Bảng xếp hạng & Chip Time | 5BIB`;

  const description =
    race.description ||
    `${race.title} tại ${race.location ?? race.province ?? "Việt Nam"} — ${formatDateRange(race.startDate, race.endDate)}. Xem chi tiết, đăng ký, kết quả trên 5BIB.`;

  const canonical = `https://5bib.com/giai-chay/${race.slug}`;
  const ogImage = race.bannerUrl ?? race.imageUrl;

  return {
    title,
    description: description.slice(0, 160),
    alternates: { canonical },
    openGraph: {
      title,
      description: description.slice(0, 160),
      url: canonical,
      type: "website",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description: description.slice(0, 160),
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

function pickSimilarRaces(allRaces: Race[], current: Race): Race[] {
  const others = allRaces.filter((r) => r.slug && r.slug !== current.slug);
  // Same province first
  const sameProvince = others.filter(
    (r) =>
      normalizeProvince(r.province) === normalizeProvince(current.province) &&
      normalizeProvince(current.province) !== null,
  );
  const rest = others.filter((r) => !sameProvince.includes(r));
  return [...sameProvince, ...rest].slice(0, 3);
}

export default async function RaceLandingPage({ params }: Props) {
  const { raceSlug } = await params;
  const race = await getRaceBySlug(raceSlug);
  if (!race) notFound();

  const allRaces = await getAllRaces();
  const similar = pickSimilarRaces(allRaces, race);
  const citySlug = normalizeProvince(race.province);
  const cityName = citySlug ? getCityDisplayName(citySlug) : null;

  const isActive = race.status === "pre_race" || race.status === "live";
  const isPreRace = race.status === "pre_race";

  const breadcrumbItems: Array<{ name: string; url: string }> = [
    { name: "Trang chủ", url: "https://5bib.com/" },
    { name: "Giải chạy", url: "https://5bib.com/giai-chay" },
  ];
  if (citySlug && citySlug !== "khac" && cityName) {
    breadcrumbItems.push({
      name: cityName,
      url: `https://5bib.com/giai-chay/thanh-pho/${citySlug}`,
    });
  }
  breadcrumbItems.push({
    name: race.title,
    url: `https://5bib.com/giai-chay/${race.slug}`,
  });

  const sportsEventLd = buildSportsEventJsonLd(race);
  const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbItems);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-4 text-sm text-stone-500">
          <Link href="/" className="hover:text-stone-900">Trang chủ</Link>
          <span className="mx-2">›</span>
          <Link href="/giai-chay" className="hover:text-stone-900">Giải chạy</Link>
          {citySlug && citySlug !== "khac" && cityName && (
            <>
              <span className="mx-2">›</span>
              <Link
                href={`/giai-chay/thanh-pho/${citySlug}`}
                className="hover:text-stone-900"
              >
                {cityName}
              </Link>
            </>
          )}
          <span className="mx-2">›</span>
          <span className="text-stone-900">{race.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-3">
          <article className="lg:col-span-2">
            {(race.bannerUrl ?? race.imageUrl) && (
              <div
                className="mb-6 aspect-[16/9] rounded-xl bg-stone-200"
                style={{
                  backgroundImage: `url(${race.bannerUrl ?? race.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}

            <h1 className="font-[var(--font-heading)] text-3xl font-black leading-tight tracking-tight text-stone-900 sm:text-4xl">
              {race.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-stone-700">
              {race.startDate && (
                <span>📅 {formatDateRange(race.startDate, race.endDate)}</span>
              )}
              {race.location && <span>📍 {race.location}</span>}
              {race.status === "live" && (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase text-orange-700">
                  🔴 LIVE
                </span>
              )}
              {race.status === "ended" && (
                <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold uppercase text-stone-700">
                  Đã kết thúc
                </span>
              )}
            </div>

            {isPreRace && race.startDate && (
              <div className="mt-5">
                <CountdownTimer startDate={race.startDate} />
              </div>
            )}

            <div className="mt-6">
              <RaceCTA race={race} />
            </div>

            {race.description && (
              <section className="mt-8 prose max-w-none">
                <h2 className="text-xl font-bold text-stone-900">Giới thiệu</h2>
                <p className="whitespace-pre-line text-stone-700">
                  {race.description}
                </p>
              </section>
            )}

            {race.courses && race.courses.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-4 text-xl font-bold text-stone-900">
                  Các cự ly
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {race.courses.map((c) => (
                    <div
                      key={c.courseId}
                      className="rounded-lg border border-stone-200 bg-white p-4"
                    >
                      <div className="font-semibold text-stone-900">{c.name}</div>
                      {c.distance && (
                        <div className="text-sm text-stone-600">
                          Khoảng cách: {c.distance}
                        </div>
                      )}
                      {c.startTime && (
                        <div className="text-sm text-stone-600">
                          Xuất phát: {c.startTime}
                        </div>
                      )}
                      {c.cutOffTime && (
                        <div className="text-sm text-stone-600">
                          Cut-off: {c.cutOffTime}
                        </div>
                      )}
                      {race.status === "ended" && race.slug && (
                        <Link
                          href={`/giai-chay/${race.slug}/ket-qua?course=${encodeURIComponent(c.courseId)}`}
                          className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline"
                        >
                          Xem kết quả →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside className="lg:col-span-1">
            {similar.length > 0 && (
              <section className="rounded-xl border border-stone-200 bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Giải tương tự
                </h2>
                <ul className="space-y-3">
                  {similar.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/giai-chay/${r.slug}`}
                        className="block text-sm font-medium text-stone-900 hover:text-blue-700"
                      >
                        {r.title}
                        <span className="block text-xs font-normal text-stone-500">
                          {r.location ?? r.province ?? ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
