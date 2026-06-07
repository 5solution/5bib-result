import { client } from './api-generated/client.gen';

// Configure base URL — empty string because we use the /api/[...proxy] runtime proxy
client.setConfig({ baseUrl: '' });

export { client };

/**
 * Legacy helper kept for API compatibility across many pages.
 *
 * Auth header injection is now handled server-side by the proxy
 * (app/api/[...proxy]/route.ts) which pulls a Logto access token from the
 * session cookie and forwards it as Authorization. Client components no
 * longer need to attach tokens.
 *
 * `authHeaders()` therefore returns an empty headers object — existing call
 * sites (`...authHeaders(token)`) still spread fine. Pages that gate on
 * `if (!token) return` still work because `useAuth().token` returns a
 * truthy sentinel string when the user is signed in.
 */
export function authHeaders(_token?: string | null): { headers: Record<string, string> } {
  return { headers: {} };
}
