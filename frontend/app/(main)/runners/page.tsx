/**
 * /runners — PUBLIC DISCOVER PAGE HARD-PAUSED (F-056 Phase 5 → F-057).
 *
 * Decision 2026-05-21 (Danny + 5bib-biz-strategist consult):
 *   Path 2 — hard pause public athlete listing pending opt-in consent flow.
 *
 * Rationale:
 *   1. PII compliance (VN Nghị định 13/2023): aggregate cross-race profile
 *      + searchable directory exceeds athlete's race-day consent scope.
 *   2. Brand risk: athletes finding profile public without opt-in → social
 *      media backlash, esp. female athletes (stalker safety).
 *   3. Data moat leakage: 53K profiles → trivial scrape target for
 *      competitors' sales enrichment.
 *   4. Industry benchmark: Strava/Garmin default private, World Athletics
 *      elite-only, RaceResult.com per-race only. 5BIB Phase 5 was most
 *      aggressive in market.
 *
 * Phase 5 implementation preserved in git (commits 97fd9bf, ac341ed,
 * a4a785a) — 10 components + 4 backend endpoints + data quality filter.
 * Restore by:
 *   1. F-057 PRD + claim/consent flow (Logto SSO → athlete claim profile)
 *   2. Strip avatar/gender/province on non-claimed profiles
 *   3. Re-enable backend endpoints (currently 404 — see race-result.controller.ts)
 *   4. Replace this file's body with git revert of commit 97fd9bf
 *
 * Per-race athlete results /races/[slug]/[bib] + race-specific recap remain
 * public (industry norm, athlete consent ngầm khi đăng ký race) — only the
 * AGGREGATE DISCOVER directory is paused.
 */

import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

export const metadata = {
  // Prevent search engines from indexing 404 placeholder.
  robots: { index: false, follow: false },
};

export default function RunnersIndexPagePaused() {
  notFound();
}
