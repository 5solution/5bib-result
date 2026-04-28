import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8081";

/**
 * Proxy POST /api/articles/:slug/helpful → backend.
 * Forwards client IP via X-Forwarded-For so backend can dedup per-IP correctly
 * (backend is behind nginx in prod, so $remote_addr is overwritten there).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const forwardedIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "";

  const res = await fetch(
    `${BACKEND_URL}/api/articles/${encodeURIComponent(slug)}/helpful`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(forwardedIp ? { "X-Forwarded-For": forwardedIp } : {}),
      },
      body: JSON.stringify(body),
    },
  );

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
