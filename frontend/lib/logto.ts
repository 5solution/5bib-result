/**
 * Logto config for App Router (Next.js 16).
 *
 * All env vars are runtime — no `NEXT_PUBLIC_*` prefix — because this module
 * is only imported server-side (route handlers, middleware, server actions).
 * The browser never needs to know the Logto endpoint; client components
 * call `/api/logto/user` on our own host.
 *
 * Matches official Logto sample repo convention.
 *
 * Env:
 *   LOGTO_ENDPOINT        — https://auth.5bib.com
 *   LOGTO_APP_ID          — per-app OIDC client id
 *   LOGTO_APP_SECRET      — per-app OIDC client secret
 *   LOGTO_API_RESOURCE    — https://api.5bib.com (audience for backend tokens)
 *   LOGTO_COOKIE_SECRET   — 32+ char random, used to encrypt session cookies
 *   LOGTO_BASE_URL        — https://result.5bib.com | http://localhost:3002
 */

import type { LogtoNextConfig } from '@logto/next';

const endpoint = process.env.LOGTO_ENDPOINT || 'https://auth.5bib.com';

export const LOGTO_API_RESOURCE =
  process.env.LOGTO_API_RESOURCE || 'https://api.5bib.com';

export const logtoConfig: LogtoNextConfig = {
  endpoint,
  appId: process.env.LOGTO_APP_ID!,
  appSecret: process.env.LOGTO_APP_SECRET!,
  baseUrl: process.env.LOGTO_BASE_URL || 'http://localhost:3002',
  cookieSecret:
    process.env.LOGTO_COOKIE_SECRET ||
    'dev-fallback-secret-change-in-production-please',
  cookieSecure: process.env.NODE_ENV === 'production',
  resources: [LOGTO_API_RESOURCE],
  // OIDC scopes + resource scopes. Logto only includes a scope in the
  // access token if the client explicitly requests it — even if the user
  // has the role/permission assigned server-side.
  //   - `roles` (OIDC scope) → `roles` claim in ID token / userinfo
  //   - `admin` (resource scope) → granted in the access token when the
  //     user's role has the `admin` permission on `5BIB Result API`.
  scopes: ['openid', 'profile', 'email', 'offline_access', 'roles', 'admin'],
};
