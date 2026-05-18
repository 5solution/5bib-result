/**
 * FEATURE-036 — Race card for listing pages.
 *
 * Server Component. NO inline form xử lý mua vé (BR-10).
 *
 * Click behavior per source:
 *   - `mongodb` (vận hành): Internal `<Link>` → /giai-chay/[slug] (full SEO page)
 *   - `on-sale` (đang bán vé): External `<a href>` → selling-web 5bib.com (BR-12)
 *     because on-sale race KHÔNG có internal detail page (no courses/results data)
 */

import Link from "next/link";
import type { Race } from "@/lib/seo-api";
import { buildSellingWebUrl } from "@/lib/selling-web-url";

const STATUS_BADGE = {
  pre_race: { label: "Sắp diễn ra", cls: "bg-blue-100 text-blue-700" },
  live: { label: "Đang diễn ra", cls: "bg-orange-100 text-orange-700" },
  ended: { label: "Đã kết thúc", cls: "bg-stone-200 text-stone-700" },
  draft: { label: "Nháp", cls: "bg-stone-200 text-stone-700" },
} as const;

const ON_SALE_BADGE = {
  label: "Đang bán vé",
  cls: "bg-green-100 text-green-700",
};

function formatDate(s?: string): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

function getDistances(race: Race): string {
  const courses = race.courses ?? [];
  if (courses.length === 0) return "";
  const dists = courses
    .map((c) => c.distance ?? (c.distanceKm ? `${c.distanceKm}K` : null))
    .filter(Boolean) as string[];
  return dists.join(" · ");
}

interface CardInnerProps {
  race: Race;
  badge: { label: string; cls: string };
  bg: string;
  distances: string;
}

function CardInner({ race, badge, bg, distances }: CardInnerProps) {
  return (
    <>
      <div
        className="relative aspect-[16/9] bg-stone-200"
        style={
          bg
            ? {
                backgroundImage: `url(${bg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <span
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="space-y-1.5 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-stone-900 group-hover:text-blue-700">
          {race.title}
        </h3>
        {race.startDate && (
          <p className="text-sm text-stone-600">
            📅 {formatDate(race.startDate)}
          </p>
        )}
        {race.location && (
          <p className="line-clamp-1 text-sm text-stone-600">
            📍 {race.location}
          </p>
        )}
        {distances && (
          <p className="text-xs font-medium text-stone-500">{distances}</p>
        )}
        {race.source === "on-sale" && race.registrationEndTime && (
          <p className="text-xs font-medium text-green-700">
            Đăng ký đến {formatDate(race.registrationEndTime)}
          </p>
        )}
      </div>
    </>
  );
}

export function RaceCard({ race }: { race: Race }) {
  const slug = race.slug ?? "";
  const bg = race.bannerUrl ?? race.imageUrl ?? race.logoUrl ?? "";
  const distances = getDistances(race);
  const isOnSale = race.source === "on-sale";
  const badge = isOnSale
    ? ON_SALE_BADGE
    : (STATUS_BADGE[race.status] ?? STATUS_BADGE.pre_race);

  // On-sale race: card → direct external selling-web link (BR-12)
  if (isOnSale) {
    const url = buildSellingWebUrl(slug || null, race.id);
    return (
      <a
        href={url}
        target="_self"
        rel="noopener"
        className="group block overflow-hidden rounded-xl border border-stone-200 bg-white transition-shadow hover:shadow-lg"
      >
        <CardInner race={race} badge={badge} bg={bg} distances={distances} />
      </a>
    );
  }

  // MongoDB race: skip if no slug (BR-29 — listing shouldn't show slugless)
  if (!slug) return null;

  return (
    <Link
      href={`/giai-chay/${slug}`}
      className="group block overflow-hidden rounded-xl border border-stone-200 bg-white transition-shadow hover:shadow-lg"
    >
      <CardInner race={race} badge={badge} bg={bg} distances={distances} />
    </Link>
  );
}
