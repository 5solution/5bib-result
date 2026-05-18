/**
 * FEATURE-036 — /giai-chay/ — Race calendar listing (Server Component).
 *
 * BR-08: filters draft races
 * BR-24: ISR revalidate 3600s
 * BR-28: internal links to all city pages with ≥1 race
 * BR-14: self-canonical metadata
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getAllRaces, getRaceYear } from "@/lib/seo-api";
import { RaceCard } from "@/components/giai-chay/RaceCard";
import {
  normalizeProvince,
  getCityDisplayName,
  getAllKnownCitySlugs,
} from "@/lib/province-normalize";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Lịch giải chạy bộ Việt Nam 2026 — Đăng ký & Kết quả | 5BIB",
  description:
    "Danh sách toàn bộ giải chạy bộ Việt Nam — marathon, trail, ultra. Đăng ký, mua BIB, xem kết quả. Cập nhật hàng tuần.",
  alternates: { canonical: "https://5bib.com/giai-chay" },
  openGraph: {
    title: "Lịch giải chạy bộ Việt Nam 2026 | 5BIB",
    description: "Tất cả giải chạy bộ Việt Nam — đăng ký, mua BIB, kết quả",
    url: "https://5bib.com/giai-chay",
    type: "website",
  },
};

interface CityCount {
  slug: string;
  name: string;
  count: number;
}

function countCitiesWithRaces(
  races: Array<{ province?: string }>,
): CityCount[] {
  const knownCitySlugs = getAllKnownCitySlugs();
  const counts: Record<string, number> = {};
  for (const r of races) {
    const slug = normalizeProvince(r.province);
    if (!slug || slug === "khac") continue;
    counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return knownCitySlugs
    .filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => ({
      slug: s,
      name: getCityDisplayName(s) ?? s,
      count: counts[s] ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export default async function GiaiChayListingPage() {
  const races = await getAllRaces();

  // Sort: on-sale FIRST (đang bán vé - top priority), then upcoming vận hành,
  // then ended. Within same group, sort by startDate.
  const sortedRaces = [...races].sort((a, b) => {
    const rank = (r: typeof a) => {
      if (r.source === "on-sale") return 0; // top
      if (r.status === "pre_race" || r.status === "live") return 1; // vận hành active
      if (r.status === "ended") return 2; // ended
      return 3;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const at = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bt = b.startDate ? new Date(b.startDate).getTime() : 0;
    // For active (rank 0,1) ascending soonest first; ended descending newest first
    return ra <= 1 ? at - bt : bt - at;
  });

  const cities = countCitiesWithRaces(races);
  const year = new Date().getFullYear();

  // Crawler signal: count by source/status for fresh-content hint
  const onSaleCount = races.filter((r) => r.source === "on-sale").length;
  const activeCount = races.filter(
    (r) =>
      r.source !== "on-sale" &&
      (r.status === "pre_race" || r.status === "live"),
  ).length;
  const endedCount = races.filter((r) => r.status === "ended").length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10">
        <nav className="mb-4 text-sm text-stone-500">
          <Link href="/" className="hover:text-stone-900">Trang chủ</Link>
          <span className="mx-2">›</span>
          <span className="text-stone-900">Giải chạy</span>
        </nav>
        <h1 className="font-[var(--font-heading)] text-4xl font-black tracking-tight text-stone-900 sm:text-5xl">
          Giải chạy bộ Việt Nam {year}
        </h1>
        <p className="mt-3 text-base text-stone-600 sm:text-lg">
          Lịch thi đấu marathon, trail, ultra trên toàn quốc — đăng ký, mua BIB,
          xem kết quả. Hiện có{" "}
          <strong className="text-green-700">{onSaleCount}</strong> giải đang bán
          vé, <strong>{activeCount}</strong> giải sắp diễn ra,{" "}
          <strong>{endedCount}</strong> giải đã kết thúc.
        </p>
      </header>

      {cities.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Thành phố nổi bật
          </h2>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <Link
                key={c.slug}
                href={`/giai-chay/thanh-pho/${c.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-blue-700 hover:text-blue-700"
              >
                {c.name}
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                  {c.count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        {sortedRaces.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white py-16 text-center">
            <p className="text-stone-600">
              Hiện chưa có giải nào — hãy quay lại sau!
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline"
            >
              ← Về trang chủ
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedRaces.map((race) => (
              <RaceCard key={getRaceYear(race) + race.title} race={race} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
