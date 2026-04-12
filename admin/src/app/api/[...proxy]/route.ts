import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

async function proxyRequest(req: NextRequest) {
  const url = new URL(req.url);
  const targetPath = url.pathname;
  const targetUrl = `${BACKEND_URL}${targetPath}${url.search}`;

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);

  // Forward content-type as-is (important for multipart/form-data boundary)
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const init: RequestInit = { method: req.method, headers };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // Use arrayBuffer to preserve binary data (files, images)
    try {
      init.body = Buffer.from(await req.arrayBuffer());
    } catch {}
  }

  const res = await fetch(targetUrl, init);
  const data = await res.arrayBuffer();

  const responseHeaders: Record<string, string> = {
    'Content-Type': res.headers.get('Content-Type') || 'application/json',
  };
  const disposition = res.headers.get('Content-Disposition');
  if (disposition) responseHeaders['Content-Disposition'] = disposition;

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
