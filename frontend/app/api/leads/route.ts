/**
 * POST /api/leads
 * Placeholder lead-capture endpoint for the Solution landing page CTAs.
 *
 * Expected payload:
 *   { name, email, phone, organization, race_name, estimated_size, message, source }
 *
 * For now this ONLY validates + logs + returns 202. When the real CRM
 * (HubSpot / Airtable / internal DB) is wired up, swap the TODO section.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type LeadBody = {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  race_name?: string;
  estimated_size?: number | string;
  message?: string;
  source?: string;
  _hp?: string; // honeypot
};

function isValidEmail(s: string): boolean {
  // Conservative — good enough for gatekeeping; server-side verify separately.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  let body: LeadBody;
  try {
    body = (await req.json()) as LeadBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // Honeypot — silently accept spammers so they don't retry.
  if (body._hp && body._hp.length > 0) {
    return NextResponse.json({ ok: true, accepted: true }, { status: 202 });
  }

  const errors: Record<string, string> = {};
  if (!body.name || body.name.trim().length < 2) errors.name = 'required';
  if (!body.email || !isValidEmail(body.email)) errors.email = 'invalid';
  if (!body.organization || body.organization.trim().length < 2) errors.organization = 'required';

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const lead = {
    name: body.name!.trim(),
    email: body.email!.trim().toLowerCase(),
    phone: body.phone?.trim() ?? null,
    organization: body.organization!.trim(),
    race_name: body.race_name?.trim() ?? null,
    estimated_size: body.estimated_size ?? null,
    message: body.message?.trim() ?? null,
    source: body.source ?? 'solution_landing',
    ua: req.headers.get('user-agent') ?? null,
    ip:
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for') ??
      null,
    received_at: new Date().toISOString(),
  };

  // TODO: persist + notify.
  //   - await db.insert('solution_leads', lead);
  //   - await sendSlackNotification(lead);
  //   - await hubspotUpsert(lead);
  // For now we just log server-side so ops can grep until the CRM is wired.
  // eslint-disable-next-line no-console
  console.log('[solution_lead]', JSON.stringify(lead));

  return NextResponse.json({ ok: true, accepted: true }, { status: 202 });
}

export async function GET() {
  return NextResponse.json(
    { ok: true, endpoint: '/api/leads', accepts: 'POST' },
    { status: 200 }
  );
}
