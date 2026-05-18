/**
 * FEATURE-036 — Centralized helper for building CTA URL to 5BIB selling-web.
 *
 * Danny mandate (file 00 + Q8): "Mọi nút mua vé phải dẫn về trang sự kiện đích
 * của 5bib vì ở trang đó mới xử lý được các giao dịch mua." → SEO page chỉ
 * discovery, transaction xảy ra trên selling-web.
 *
 * Format (BR-12) — Manager Plan §Clarification #2 accepted BA proposal:
 *   https://5bib.com/vi/events/{slug}_{raceId}?ref=seo-giai-chay
 *     &utm_source=organic&utm_medium=seo&utm_campaign=giai-chay
 *
 * Centralize here → đổi format 1 chỗ apply toàn bộ. Tested in selling-web-url.spec.ts.
 */

const SELLING_WEB_BASE_URL =
  process.env.NEXT_PUBLIC_SELLING_WEB_BASE_URL ?? "https://5bib.com";

const UTM_PARAMS = {
  ref: "seo-giai-chay",
  utm_source: "organic",
  utm_medium: "seo",
  utm_campaign: "giai-chay",
} as const;

export function buildSellingWebUrl(
  slug: string | null | undefined,
  raceId: string,
): string {
  const path = slug
    ? `${encodeURIComponent(slug)}_${encodeURIComponent(raceId)}`
    : encodeURIComponent(raceId);
  const params = new URLSearchParams(UTM_PARAMS);
  return `${SELLING_WEB_BASE_URL}/vi/events/${path}?${params.toString()}`;
}
