/**
 * Logto config for the MERCHANT Next.js app (merchant.5bib.com).
 * All env vars runtime (no NEXT_PUBLIC_* prefix) — matches Logto sample convention.
 *
 * SEPARATE Logto Application from admin/frontend (G2): different redirect URIs +
 * merchant scopes. Token carries `merchant:read` / `merchant:finance` so the
 * backend LogtoMerchantGuard / LogtoMerchantFinanceGuard pass.
 */

import type { LogtoNextConfig } from "@logto/next";

const endpoint = process.env.LOGTO_ENDPOINT || "https://auth.5bib.com";

export const LOGTO_API_RESOURCE =
  process.env.LOGTO_API_RESOURCE || "https://api.5bib.com";

export const logtoConfig: LogtoNextConfig = {
  endpoint,
  appId: process.env.LOGTO_APP_ID!,
  appSecret: process.env.LOGTO_APP_SECRET!,
  baseUrl: process.env.LOGTO_BASE_URL || "http://localhost:3006",
  cookieSecret:
    process.env.LOGTO_COOKIE_SECRET ||
    "dev-fallback-secret-change-in-production-please",
  cookieSecure: process.env.LOGTO_COOKIE_SECURE === "true",
  resources: [LOGTO_API_RESOURCE],
  // Merchant scopes (BR-MP-02/03) — gate base + finance report access.
  scopes: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "roles",
    "merchant:read",
    "merchant:finance",
  ],
};
