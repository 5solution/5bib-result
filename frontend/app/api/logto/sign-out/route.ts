/**
 * Sign out — clears Logto session cookie and redirects to Logto's OIDC
 * end-session endpoint, which in turn redirects back to the app home.
 */

import { signOut } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { logtoConfig } from '@/lib/logto';

export async function GET() {
  await signOut(logtoConfig);
  redirect('/');
}
