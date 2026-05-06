/**
 * F-007 BR-AF-21 — 30-day deprecation window for the F-005 sub-page route.
 *
 *   /races/[id]/timing-alerts/cockpit  →  /races/[id]/command-center  (301)
 *
 * Rationale: F-005 cockpit page is being folded into the new race-ops shell as
 * a top-level Command Center tab (F-008). BTC have bookmarks pointing at the
 * old path; we keep them working for 30 days to avoid hard-breaking field
 * usage while F-008 ships.
 *
 * HARD-DELETE TARGET: 30 days after F-008 production deploy.
 *
 * Note: peer routes `/timing-alerts/alerts` and `/timing-alerts/podium` are
 * intentionally NOT redirected — F-008 will fold them in turn.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COCKPIT_RE = /^\/races\/([^/]+)\/timing-alerts\/cockpit\/?$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = COCKPIT_RE.exec(pathname);
  if (match) {
    const url = request.nextUrl.clone();
    url.pathname = `/races/${match[1]}/command-center`;
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/races/:id/timing-alerts/cockpit"],
};
