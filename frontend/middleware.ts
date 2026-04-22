import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes cần login
const isProtected = createRouteMatcher(['/account(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Subdomain routing:
  //   timing.5bib.com → /timing/*
  //   solution.5bib.com → /solution/*
  //   solution.5sport.vn → /solution-5sport/*
  // Use nextUrl.hostname (canonical public hostname resolved by Next.js from Host / x-forwarded-host)
  // Fallback to raw Host header — covers all proxy configurations
  const hostname = (req.nextUrl.hostname || req.headers.get('host') || '').toLowerCase().split(':')[0];
  const isSport5Host = hostname.includes('5sport');
  const isTimingHost = !isSport5Host && (hostname.startsWith('timing') && hostname.includes('5bib'));
  const isSolutionHost = !isSport5Host && hostname.startsWith('solution') && hostname.includes('5bib');

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
