import { handleSignIn } from "@logto/next/server-actions";
import { NextRequest, NextResponse } from "next/server";
import { logtoConfig } from "@/lib/logto";

/**
 * OIDC callback endpoint — path matches Logto Next SDK default (`/callback`).
 *
 * Post-auth redirect uses `logtoConfig.baseUrl` (set via LOGTO_BASE_URL)
 * rather than `request.url`, because when Next.js runs behind nginx without
 * trusted proxy headers, `request.url` resolves to the internal container
 * address (e.g. http://0.0.0.0:3000) instead of the public domain.
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  await handleSignIn(logtoConfig, searchParams);
  return NextResponse.redirect(new URL("/dashboard", logtoConfig.baseUrl));
}
