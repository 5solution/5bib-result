import { NextRequest, NextResponse } from 'next/server';

/**
 * FEATURE-089 — Short link redirect handler.
 *
 * `s.5bib.com/<code>` được middleware rewrite → `/r/<code>` → handler này.
 * Resolve qua backend (server-to-server) → 302 sang URL đích. Mọi lỗi / không
 * tồn tại / tắt → fallback về 5bib.com (BR-05/07). KHÔNG cache (counter click).
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';
const FALLBACK_URL = 'https://5bib.com';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await ctx.params;
  if (!code) return NextResponse.redirect(FALLBACK_URL, 302);

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/short-links/resolve/${encodeURIComponent(code)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.redirect(FALLBACK_URL, 302);
    const data = (await res.json()) as { targetUrl?: string };
    if (!data.targetUrl) return NextResponse.redirect(FALLBACK_URL, 302);
    return NextResponse.redirect(data.targetUrl, 302);
  } catch {
    return NextResponse.redirect(FALLBACK_URL, 302);
  }
}
