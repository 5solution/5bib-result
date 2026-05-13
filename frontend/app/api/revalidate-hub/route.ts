/**
 * FEATURE-027 — Promo Hub revalidation endpoint.
 *
 * Cross-app cache invalidation: admin save → POST here → Next.js
 * `revalidateTag(promo-hub:<slug>)` + `revalidateTag('promo-hubs-sitemap')`
 *
 * Without this, ISR window for hub page is 60s. Admin POST here brings
 * propagation down to <1s after save.
 *
 * Auth: shared secret via `Authorization: Bearer <REVALIDATE_TOKEN>` header.
 * Admin reads the same env var server-side (proxy → backend session) and
 * forwards a token. NEVER expose token to client — only admin server
 * actions / proxy route should call this.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

const REVALIDATE_TOKEN = process.env.REVALIDATE_TOKEN || "";

export async function POST(req: NextRequest) {
  // Auth check — reject if token mismatch (or unset, fail closed)
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!REVALIDATE_TOKEN || token !== REVALIDATE_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let slug: string | undefined;
  try {
    const body = await req.json();
    slug = typeof body?.slug === "string" ? body.slug : undefined;
  } catch {
    /* empty body OK — fallback to sitemap-only revalidate */
  }

  if (slug) {
    revalidateTag(`promo-hub:${slug}`, "default");
  }
  // Always bump sitemap (slug add/remove cases)
  revalidateTag("promo-hubs-sitemap", "default");

  return NextResponse.json({ ok: true, slug: slug ?? null });
}
