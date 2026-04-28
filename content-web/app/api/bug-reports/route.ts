import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8081";

/**
 * Proxy POST /api/bug-reports → backend.
 * Forwards client IP via X-Forwarded-For so the backend's per-IP rate limiter
 * (5 reports/hour) attributes the right IP. In prod we're behind nginx which
 * already sets X-Forwarded-For; this route preserves it through Next runtime.
 */
export async function POST(req: Request) {
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

  const res = await fetch(`${BACKEND_URL}/api/bug-reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(forwardedIp ? { "X-Forwarded-For": forwardedIp } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
