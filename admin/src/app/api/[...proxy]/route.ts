import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@logto/next/server-actions";
import { logtoConfig, LOGTO_API_RESOURCE } from "@/lib/logto";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

/**
 * Admin API proxy — forwards /api/* to backend with a Logto access token
 * fetched server-side from the session cookie. Clients never touch tokens.
 */
async function proxyRequest(req: NextRequest) {
  const url = new URL(req.url);
  const targetPath = url.pathname;
  const targetUrl = `${BACKEND_URL}${targetPath}${url.search}`;

  const headers = new Headers();

  // Token resolution:
  //   1. Real Bearer token in incoming header → forward verbatim (used
  //      by automation/QC agents that mint a Logto access token via M2M
  //      and call this proxy directly).
  //   2. Sentinel "Bearer logto-session" from the in-app SDK → fetch the
  //      real token from the Logto session cookie. This sentinel exists
  //      because TanStack Query / generated SDK requires SOME auth
  //      header to trigger its fetch path; the proxy substitutes the
  //      real token here so clients never touch tokens.
  //   3. No header → also fall back to session cookie.
  const incomingAuth = req.headers.get("authorization");
  const isSentinel = incomingAuth === "Bearer logto-session";
  if (incomingAuth && !isSentinel) {
    headers.set("Authorization", incomingAuth);
  } else {
    try {
      const accessToken = await getAccessToken(logtoConfig, LOGTO_API_RESOURCE);
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    } catch {
      // Unauthenticated or token refresh failed — forward anyway; backend
      // endpoints gated by LogtoAdminGuard will return 401/403.
    }
  }

  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const init: RequestInit = { method: req.method, headers };

  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      init.body = Buffer.from(await req.arrayBuffer());
    } catch {}
  }

  const res = await fetch(targetUrl, init);

  // SSE streaming pass-through: nếu backend trả `text/event-stream`,
  // KHÔNG await arrayBuffer() (sẽ block forever vì SSE không close).
  // Forward ReadableStream trực tiếp để EventSource browser nhận được
  // events realtime. Detect qua Content-Type backend hoặc URL pattern /sse.
  const contentTypeRes = res.headers.get("Content-Type") || "";
  const isSse =
    contentTypeRes.includes("text/event-stream") ||
    targetPath.endsWith("/sse");
  if (isSse) {
    return new NextResponse(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const data = await res.arrayBuffer();

  const responseHeaders: Record<string, string> = {
    "Content-Type": contentTypeRes || "application/json",
  };
  const disposition = res.headers.get("Content-Disposition");
  if (disposition) responseHeaders["Content-Disposition"] = disposition;

  return new NextResponse(data, {
    status: res.status,
    headers: responseHeaders,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
