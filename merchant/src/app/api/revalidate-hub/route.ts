/**
 * FEATURE-027 — Admin → Frontend revalidation proxy.
 *
 * Admin client calls this after promo-hub save. We attach the shared
 * REVALIDATE_TOKEN server-side (never exposed to browser) and POST to
 * frontend `/api/revalidate-hub`. Frontend then revalidateTag the hub
 * + sitemap.
 *
 * If FRONTEND_REVALIDATE_URL or REVALIDATE_TOKEN env unset, returns
 * 200 with `skipped: true` — propagation falls back to Next ISR 60s.
 */

import { NextRequest, NextResponse } from "next/server";

const FRONTEND_REVALIDATE_URL =
  process.env.FRONTEND_REVALIDATE_URL ||
  // Default for local dev — adjust per env
  "http://localhost:3002/api/revalidate-hub";
const REVALIDATE_TOKEN = process.env.REVALIDATE_TOKEN || "";

export async function POST(req: NextRequest) {
  if (!REVALIDATE_TOKEN) {
    return NextResponse.json({ ok: true, skipped: "no-token" });
  }

  let slug: string | undefined;
  try {
    const body = await req.json();
    slug = typeof body?.slug === "string" ? body.slug : undefined;
  } catch {
    /* empty body OK */
  }

  try {
    const res = await fetch(FRONTEND_REVALIDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${REVALIDATE_TOKEN}`,
      },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, slug: slug ?? null });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
