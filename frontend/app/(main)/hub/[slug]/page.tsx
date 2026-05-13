/**
 * FEATURE-027 — Public Promo Hub page (Server Component / SSR).
 *
 * Route: 5bib.com/hub/[slug]
 *
 * Server-side fetch via backend direct URL (env BACKEND_URL). Page
 * returns 404 if slug không tồn tại hoặc status != 'published'
 * (backend `findBySlugPublic` enforces this — chỉ trả hub đã publish).
 *
 * SEO:
 *   - generateMetadata exports OG / Twitter / canonical tags từ hub.seo
 *   - JSON-LD structured data injected in <head> nếu seo.structuredData có
 *
 * Sections render via PromoHubRenderer (server-side). PromoHubTracker
 * (client) fires view event on mount + delegates click events for CTAs.
 *
 * Cache: Next.js `revalidate = 60` cho page-level ISR. Backend cũng
 * cache `promo-hub:<slug>` Redis TTL 60s — double layer.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type {
  PromoHubResponseDto,
  SectionResponseDto,
} from "@/lib/api-generated";
import { PromoHubRenderer } from "@/components/hub/PromoHubRenderer";
import { PromoHubTracker } from "@/components/hub/PromoHubTracker";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const revalidate = 60; // ISR — re-fetch every 60s on demand

type Props = {
  params: Promise<{ slug: string }>;
};

async function fetchHub(slug: string): Promise<PromoHubResponseDto | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/promo-hubs/slug/${encodeURIComponent(slug)}`,
      {
        // 60s revalidation aligned with page revalidate + tag for on-demand invalidation
        next: { revalidate: 60, tags: [`promo-hub:${slug}`] },
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`Failed to fetch hub ${slug}: ${res.status}`);
      return null;
    }
    return (await res.json()) as PromoHubResponseDto;
  } catch (err) {
    console.error(`Error fetching hub ${slug}:`, err);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const hub = await fetchHub(slug);
  if (!hub) return { title: "Trang không tồn tại — 5BIB" };

  const metaTitle = hub.seo.metaTitle || `${hub.title} — 5BIB`;
  const metaDescription =
    hub.seo.metaDescription || hub.description || `Trang quảng bá ${hub.title} trên 5BIB.`;
  const canonical =
    hub.seo.canonicalUrl || `https://5bib.com/hub/${hub.slug}`;
  const ogImage = hub.seo.ogImage;

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: canonical,
      type: "website",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: metaTitle,
      description: metaDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PromoHubPage({ params }: Props) {
  const { slug } = await params;
  const hub = await fetchHub(slug);
  if (!hub) notFound();

  // BR-PH-11 — server-side schedule filter. Backend findBySlugPublic
  // already filters by schedule + visible, but client-side defense:
  // skip any section visible=false (paranoid).
  const sections: SectionResponseDto[] = hub.sections.filter((s) => s.visible);

  // Sanitize customCss — backend already sanitized via sanitize-html.
  // Inline style tag for theme primaryColor / secondaryColor / fontFamily.
  const themeCss = buildThemeCss(hub);
  const customCss = hub.theme.customCss ?? "";

  return (
    <>
      {/* JSON-LD structured data (SEO) */}
      {hub.seo.structuredData &&
        Object.keys(hub.seo.structuredData).length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(hub.seo.structuredData),
            }}
          />
        )}

      {/* Theme + customCss (server-rendered inline <style>) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `${themeCss}\n${customCss}`,
        }}
      />

      {/* Sections render */}
      <div className="promo-hub" data-promo-hub-id={hub.id} data-promo-hub-slug={hub.slug}>
        <PromoHubRenderer sections={sections} />
      </div>

      {/* Analytics — fire view event + delegate CTA click events */}
      <PromoHubTracker hubId={hub.id} slug={hub.slug} />
    </>
  );
}

function buildThemeCss(hub: PromoHubResponseDto): string {
  const primary = hub.theme.primaryColor || "#1d4ed8";
  const secondary = hub.theme.secondaryColor || "#ea580c";
  const fontFamily = hub.theme.fontFamily || "var(--font-heading)";
  const layout = hub.theme.layout || "standard";
  const maxWidth =
    layout === "compact" ? "960px" : layout === "wide" ? "1440px" : "1200px";

  return `.promo-hub {
  --promo-primary: ${primary};
  --promo-secondary: ${secondary};
  --promo-font: ${fontFamily};
  --promo-max-width: ${maxWidth};
}`;
}
