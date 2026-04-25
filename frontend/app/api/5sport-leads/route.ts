import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type LeadBody = {
  full_name?: string;
  phone?: string;
  email?: string;
  organization?: string;
  sport_type?: 'pickleball' | 'badminton' | 'both';
  tournament_scale?: 'lt50' | '50-200' | 'gt200';
  tournament_timing?: '1-3m' | '3-6m' | 'tbd';
  city?: string;
  track?: '5sport-btc' | '5sport-athlete';
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
    const res = await fetch(`${backendUrl}/api/5sport/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(forwarded ? { 'x-forwarded-for': forwarded } : {}),
        'user-agent': req.headers.get('user-agent') ?? '',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

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

    return NextResponse.json({ ok: true, ...data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'upstream_unavailable' },
      { status: 502 },
    );
  }
}
