import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes cần login
const isProtected = createRouteMatcher(['/account(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Subdomain routing: timing.5bib.com → /timing/*
  const host = req.headers.get('host') || '';
  const isTimingHost = host.startsWith('timing.') || host.startsWith('timing-');
  if (isTimingHost) {
    const url = req.nextUrl.clone();
    // Cho phép API proxy pass-through (/api/*)
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/timing')) {
      url.pathname = `/timing${url.pathname === '/' ? '' : url.pathname}`;
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
