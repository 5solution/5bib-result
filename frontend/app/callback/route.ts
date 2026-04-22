/**
 * OIDC callback — matches the default redirectUri (`${baseUrl}/callback`)
 * that `@logto/next/server-actions` `signIn()` sends to Logto.
 *
 * Receives the authorization code from Logto and exchanges it for tokens,
 * setting the session cookie via handleSignIn().
 */

import { handleSignIn } from '@logto/next/server-actions';
import { NextRequest, NextResponse } from 'next/server';
import { logtoConfig } from '@/lib/logto';

export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  await handleSignIn(logtoConfig, searchParams);

  // Redirect to home (or wherever post-login lands)
  return NextResponse.redirect(new URL('/', request.url));
}
