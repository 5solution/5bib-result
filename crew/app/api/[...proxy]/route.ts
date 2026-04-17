import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

async function proxyRequest(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const targetPath = url.pathname;
  const targetUrl = `${BACKEND_URL}${targetPath}${url.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  // Forward IP for rate limiting
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  const init: RequestInit = { method: req.method, headers };

  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      init.body = Buffer.from(await req.arrayBuffer());
    } catch {
      // ignore empty body
    }
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
