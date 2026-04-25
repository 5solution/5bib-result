/**
 * Return current Logto user context as JSON — used by client components
 * that need `{ isAuthenticated, claims }` for UI state (e.g. Header, account).
 *
 * Shape (subset of @logto/next LogtoContext):
 *   {
 *     isAuthenticated: boolean,
 *     claims?: { sub, email, name, picture, username, ... },
 *     customData?: Record<string, unknown>    // persisted via Management API
 *   }
 */

import { getLogtoContext } from '@logto/next/server-actions';
import { NextResponse } from 'next/server';
import { logtoConfig } from '@/lib/logto';

export async function GET() {
  const ctx = await getLogtoContext(logtoConfig, {
    fetchUserInfo: true,
  });

  return NextResponse.json({
    isAuthenticated: ctx.isAuthenticated,
    claims: ctx.claims ?? null,
    userInfo: ctx.userInfo ?? null,
    scopes: ctx.scopes ?? [],
  });
}
