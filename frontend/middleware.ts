import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes cần login
const isProtected = createRouteMatcher(['/account(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Subdomain routing:
  //   timing.5bib.com → /timing/*
  //   solution.5bib.com → /solution/*
  //   solution.5sport.vn → /solution-5sport/*
  // nginx rewrites solution.5sport.vn → /solution-5sport directly (no middleware detection needed for 5sport)
  // For solution.5bib.com and timing.5bib.com, rely on Host header set by nginx proxy_set_header Host $host
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  const isSport5Host = host.includes('5sport');
  const isTimingHost = !isSport5Host && (host.startsWith('timing.') || host.startsWith('timing-'));
  const isSolutionHost = !isSport5Host && (host.startsWith('solution.') || host.startsWith('solution-'));

  if (isSport5Host) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/solution-5sport')) {
      url.pathname = `/solution-5sport${url.pathname === '/' ? '' : url.pathname}`;
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
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/solution')) {
      url.pathname = `/solution${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals, static files, và API proxy route (API proxy tự forward token)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|mp4|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
