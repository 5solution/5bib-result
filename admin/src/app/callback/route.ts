import { handleSignIn } from "@logto/next/server-actions";
import { NextRequest, NextResponse } from "next/server";
import { logtoConfig } from "@/lib/logto";

/**
 * OIDC callback endpoint — path matches Logto Next SDK default (`/callback`).
 * Redirect URIs in Logto Dashboard should point here: `${baseUrl}/callback`.
 *
 * After exchanging the authorization code for tokens, we send the user to
 * /dashboard. If the user was already signed in on a different app (SSO
 * via same Logto instance), the exchange is near-instant.
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  await handleSignIn(logtoConfig, searchParams);
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
