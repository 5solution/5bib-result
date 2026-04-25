import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@logto/next/server-actions";
import { logtoConfig, LOGTO_API_RESOURCE } from "@/lib/logto";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

/**
 * Proxy all /api/* requests to the backend. When the incoming request
 * carries a Logto session cookie, we fetch an access token for the
 * `5BIB Result API` resource and forward it as `Authorization: Bearer`.
 *
 * Client components never see tokens — they just call fetch('/api/...')
 * and rely on the cookie. Unauthenticated callers get requests forwarded
 * without Authorization; backend endpoints gated by LogtoAuthGuard /
 * LogtoAdminGuard will 401 as expected.
 */
async function proxyRequest(req: NextRequest) {
  const url = new URL(req.url);
  const targetPath = url.pathname;
  const targetUrl = `${BACKEND_URL}${targetPath}${url.search}`;

  const headers = new Headers();

  // Inject Logto access token server-side (via session cookie).
  try {
    const accessToken = await getAccessToken(logtoConfig, LOGTO_API_RESOURCE);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  } catch {
    // Unauthenticated or token refresh failed — forward without Authorization.
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
  const data = await res.arrayBuffer();

  return new NextResponse(data, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
