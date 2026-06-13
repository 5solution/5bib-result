import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import type { LandingData } from '@/components/landing/types';
import RaceLandingRenderer from '@/components/landing/RaceLandingRenderer';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

/**
 * FEATURE-083 — Public landing page. Served at /l/<slug> (canonical) and via
 * subdomain rewrite (<slug>.5bib.com → /l/<slug>, middleware). Renders the
 * published liveSnapshot only.
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';
export const revalidate = 60;

async function fetchLanding(slug: string): Promise<LandingData | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/landings/slug/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60, tags: [`landing:${slug}`] } },
    );
    if (!res.ok) return null;
    return (await res.json()) as LandingData;
  } catch (err) {
    console.error(`Error fetching landing ${slug}:`, err);
    return null;
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchLanding(slug);
  if (!data) return { title: 'Không tìm thấy trang' };
  return {
    title: data.meta?.title ?? 'Giải chạy',
    description: data.meta?.description,
    robots: data.meta?.robots,
    openGraph: {
      title: data.meta?.title,
      description: data.meta?.description,
      images: data.meta?.ogImage ? [data.meta.ogImage] : undefined,
    },
  };
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchLanding(slug);
  if (!data) notFound();

  const themeVars = {
    '--main': data.theme.main,
    '--sec': data.theme.sec,
  } as CSSProperties;

  return (
    <div id="top" className="landing-root" style={themeVars}>
      <LandingNav data={data} />
      <RaceLandingRenderer data={data} />
      <LandingFooter data={data} />
    </div>
  );
}
