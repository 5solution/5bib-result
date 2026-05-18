/**
 * FEATURE-036 — /giai-chay/thanh-pho/[citySlug] — City aggregator (Server Component).
 *
 * BR-21~23: province normalize map (10 cities + 'khac' fallback).
 * BR-24: ISR 6h.
 * BR-26: BreadcrumbList JSON-LD.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllRaces } from "@/lib/seo-api";
import {
  isValidCitySlug,
  getCityDisplayName,
  normalizeProvince,
} from "@/lib/province-normalize";
import { RaceCard } from "@/components/giai-chay/RaceCard";
import { buildBreadcrumbJsonLd } from "@/lib/seo-structured-data";

type Props = { params: Promise<{ citySlug: string }> };

export const revalidate = 21600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { citySlug } = await params;
  if (!isValidCitySlug(citySlug)) {
    return { title: "Không tìm thấy thành phố — 5BIB" };
  }
  const cityName = getCityDisplayName(citySlug);
  if (!cityName) return { title: "Không tìm thấy thành phố — 5BIB" };
  const year = new Date().getFullYear();
  const title = `Giải chạy bộ ${cityName} ${year} — Lịch thi đấu & Kết quả | 5BIB`;
  const canonical = `https://5bib.com/giai-chay/thanh-pho/${citySlug}`;
  return {
    title,
    description: `Tất cả giải chạy bộ tại ${cityName} ${year} — marathon, trail, đăng ký, kết quả.`,
    alternates: { canonical },
    openGraph: { title, url: canonical, type: "website" },
  };
}

export default async function CityAggregatorPage({ params }: Props) {
  const { citySlug } = await params;
  if (!isValidCitySlug(citySlug)) notFound();
  const cityName = getCityDisplayName(citySlug);
  if (!cityName) notFound();

  const allRaces = await getAllRaces();
  const races = allRaces
    .filter((r) => normalizeProvince(r.province) === citySlug)
    .sort((a, b) => {
      const at = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bt = b.startDate ? new Date(b.startDate).getTime() : 0;
      return at - bt;
    });

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", url: "https://5bib.com/" },
    { name: "Giải chạy", url: "https://5bib.com/giai-chay" },
    {
      name: cityName,
      url: `https://5bib.com/giai-chay/thanh-pho/${citySlug}`,
    },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav className="mb-4 text-sm text-stone-500">
          <Link href="/" className="hover:text-stone-900">Trang chủ</Link>
          <span className="mx-2">›</span>
          <Link href="/giai-chay" className="hover:text-stone-900">Giải chạy</Link>
          <span className="mx-2">›</span>
          <span className="text-stone-900">{cityName}</span>
        </nav>

        <h1 className="font-[var(--font-heading)] text-4xl font-black tracking-tight text-stone-900 sm:text-5xl">
          Giải chạy bộ {cityName}
        </h1>
        <p className="mt-3 text-base text-stone-600">
          Tại {cityName} hiện có <strong>{races.length}</strong> giải chạy bộ.
        </p>

        <section className="mt-8">
          {races.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white py-16 text-center">
              <p className="text-stone-600">
                Hiện {cityName} chưa có giải nào — quay lại sau!
              </p>
              <Link
                href="/giai-chay"
                className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline"
              >
                ← Xem tất cả giải
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {races.map((race) => (
                <RaceCard key={race.slug ?? race.title} race={race} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
