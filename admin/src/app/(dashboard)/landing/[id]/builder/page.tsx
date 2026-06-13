import LandingBuilder from '@/components/landing/LandingBuilder';

/** FEATURE-083 — landing builder route (Next 16 async params). */
export default async function LandingBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LandingBuilder id={id} />;
}
