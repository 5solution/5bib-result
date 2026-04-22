/**
 * Logto config for the admin Next.js app. All env vars runtime (no
 * NEXT_PUBLIC_* prefix) — matches Logto sample repo convention.
 *
 * Uses a SEPARATE Logto Application from the main frontend so admin
 * redirects, post-sign-out URIs, and per-app branding can diverge.
 */

import type { LogtoNextConfig } from "@logto/next";

const endpoint = process.env.LOGTO_ENDPOINT || "https://auth.5bib.com";

export const LOGTO_API_RESOURCE =
  process.env.LOGTO_API_RESOURCE || "https://api.5bib.com";

export const logtoConfig: LogtoNextConfig = {
  endpoint,
  appId: process.env.LOGTO_APP_ID!,
  appSecret: process.env.LOGTO_APP_SECRET!,
  baseUrl: process.env.LOGTO_BASE_URL || "http://localhost:3000",
  cookieSecret:
    process.env.LOGTO_COOKIE_SECRET ||
    "dev-fallback-secret-change-in-production-please",
  cookieSecure: process.env.NODE_ENV === "production",
  resources: [LOGTO_API_RESOURCE],
  scopes: ["openid", "profile", "email", "offline_access", "roles", "admin"],
};
