import { NextRequest, NextResponse } from "next/server";

/**
 * Admin middleware — protects all routes except sign-in + API proxy.
 *
 * Logto session cookies are prefixed `logto:<appId>`. Presence is a
 * good-enough signal for a soft redirect here; real validation (and
 * admin-role check) happens inside the dashboard layout via
 * getLogtoContext().
 */

const PUBLIC_PATTERNS = [
  /^\/sign-in(\/.*)?$/,
  /^\/login(\/.*)?$/,
  /^\/api(\/.*)?$/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATTERNS.some((p) => p.test(pathname));
}

function hasLogtoSession(req: NextRequest): boolean {
  // @logto/next v4.x uses `logto_<appId>` (underscore) as cookie key.
  return req.cookies.getAll().some((c) => c.name.startsWith("logto_"));
}

export default function middleware(req: NextRequest) {
  if (isPublic(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (!hasLogtoSession(req)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)",
  ],
};
