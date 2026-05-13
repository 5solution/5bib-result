/**
 * FEATURE-027 Phase B — Map Embed section.
 *
 * Config: { title, embedUrl, address }
 *
 * Whitelist iframe src — chỉ accept Google Maps embed URLs để defend
 * khỏi admin paste raw script. Backend cũng sanitize nhưng đây là
 * defense in depth tại render layer.
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type MapEmbedConfig = {
  title?: string;
  embedUrl?: string;
  address?: string;
};

const ALLOWED_HOSTS = ["www.google.com", "maps.google.com", "www.openstreetmap.org"];

function isSafeEmbedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ALLOWED_HOSTS.includes(u.host) && u.protocol === "https:";
  } catch {
    return false;
  }
}

export function MapEmbedSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as MapEmbedConfig;
  if (!c.embedUrl || !isSafeEmbedUrl(c.embedUrl)) {
    if (c.address) {
      return (
        <section className="px-6 py-10">
          <div className="mx-auto max-w-[var(--promo-max-width,1200px)] rounded-xl border bg-white p-6 text-center">
            {c.title && <h2 className="mb-2 text-2xl font-bold">{c.title}</h2>}
            <p className="text-sm text-stone-600">📍 {c.address}</p>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.title && (
          <h2 className="mb-4 font-[var(--promo-font)] text-2xl font-bold tracking-tight">
            {c.title}
          </h2>
        )}
        {c.address && (
          <p className="mb-4 text-sm text-stone-600">📍 {c.address}</p>
        )}
        <div className="overflow-hidden rounded-xl border shadow-sm">
          <iframe
            src={c.embedUrl}
            title={c.title || "Bản đồ"}
            className="block aspect-[16/9] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
