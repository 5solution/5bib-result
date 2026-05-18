/**
 * FEATURE-036 — Revalidate webhook called by backend weekly cron + manual admin trigger.
 *
 * Backend POSTs after slug backfill (BR-05):
 *   Body: { paths: ['/giai-chay/foo', '/giai-chay', '/sitemap-races.xml', ...] }
 *   Header: Authorization: Bearer <REVALIDATE_TOKEN>
 *
 * Auth: shared secret (reuse F-027 REVALIDATE_TOKEN). NEVER expose client-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

const REVALIDATE_TOKEN = process.env.REVALIDATE_TOKEN || "";

interface RevalidateBody {
  paths?: string[];
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!REVALIDATE_TOKEN || token !== REVALIDATE_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: RevalidateBody = {};
  try {
    body = (await req.json()) as RevalidateBody;
  } catch {
    /* empty body OK — fallback to default invalidation */
  }

  const paths = Array.isArray(body.paths) ? body.paths : [];
  const revalidated: string[] = [];

  for (const path of paths) {
    if (typeof path !== "string" || !path.startsWith("/")) continue;
    try {
      revalidatePath(path);
      revalidated.push(path);
    } catch (err) {
      console.error(`[revalidate-giai-chay] failed for ${path}:`, err);
    }
  }

  // Always bump the shared tags as well — catches edge cases where ISR cache
  // for the listing/sitemap isn't keyed by path. Pattern matches F-027 hub
  // revalidate route — `revalidateTag(tag, cacheLife)` second arg required
  // by this Next.js version.
  revalidateTag("giai-chay:races", "default");
  revalidateTag("giai-chay:sitemap", "default");

  return NextResponse.json({ ok: true, revalidated });
}
