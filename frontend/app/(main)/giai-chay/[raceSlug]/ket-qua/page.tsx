/**
 * FEATURE-036 — /giai-chay/[raceSlug]/ket-qua — Results page (Server Component).
 *
 * BR-24: ISR 30min for live, 24h for ended (page-level set to 1800 — backend
 *        long-term cache handles ended).
 * BR-26: BreadcrumbList JSON-LD.
 * BR-29/30: notFound() for non-existent OR draft OR pre_race (no results yet).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRaceBySlug,
  getRaceResults,
  getCourseStats,
  getRaceId,
  getRaceYear,
  getResultPageUrl,
  getCourseLeaderboardUrl,
} from "@/lib/seo-api";
import { buildBreadcrumbJsonLd } from "@/lib/seo-structured-data";
import { ResultsTable } from "@/components/giai-chay/ResultsTable";

type Props = {
  params: Promise<{ raceSlug: string }>;
  searchParams: Promise<{ course?: string; page?: string }>;
};

export const revalidate = 1800;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { raceSlug } = await params;
  const race = await getRaceBySlug(raceSlug);
  if (!race) return { title: "Không tìm thấy kết quả — 5BIB" };
  const year = getRaceYear(race) ?? "";
  const title = `Kết quả ${race.title} ${year} — Chip Time & Xếp hạng | 5BIB`;
  const canonical = `https://5bib.com/giai-chay/${race.slug}/ket-qua`;
  return {
    title,
    description: `Bảng kết quả ${race.title} — tìm BIB, xem chip time, gun time, pace, xếp hạng theo cự ly.`,
    alternates: { canonical },
    openGraph: {
      title,
      url: canonical,
      type: "website",
    },
  };
}

function formatStat(label: string, value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase text-stone-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-bold text-stone-900">
        {value}
      </div>
    </div>
  );
}

export default async function RaceResultsPage({ params, searchParams }: Props) {
  const { raceSlug } = await params;
  const sp = await searchParams;

  const race = await getRaceBySlug(raceSlug);
  if (!race) notFound();
  // BR-30: pre-race chưa có kết quả
  if (race.status === "pre_race") notFound();

  const courses = race.courses ?? [];
  if (courses.length === 0) notFound();

  const activeCourseId = sp.course ?? courses[0].courseId;
  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = 50;
  const raceId = getRaceId(race);

  const [resultPage, stats] = await Promise.all([
    getRaceResults(raceId, activeCourseId, page, limit),
    getCourseStats(raceId, activeCourseId),
  ]);

  const activeCourse = courses.find((c) => c.courseId === activeCourseId);
  const totalPages = Math.max(1, Math.ceil(resultPage.total / limit));

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", url: "https://5bib.com/" },
    { name: "Giải chạy", url: "https://5bib.com/giai-chay" },
    { name: race.title, url: `https://5bib.com/giai-chay/${race.slug}` },
    {
      name: "Kết quả",
      url: `https://5bib.com/giai-chay/${race.slug}/ket-qua`,
    },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-4 text-sm text-stone-500">
          <Link href="/" className="hover:text-stone-900">Trang chủ</Link>
          <span className="mx-2">›</span>
          <Link href="/giai-chay" className="hover:text-stone-900">
            Giải chạy
          </Link>
          <span className="mx-2">›</span>
          <Link
            href={`/giai-chay/${race.slug}`}
            className="hover:text-stone-900"
          >
            {race.title}
          </Link>
          <span className="mx-2">›</span>
          <span className="text-stone-900">Kết quả</span>
        </nav>

        <h1 className="font-[var(--font-heading)] text-3xl font-black tracking-tight text-stone-900 sm:text-4xl">
          Kết quả {race.title}
        </h1>

        {/* Primary external CTA — actual leaderboard with live tracking */}
        <div className="mt-4">
          <a
            href={
              activeCourseId
                ? getCourseLeaderboardUrl(race.slug ?? "", activeCourseId)
                : getResultPageUrl(race.slug ?? "")
            }
            target="_self"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Xem leaderboard chi tiết trên 5BIB →
          </a>
        </div>

        {courses.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {courses.map((c) => (
              <Link
                key={c.courseId}
                href={`/giai-chay/${race.slug}/ket-qua?course=${encodeURIComponent(c.courseId)}`}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  c.courseId === activeCourseId
                    ? "bg-blue-700 text-white"
                    : "border border-stone-200 bg-white text-stone-700 hover:border-blue-700"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {stats && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {formatStat("Tổng finishers", stats.totalFinishers ?? resultPage.total)}
            {formatStat("Thời gian nhanh nhất", stats.fastestTime)}
            {formatStat("Thời gian chậm nhất", stats.slowestTime)}
            {formatStat("Pace trung bình", stats.averagePace)}
          </div>
        )}

        <div className="mt-6">
          {activeCourse && (
            <p className="mb-3 text-sm text-stone-600">
              Course <strong>{activeCourse.name}</strong>
              {activeCourse.distance && ` (${activeCourse.distance})`} —{" "}
              {resultPage.total} VĐV
            </p>
          )}
          <ResultsTable rows={resultPage.data} />

          {totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between text-sm text-stone-600">
              <span>
                Trang {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/giai-chay/${race.slug}/ket-qua?course=${encodeURIComponent(activeCourseId)}&page=${page - 1}`}
                    className="rounded-md border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50"
                  >
                    ← Trang trước
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/giai-chay/${race.slug}/ket-qua?course=${encodeURIComponent(activeCourseId)}&page=${page + 1}`}
                    className="rounded-md border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50"
                  >
                    Trang sau →
                  </Link>
                )}
              </div>
            </nav>
          )}
        </div>
      </main>
    </>
  );
}
