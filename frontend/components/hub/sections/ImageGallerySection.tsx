/**
 * FEATURE-027 Phase B — Image Gallery section.
 *
 * Config: { title, columns, images: [{ url, alt }] }
 * Use case: race photo gallery / event recap.
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type ImageGalleryConfig = {
  title?: string;
  columns?: number;
  images?: Array<{ url: string; alt: string }>;
};

const colsClass: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 md:grid-cols-3",
  4: "sm:grid-cols-2 md:grid-cols-4",
};

export function ImageGallerySection({ section }: { section: SectionResponseDto }) {
  const c = section.config as ImageGalleryConfig;
  const images = (c.images ?? []).filter((i) => i.url);
  if (images.length === 0) return null;
  const cols = colsClass[c.columns ?? 3] ?? colsClass[3];

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.title && (
          <h2 className="mb-8 font-[var(--promo-font)] text-3xl font-black tracking-tight">
            {c.title}
          </h2>
        )}
        <div className={`grid gap-3 ${cols}`}>
          {images.map((img, i) => (
            <a
              key={i}
              href={encodeURI(img.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="group block aspect-square overflow-hidden rounded-lg bg-stone-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={encodeURI(img.url)}
                alt={img.alt ?? ""}
                loading="lazy"
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
