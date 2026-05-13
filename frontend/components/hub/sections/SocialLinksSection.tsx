/**
 * FEATURE-027 Phase B — Social Links section.
 *
 * Config: { title, align, links: [{ platform, url }] }
 *
 * Renders SVG inline icons (no extra dep). Supports common platforms +
 * "custom" with generic link icon.
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type SocialLink = { platform: string; url: string };
type SocialLinksConfig = {
  title?: string;
  align?: "left" | "center" | "right";
  links?: SocialLink[];
};

const PLATFORM_META: Record<
  string,
  { label: string; bg: string; svg: React.ReactNode }
> = {
  facebook: {
    label: "Facebook",
    bg: "bg-[#1877F2]",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89H7.898V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33V21.88C18.343 21.13 22 16.991 22 12z" />
      </svg>
    ),
  },
  instagram: {
    label: "Instagram",
    bg: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.069 1.646.069 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.069-4.85.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.647 2.163 15.267 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.175 8.796 2.163 12 2.163zm0 1.838c-3.141 0-3.503.012-4.74.068-.957.044-1.475.204-1.82.339-.457.178-.784.39-1.127.732-.343.343-.554.67-.732 1.128-.135.345-.295.863-.339 1.82-.056 1.237-.068 1.599-.068 4.74s.012 3.503.068 4.74c.044.957.204 1.475.339 1.82.178.457.39.784.732 1.127.343.343.67.554 1.127.732.345.135.863.295 1.82.339 1.237.056 1.599.068 4.74.068s3.503-.012 4.74-.068c.957-.044 1.475-.204 1.82-.339.457-.178.784-.39 1.127-.732.343-.343.554-.67.732-1.127.135-.345.295-.863.339-1.82.056-1.237.068-1.599.068-4.74s-.012-3.503-.068-4.74c-.044-.957-.204-1.475-.339-1.82-.178-.457-.39-.784-.732-1.127-.343-.343-.67-.554-1.127-.732-.345-.135-.863-.295-1.82-.339-1.237-.056-1.599-.068-4.74-.068zm0 3.135a4.864 4.864 0 110 9.728 4.864 4.864 0 010-9.728zm0 8.025a3.16 3.16 0 100-6.322 3.16 3.16 0 000 6.322zm6.151-8.211a1.137 1.137 0 11-2.274 0 1.137 1.137 0 012.274 0z" />
      </svg>
    ),
  },
  tiktok: {
    label: "TikTok",
    bg: "bg-black",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005.8 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.84-.1z" />
      </svg>
    ),
  },
  youtube: {
    label: "YouTube",
    bg: "bg-[#FF0000]",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  twitter: {
    label: "Twitter/X",
    bg: "bg-black",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  linkedin: {
    label: "LinkedIn",
    bg: "bg-[#0A66C2]",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  telegram: {
    label: "Telegram",
    bg: "bg-[#26A5E4]",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
      </svg>
    ),
  },
  zalo: {
    label: "Zalo",
    bg: "bg-[#0068FF]",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path d="M12.49 10.272c-.65 0-1.18.535-1.18 1.193 0 .658.53 1.193 1.18 1.193.65 0 1.18-.535 1.18-1.193 0-.658-.53-1.193-1.18-1.193zM12 1.5C6.21 1.5 1.5 6.21 1.5 12S6.21 22.5 12 22.5 22.5 17.79 22.5 12 17.79 1.5 12 1.5zm3.71 13.728c0 .264-.21.477-.47.477h-.47v-.275c-.41.275-.94.275-1.4.275-.93 0-1.81-.477-2.22-1.273-.13.477-.4.795-.81 1.034-.36.21-.81.31-1.21.31-.7 0-1.5-.36-1.97-1.06-.4-.6-.5-1.4-.2-2.1.31-.7 1.01-1.16 1.81-1.16.55 0 1.06.17 1.46.49V8.97c0-.27.21-.49.47-.49.27 0 .47.22.47.49v5.787c0 .26-.21.477-.47.477zm-3.39-2.31c-.4 0-.71.31-.71.71 0 .4.31.71.71.71s.71-.31.71-.71c0-.4-.31-.71-.71-.71z" />
      </svg>
    ),
  },
  email: {
    label: "Email",
    bg: "bg-stone-700",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
  },
  custom: {
    label: "Liên kết",
    bg: "bg-stone-500",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
};

export function SocialLinksSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as SocialLinksConfig;
  const links = (c.links ?? []).filter((l) => l.url);
  if (links.length === 0) return null;
  const align =
    c.align === "left" ? "justify-start" : c.align === "right" ? "justify-end" : "justify-center";

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.title && (
          <h2 className="mb-6 text-center font-[var(--promo-font)] text-xl font-bold">
            {c.title}
          </h2>
        )}
        <div className={`flex flex-wrap items-center gap-3 ${align}`}>
          {links.map((l, i) => {
            const meta = PLATFORM_META[l.platform] ?? PLATFORM_META.custom;
            return (
              <a
                key={i}
                href={l.url}
                target={l.url.startsWith("http") || l.url.startsWith("mailto:") ? "_blank" : undefined}
                rel="noopener noreferrer"
                aria-label={meta.label}
                data-promo-cta
                data-promo-section-id={section._id}
                data-promo-cta-label={meta.label}
                data-promo-cta-url={l.url}
                className={`grid size-11 place-items-center rounded-full text-white shadow-sm transition-transform hover:scale-110 ${meta.bg}`}
              >
                {meta.svg}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
