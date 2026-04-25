// Proxy for the 5Solution umbrella landing form (5solution.vn).
// Forwards POST /api/5solution-leads → backend POST /api/leads/5solution.
// Source is HARD-CODED on the backend; this proxy never trusts client `source`.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type LeadBody = {
  full_name?: string;
  phone?: string;
  email?: string;
  organization?: string;
  notes?: string;
  event_type?: 'race' | 'concert' | 'tournament' | 'other';
  event_scale?: 'lt500' | '500-2000' | '2000-10000' | 'gt10000';
  modules?: ('5bib' | '5ticket' | '5pix' | '5sport' | '5tech')[];
  website?: string; // honeypot
};

export async function POST(req: Request) {
  let body: LeadBody;
  try {
    body = (await req.json()) as LeadBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8081';

  const forwarded =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for') ??
    '';

  try {
    const res = await fetch(`${backendUrl}/api/leads/5solution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(forwarded ? { 'x-forwarded-for': forwarded } : {}),
        'user-agent': req.headers.get('user-agent') ?? '',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (res.status === 429) {
      return NextResponse.json(
        { ok: false, error: 'rate_limited' },
        { status: 429 },
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: 'backend_error', detail: data },
        { status: res.status },
      );
    }

    return NextResponse.json({ ok: true, ...(data ?? {}) }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'upstream_unavailable' },
      { status: 502 },
    );
  }
}
