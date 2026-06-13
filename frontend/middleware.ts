import { NextRequest, NextResponse } from 'next/server';

/**
 * Frontend middleware — preserves subdomain rewrites AND enforces Logto
 * session presence on protected routes.
 *
 * Subdomain routing:
 *   timing.5bib.com           → /timing/*
 *   solution.5bib.com         → /solution/*
 *   solution.5sport.vn        → /solution-5sport/*
 *   5solution.vn (apex)       → /solution-5solution/*
 *   solution.5solution.vn     → /solution-5solution/*
 *
 * IMPORTANT — order matters: the 5solution check MUST run before the generic
 * `solution.` check, otherwise `solution.5solution.vn` would get caught by
 * the latter and rewritten to `/solution` (the 5BIB race-result landing).
 *
 * Logto protection:
 *   /account(.*) requires a Logto session cookie. If missing, redirect to
 *   /api/logto/sign-in which starts OIDC. Presence of any `logto_<appId>`
 *   cookie (note: UNDERSCORE — that's what `@logto/next` v4.x uses, see
 *   `server-actions/client.js` → `cookieKey: \`logto_${appId}\``) is treated
 *   as "signed in" here; real validation happens inside server components
 *   via getLogtoContext().
 */

const PROTECTED_PATTERN = /^\/account(\/.*)?$/;

function hasLogtoSession(req: NextRequest): boolean {
  return req.cookies.getAll().some((c) => c.name.startsWith('logto_'));
}

export default function middleware(req: NextRequest) {
  const host = (
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    ''
  ).toLowerCase();
  const isSport5Host = host.includes('5sport');
  // 5Solution umbrella — must be evaluated BEFORE the generic `solution.`
  // check, otherwise `solution.5solution.vn` would wrongly match below.
  const is5SolutionHost =
    !isSport5Host &&
    (host === '5solution.vn' ||
      host === 'www.5solution.vn' ||
      host.startsWith('5solution.') ||
      host.startsWith('solution.5solution.') ||
      host.includes('.5solution.'));
  const isTimingHost =
    !isSport5Host &&
    !is5SolutionHost &&
    (host.startsWith('timing.') || host.startsWith('timing-'));
  const isSolutionHost =
    !isSport5Host &&
    !is5SolutionHost &&
    (host.startsWith('solution.') || host.startsWith('solution-'));

  // FEATURE-083 — Race Landing subdomains: `<slug>.5bib.com` → `/l/<slug>`.
  // Catch-all AFTER the known-host checks; excludes the main app + reserved
  // single-label subdomains so e.g. `result-fe-dev.5bib.com` is never caught.
  const LANDING_RESERVED = new Set([
    'www', 'result', 'result-fe', 'result-fe-dev', 'result-dev', 'admin',
    'api', 'app', 'merchant', 'crew', 'timing', 'solution', '5solution',
    '5sport', 'm', 'mail', 'staging', 'dev', 'cdn', 'static', 'blog', 'news',
  ]);
  const landingSub = host.endsWith('.5bib.com')
    ? host.slice(0, -'.5bib.com'.length)
    : '';
  const isLandingHost =
    !isSport5Host &&
    !is5SolutionHost &&
    !isTimingHost &&
    !isSolutionHost &&
    !!landingSub &&
    !landingSub.includes('.') &&
    !LANDING_RESERVED.has(landingSub);

  if (isSport5Host) {
    const url = req.nextUrl.clone();
    if (
      !url.pathname.startsWith('/api') &&
      !url.pathname.startsWith('/solution-5sport')
    ) {
      url.pathname = `/solution-5sport${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (is5SolutionHost) {
    const url = req.nextUrl.clone();
    if (
      !url.pathname.startsWith('/api') &&
      !url.pathname.startsWith('/solution-5solution')
    ) {
      url.pathname = `/solution-5solution${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (isTimingHost) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/timing')) {
      url.pathname = `/timing${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (isSolutionHost) {
    const url = req.nextUrl.clone();
    if (
      !url.pathname.startsWith('/api') &&
      !url.pathname.startsWith('/solution')
    ) {
      url.pathname = `/solution${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // FEATURE-083 — single-page landing: rewrite the subdomain root to /l/<slug>.
  // No cookie is set here (R-9 — avoid `.5bib.com`-scoped session bleed).
  if (isLandingHost && req.nextUrl.pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = `/l/${landingSub}`;
    return NextResponse.rewrite(url);
  }

  if (PROTECTED_PATTERN.test(req.nextUrl.pathname) && !hasLogtoSession(req)) {
    return NextResponse.redirect(new URL('/api/logto/sign-in', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|mp4|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
