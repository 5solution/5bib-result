/**
 * FEATURE-027 Promo Hub — absolute URL helpers cho internal links.
 *
 * Khi hub được render TẠI `5bib.com/hub/<slug>` (rewrite từ 5Ticket Vercel),
 * relative URLs (`/races/abc`) sẽ resolve về `5bib.com/races/abc` — KHÔNG
 * tồn tại trên 5Ticket app → 404.
 *
 * Solution: hard-code absolute URL trỏ về `result.5bib.com` (this frontend's
 * canonical host) cho internal links. User click → browser jump full URL
 * → load đúng race detail page trên result.5bib.com domain.
 *
 * Tradeoff: user "thoát" 5bib.com domain khi click race link. Acceptable vì
 * race detail không có trên 5bib.com (5Ticket app khác business focus).
 *
 * Env override: `NEXT_PUBLIC_RESULT_BASE_URL` cho local dev / staging.
 */

const RESULT_BASE_URL =
  process.env.NEXT_PUBLIC_RESULT_BASE_URL ?? 'https://result.5bib.com';

/**
 * Build absolute URL for race detail page on result.5bib.com.
 *
 * Used by: RaceCalendarSection, FeaturedRacesSection, RecentResultsSection.
 *
 * @example
 *   getRaceUrl('utmb-2026') → 'https://result.5bib.com/races/utmb-2026'
 */
export function getRaceUrl(slug: string): string {
  return `${RESULT_BASE_URL}/races/${encodeURIComponent(slug)}`;
}

/**
 * FEATURE-033 — Build 5Ticket ticket sale URL for race phase BÁN VÉ.
 *
 * Backend pre-computes `ticketUrl` in `RaceOnSaleResponseDto` so frontend
 * không cần hard-code domain. Helper này là fallback / legacy compat.
 *
 * @example
 *   getTicketUrl('utmb-2026') → 'https://5ticket.vn/event/utmb-2026'
 */
const TICKET_BASE_URL =
  process.env.NEXT_PUBLIC_TICKET_BASE_URL ?? 'https://5ticket.vn';

export function getTicketUrl(urlName: string): string {
  return `${TICKET_BASE_URL}/event/${encodeURIComponent(urlName)}`;
}
