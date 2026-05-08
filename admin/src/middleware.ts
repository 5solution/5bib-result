/**
 * F-007 BR-AF-21 + F-008 v2 BR-CC2-32 — 30-day deprecation redirects for the
 * F-005 sub-page tree.
 *
 *   /races/[id]/timing-alerts/cockpit   →  /races/[id]/command-center                (301)
 *   /races/[id]/timing-alerts/alerts    →  /races/[id]/command-center?view=alerts    (301)
 *   /races/[id]/timing-alerts/podium    →  /races/[id]/awards                        (301)
 *
 * Rationale: F-005 cockpit/alerts/podium pages are folded into the new
 * race-ops shell as top-level Command Center + Awards tabs (F-008 v2). BTC
 * have bookmarks pointing at the old paths; we keep them working for 30 days
 * to avoid hard-breaking field usage while the migration window runs.
 *
 * HARD-DELETE TARGET: 30 days after F-008 v2 production deploy.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COCKPIT_RE = /^\/races\/([^/]+)\/timing-alerts\/cockpit\/?$/;
const ALERTS_RE = /^\/races\/([^/]+)\/timing-alerts\/alerts\/?$/;
const PODIUM_RE = /^\/races\/([^/]+)\/timing-alerts\/podium\/?$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const cockpitMatch = COCKPIT_RE.exec(pathname);
  if (cockpitMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/races/${cockpitMatch[1]}/command-center`;
    return NextResponse.redirect(url, 301);
  }

  const alertsMatch = ALERTS_RE.exec(pathname);
  if (alertsMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/races/${alertsMatch[1]}/command-center`;
    url.searchParams.set('view', 'alerts');
    return NextResponse.redirect(url, 301);
  }

  const podiumMatch = PODIUM_RE.exec(pathname);
  if (podiumMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/races/${podiumMatch[1]}/awards`;
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/races/:id/timing-alerts/cockpit',
    '/races/:id/timing-alerts/alerts',
    '/races/:id/timing-alerts/podium',
  ],
};
