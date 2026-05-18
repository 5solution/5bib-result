/**
 * FEATURE-036 — Race CTA buttons per status (BR-09).
 *
 * Server Component. CRITICAL Danny mandate:
 *   - "Mua vé" / "Đăng ký" → external `<a href>` to selling-web (BR-11, BR-12)
 *   - "Xem kết quả" → external `<a href>` to result.5bib.com/races/[slug]
 *     (Danny 2026-05-16: "link kết quả của nó đâu thì gán vào đúng theo giải")
 *   - ZERO <form>, ZERO <button onClick> for purchase actions (BR-10)
 *
 * Why external for "Xem kết quả": real-time leaderboard + live tracking data
 * lives on the actual result page, not the SEO-stripped /ket-qua internal page.
 * Internal /ket-qua page still exists for SEO indexing (sitemap'd).
 */

import Link from "next/link";
import type { Race } from "@/lib/seo-api";
import { getRaceId, getResultPageUrl } from "@/lib/seo-api";
import { buildSellingWebUrl } from "@/lib/selling-web-url";

export function RaceCTA({ race }: { race: Race }) {
  const slug = race.slug ?? "";
  const raceId = getRaceId(race);
  const isActive = race.status === "pre_race" || race.status === "live";
  const isLive = race.status === "live";
  const isEnded = race.status === "ended";

  // On-sale source: pre-built ticketUrl from F-033 OR build via helper
  const sellingUrl = race.ticketUrl ?? buildSellingWebUrl(slug || null, raceId);
  const resultPageUrl = slug ? getResultPageUrl(slug) : null;

  return (
    <div className="flex flex-wrap gap-3">
      {isActive && raceId && (
        <a
          href={sellingUrl}
          target="_self"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Đăng ký ngay →
        </a>
      )}
      {isLive && resultPageUrl && (
        <a
          href={resultPageUrl}
          target="_self"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 px-6 py-3 text-base font-semibold text-orange-700 transition-colors hover:bg-orange-100"
        >
          🔴 Xem kết quả LIVE →
        </a>
      )}
      {isEnded && resultPageUrl && (
        <a
          href={resultPageUrl}
          target="_self"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          Xem kết quả đầy đủ →
        </a>
      )}
      {/* Secondary internal link for ended race — keeps SEO landing page accessible */}
      {isEnded && slug && (
        <Link
          href={`/giai-chay/${slug}/ket-qua`}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-stone-900"
        >
          Xem trên trang này
        </Link>
      )}
    </div>
  );
}
