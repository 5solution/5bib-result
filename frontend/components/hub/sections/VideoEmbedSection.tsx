/**
 * FEATURE-027 Phase B — Video Embed section.
 *
 * Config: { title, provider ('youtube'|'vimeo'), videoId, caption }
 *
 * Accepts full URL or just video ID for YouTube. Extracts ID via regex.
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type VideoEmbedConfig = {
  title?: string;
  provider?: "youtube" | "vimeo";
  videoId?: string;
  caption?: string;
};

function extractYouTubeId(input: string): string {
  // Already an ID (no slashes / dots)
  if (/^[A-Za-z0-9_-]{6,}$/.test(input)) return input;
  // youtu.be/<id>
  const short = input.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
  if (short) return short[1];
  // youtube.com/watch?v=<id>
  const std = input.match(/[?&]v=([A-Za-z0-9_-]+)/);
  if (std) return std[1];
  // embed/<id>
  const emb = input.match(/embed\/([A-Za-z0-9_-]+)/);
  if (emb) return emb[1];
  return input;
}

function extractVimeoId(input: string): string {
  if (/^\d+$/.test(input)) return input;
  const m = input.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : input;
}

export function VideoEmbedSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as VideoEmbedConfig;
  if (!c.videoId) return null;
  const provider = c.provider ?? "youtube";
  const id =
    provider === "vimeo" ? extractVimeoId(c.videoId) : extractYouTubeId(c.videoId);
  const src =
    provider === "vimeo"
      ? `https://player.vimeo.com/video/${id}`
      : `https://www.youtube-nocookie.com/embed/${id}`;

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-[min(var(--promo-max-width,1200px),960px)]">
        {c.title && (
          <h2 className="mb-6 font-[var(--promo-font)] text-2xl font-bold tracking-tight">
            {c.title}
          </h2>
        )}
        <div className="overflow-hidden rounded-2xl shadow-lg">
          <div className="relative aspect-video">
            <iframe
              src={src}
              title={c.title || "Video"}
              className="absolute inset-0 size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
        {c.caption && (
          <p className="mt-3 text-center text-sm text-stone-500">{c.caption}</p>
        )}
      </div>
    </section>
  );
}
