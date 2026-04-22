/**
 * Trigger Logto sign-in — redirects to `auth.5bib.com`.
 * Browser hits this endpoint via a link/button; it in turn 302s to Logto's
 * hosted sign-in page. After auth, Logto redirects back to
 * `/api/logto/sign-in-callback`.
 */

import { signIn } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { logtoConfig } from '@/lib/logto';

export async function GET() {
  await signIn(logtoConfig);
  // signIn() throws `redirect()` internally; fallback just in case:
  redirect('/');
}
