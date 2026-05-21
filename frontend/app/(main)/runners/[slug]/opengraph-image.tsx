/**
 * FEATURE-051 — Dynamic OG image for athlete profile.
 *
 * Next.js 16 OG image API generates 1200×630 PNG at /runners/[slug]/opengraph-image.
 * Phase 1 minimal design (PAUSE-51-01 accepted default):
 *   - Athlete name + BIB number
 *   - Stats badges: totalRaces / totalFinished
 *   - 5BIB brand block (blue gradient bg + brand mark text)
 * Phase 2 (deferred): rich design with race photos collage when photo upload populated.
 *
 * Uses Next.js built-in ImageResponse (Edge runtime). No external font fetch —
 * relies on system sans-serif fallback to avoid cold-start latency >500ms.
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Hồ sơ vận động viên 5BIB';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

interface MinimalProfile {
  canonicalName: string;
  primaryBib: string;
  totalRaces: number;
  totalFinished: number;
}

async function fetchProfile(slug: string): Promise<MinimalProfile | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/race-results/athletes/${encodeURIComponent(slug)}`,
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as MinimalProfile;
    return {
      canonicalName: data.canonicalName,
      primaryBib: data.primaryBib,
      totalRaces: data.totalRaces ?? 0,
      totalFinished: data.totalFinished ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Next.js 16 — params is async Promise (per app router convention)
  const { slug } = await params;
  const profile = await fetchProfile(slug);

  // Fallback OG when profile not found — generic brand card.
  const name = profile?.canonicalName ?? 'Hồ sơ vận động viên';
  const bib = profile?.primaryBib ?? '—';
  const totalRaces = profile?.totalRaces ?? 0;
  const totalFinished = profile?.totalFinished ?? 0;

  // Trim very long names to avoid layout overflow.
  const displayName = name.length > 38 ? `${name.slice(0, 36)}…` : name;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
          backgroundImage:
            'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 60%, #312e81 100%)',
          color: 'white',
        }}
      >
        {/* Top row — brand mark + tagline */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: '-1px',
            }}
          >
            5BIB
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              opacity: 0.85,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            Hồ sơ vận động viên
          </div>
        </div>

        {/* Center block — athlete name + bib chip */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              padding: '8px 20px',
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 999,
              alignSelf: 'flex-start',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '1px',
            }}
          >
            BIB #{bib}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.1,
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              maxWidth: '1000px',
            }}
          >
            {displayName}
          </div>
        </div>

        {/* Bottom row — stats badges + URL */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            <StatChip label="Tổng giải" value={totalRaces} />
            <StatChip label="Về đích" value={totalFinished} />
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              opacity: 0.8,
            }}
          >
            5bib.com/runners
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 24px',
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 16,
        minWidth: 160,
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 14,
          opacity: 0.8,
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 44,
          fontWeight: 800,
          marginTop: 4,
        }}
      >
        {value.toLocaleString('vi-VN')}
      </div>
    </div>
  );
}
