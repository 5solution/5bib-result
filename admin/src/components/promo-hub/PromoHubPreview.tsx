"use client";

/**
 * FEATURE-027 HOTFIX-04 — PromoHubPreview với REAL inline rendering.
 *
 * Trước (Phase A2): mock card chỉ hiển thị icon + label.
 * Giờ: render từng section với visual gần giống public site
 *   - Hero: gradient bg + tiêu đề + CTA
 *   - Stats: number cards
 *   - CTA buttons: button row real
 *   - FAQ: accordion preview
 *   - Countdown: số đếm ngược
 *   - Social links: icon row
 *   - Rich text: HTML render với prose
 *   - Image gallery: ảnh thumbnail
 *   - Testimonial: quote card
 *   - v.v.
 *
 * + Two-way sync:
 *   - Click section trên preview → callback onSectionClick → scroll tới edit card
 *   - Highlighted section (currently editing) → blue ring outline
 *
 * Closes UX feedback Danny 2026-05-14:
 *   "muốn khi chúng nó thao tác thì có preview và có thể thao tác trên preview"
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Pencil,
  MousePointerClick,
  ChevronDown,
} from "lucide-react";
import { SECTION_TYPE_META, type SectionType } from "./section-types";
import type { EditorSection } from "./SectionCard";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  sections: EditorSection[];
  primaryColor?: string;
  secondaryColor?: string;
  onSectionClick?: (sectionId: string) => void;
  highlightedSectionId?: string | null;
};

export function PromoHubPreview({
  title,
  sections,
  primaryColor,
  secondaryColor,
  onSectionClick,
  highlightedSectionId,
}: Props) {
  const visible = sections.filter((s) => s.visible);
  const primary = primaryColor ?? "#1d4ed8";
  const secondary = secondaryColor ?? "#ea580c";

  // CSS custom properties theme — passed down to inline preview
  const themeStyle: React.CSSProperties = {
    // @ts-expect-error — CSS custom properties typing
    "--prev-primary": primary,
    "--prev-secondary": secondary,
  };

  return (
    <div
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
      style={themeStyle}
    >
      <div
        className="border-b p-3"
        style={{ borderTopColor: primary, borderTopWidth: 4 }}
      >
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="font-semibold">Preview trực tiếp</span>
          <span>
            {visible.length}/{sections.length} hiển thị
          </span>
        </div>
        <div className="mt-1 text-base font-bold leading-tight">
          {title || "(Chưa có tiêu đề)"}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <MousePointerClick className="size-3" />
          Click section bất kỳ để mở chỉnh sửa
        </div>
      </div>

      <div className="max-h-[800px] overflow-y-auto bg-stone-50">
        {sections.length === 0 && (
          <div className="m-4 rounded-lg border border-dashed bg-muted/30 py-8 text-center text-xs text-muted-foreground">
            Chưa có section nào.
            <br />
            Thêm section ở cột trái để bắt đầu.
          </div>
        )}

        {sections.map((s) => {
          const isHighlighted = s._id === highlightedSectionId;
          return (
            <button
              type="button"
              key={s._id}
              onClick={() => onSectionClick?.(s._id)}
              className={cn(
                "group relative block w-full text-left transition-all",
                !s.visible && "opacity-40 grayscale",
                isHighlighted && "ring-4 ring-[var(--admin-blue)] ring-inset",
                onSectionClick && "cursor-pointer hover:ring-2 hover:ring-[var(--admin-blue)]/40 hover:ring-inset",
              )}
              disabled={!onSectionClick}
            >
              <SectionPreview section={s} />

              {/* Hover overlay với label + edit hint */}
              {onSectionClick && (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Badge className="bg-[var(--admin-blue)] text-white shadow-md">
                    <Pencil className="mr-1 size-3" />
                    {SECTION_TYPE_META[s.type].label}
                  </Badge>
                </div>
              )}

              {/* Hidden indicator */}
              {!s.visible && (
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center bg-gradient-to-b from-stone-900/70 to-transparent py-1.5 text-center">
                  <Badge variant="outline" className="border-white/30 bg-white/90 text-[10px] text-stone-700">
                    <EyeOff className="mr-1 size-3" /> Đã ẩn
                  </Badge>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────── Section-specific inline preview ─────────────── */

function SectionPreview({ section }: { section: EditorSection }) {
  const c = section.config as Record<string, unknown>;

  switch (section.type as SectionType) {
    case "hero":
      return <HeroPreview config={c} />;
    case "stats":
      return <StatsPreview config={c} />;
    case "cta_buttons":
      return <CtaButtonsPreview config={c} />;
    case "promo_banner":
      return <PromoBannerPreview config={c} />;
    case "sponsors":
      return <SponsorsPreview config={c} />;
    case "race_calendar":
      return <RaceCalendarPreview config={c} />;
    case "featured_races":
      return <FeaturedRacesPreview config={c} />;
    case "recent_results":
      return <RecentResultsPreview config={c} />;
    case "rich_text":
      return <RichTextPreview config={c} />;
    case "link_grid":
      return <LinkGridPreview config={c} />;
    case "social_links":
      return <SocialLinksPreview config={c} />;
    case "faq":
      return <FaqPreview config={c} />;
    case "countdown":
      return <CountdownPreview config={c} />;
    case "video_embed":
      return <VideoEmbedPreview config={c} />;
    case "image_gallery":
      return <ImageGalleryPreview config={c} />;
    case "testimonial":
      return <TestimonialPreview config={c} />;
    case "map_embed":
      return <MapEmbedPreview config={c} />;
    case "schedule_timeline":
      return <SchedulePreview config={c} />;
    case "form_embed":
      return <FormEmbedPreview config={c} />;
    default:
      return <FallbackPreview type={section.type} />;
  }
}

/* ─────────────── Helpers ─────────────── */

type Cfg = Record<string, unknown>;
const str = (c: Cfg, k: string): string => (c[k] as string | undefined) ?? "";
const num = (c: Cfg, k: string, d = 0): number => (c[k] as number | undefined) ?? d;

function SectionHeading({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <h3 className="mb-2 px-4 text-sm font-bold tracking-tight">{children}</h3>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-3 rounded border border-dashed bg-muted/30 p-3 text-center text-[10px] text-muted-foreground">
      {children}
    </div>
  );
}

/* ─────────────── Section preview components ─────────────── */

function HeroPreview({ config }: { config: Cfg }) {
  const title = str(config, "title");
  const subtitle = str(config, "subtitle");
  const bg = str(config, "backgroundImage");
  const ctaLabel = str(config, "ctaLabel");
  const align = str(config, "align") || "center";
  const alignCls = align === "left" ? "items-start text-left" : align === "right" ? "items-end text-right" : "items-center text-center";
  return (
    <div
      className={`flex min-h-[140px] flex-col justify-center p-4 text-white ${alignCls}`}
      style={
        bg
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.65)), url(${encodeURI(bg)})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { background: "linear-gradient(135deg, var(--prev-primary), var(--prev-secondary))" }
      }
    >
      {title ? (
        <div className="text-base font-black leading-tight">{title}</div>
      ) : (
        <div className="text-base font-black leading-tight opacity-60">(Chưa nhập tiêu đề)</div>
      )}
      {subtitle && <div className="mt-1 text-xs opacity-90">{subtitle}</div>}
      {ctaLabel && (
        <div className="mt-2">
          <span className="inline-block rounded bg-white px-3 py-1 text-[10px] font-bold uppercase text-black">
            {ctaLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function StatsPreview({ config }: { config: Cfg }) {
  const items = (config.items as Array<{ label: string; value: string }>) ?? [];
  if (items.length === 0) return <EmptyState>Chưa có số liệu</EmptyState>;
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title")}</SectionHeading>
      <div className="grid grid-cols-2 gap-2 px-4 md:grid-cols-4">
        {items.slice(0, 4).map((it, i) => (
          <div key={i} className="rounded border bg-stone-50 p-2 text-center">
            <div className="font-mono text-base font-black text-[var(--prev-primary)]">
              {it.value || "—"}
            </div>
            <div className="mt-0.5 text-[9px] uppercase text-stone-500">
              {it.label || "(label)"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaButtonsPreview({ config }: { config: Cfg }) {
  const buttons = (config.buttons as Array<{ label: string; variant: string }>) ?? [];
  if (buttons.length === 0) return <EmptyState>Chưa có nút CTA</EmptyState>;
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title")}</SectionHeading>
      <div className="flex flex-wrap justify-center gap-2 px-4">
        {buttons.map((b, i) => {
          const cls =
            b.variant === "secondary"
              ? "bg-[var(--prev-secondary)] text-white"
              : b.variant === "outline"
                ? "border-2 border-[var(--prev-primary)] text-[var(--prev-primary)]"
                : "bg-[var(--prev-primary)] text-white";
          return (
            <span
              key={i}
              className={`rounded-md px-3 py-1.5 text-[10px] font-bold uppercase ${cls}`}
            >
              {b.label || "(label)"}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PromoBannerPreview({ config }: { config: Cfg }) {
  const url = str(config, "imageUrl");
  if (!url) return <EmptyState>Chưa có ảnh banner</EmptyState>;
  return (
    <div className="bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={encodeURI(url)} alt={str(config, "alt")} className="block w-full rounded" />
    </div>
  );
}

function SponsorsPreview({ config }: { config: Cfg }) {
  const levels = (config.levels as string[]) ?? [];
  return (
    <div className="bg-stone-100 p-4">
      <SectionHeading>{str(config, "title") || "Nhà tài trợ"}</SectionHeading>
      <div className="flex flex-wrap items-center justify-center gap-3 px-4">
        {levels.map((lvl, i) => (
          <div
            key={i}
            className="grid h-10 w-20 place-items-center rounded border bg-white text-[9px] uppercase text-stone-400"
          >
            {lvl === "diamond" ? "💎" : lvl === "gold" ? "🥇" : "🥈"} {lvl}
          </div>
        ))}
        {levels.length === 0 && (
          <span className="text-[10px] text-muted-foreground">
            Logo sẽ load từ Sponsors collection
          </span>
        )}
      </div>
    </div>
  );
}

function RaceCalendarPreview({ config }: { config: Cfg }) {
  const limit = num(config, "limit", 6);
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title") || "Lịch giải sắp tới"}</SectionHeading>
      <div className="grid grid-cols-3 gap-2 px-4">
        {Array.from({ length: Math.min(limit, 6) }).map((_, i) => (
          <div key={i} className="aspect-[16/12] rounded border bg-stone-100 p-1.5">
            <div className="h-3/5 rounded bg-stone-200" />
            <div className="mt-1 h-2 w-3/4 rounded bg-stone-300" />
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-[10px] text-muted-foreground">
        Auto-sync từ Races collection
      </div>
    </div>
  );
}

function FeaturedRacesPreview({ config }: { config: Cfg }) {
  const ids = (config.raceIds as string[]) ?? [];
  return (
    <div className="bg-stone-100 p-4">
      <SectionHeading>{str(config, "title") || "Giải nổi bật"}</SectionHeading>
      <div className="grid grid-cols-2 gap-2 px-4">
        {ids.slice(0, 4).map((_, i) => (
          <div
            key={i}
            className="aspect-[16/9] rounded bg-gradient-to-br from-stone-300 to-stone-500"
          />
        ))}
        {ids.length === 0 && (
          <div className="col-span-2 rounded border border-dashed bg-white p-3 text-center text-[10px] text-muted-foreground">
            Paste race ObjectIds để hiển thị
          </div>
        )}
      </div>
    </div>
  );
}

function RecentResultsPreview({ config }: { config: Cfg }) {
  const limit = num(config, "limit", 5);
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title") || "Kết quả mới"}</SectionHeading>
      <div className="mx-4 overflow-hidden rounded border">
        <div className="bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase text-stone-600">
          # · VĐV · BIB · Thời gian
        </div>
        {Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 border-t px-2 py-1">
            <span className="font-mono text-xs font-bold text-[var(--prev-primary)]">
              {i + 1}
            </span>
            <span className="flex-1 text-[10px]">Người chạy {i + 1}</span>
            <span className="font-mono text-[10px] text-stone-500">
              {(i + 3).toString().padStart(2, "0")}:34
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RichTextPreview({ config }: { config: Cfg }) {
  const html = str(config, "html");
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title")}</SectionHeading>
      {html ? (
        <div
          className="prose prose-sm max-w-none px-4 [&_*]:!my-1"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <EmptyState>Chưa nhập nội dung</EmptyState>
      )}
    </div>
  );
}

function LinkGridPreview({ config }: { config: Cfg }) {
  const items = (config.items as Array<{ imageUrl: string; title: string }>) ?? [];
  const cols = num(config, "columns", 3);
  if (items.length === 0) return <EmptyState>Chưa có liên kết</EmptyState>;
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title")}</SectionHeading>
      <div className={`grid gap-2 px-4 grid-cols-${Math.min(cols, 4)}`}>
        {items.slice(0, 6).map((it, i) => (
          <div key={i} className="overflow-hidden rounded border">
            {it.imageUrl ? (
              <div
                className="aspect-square bg-stone-200 bg-cover bg-center"
                style={{ backgroundImage: `url(${encodeURI(it.imageUrl)})` }}
              />
            ) : (
              <div className="aspect-square bg-stone-200" />
            )}
            <div className="truncate p-1.5 text-[10px] font-semibold">
              {it.title || "(title)"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialLinksPreview({ config }: { config: Cfg }) {
  const links = (config.links as Array<{ platform: string; url: string }>) ?? [];
  if (links.length === 0) return <EmptyState>Chưa có liên kết MXH</EmptyState>;
  const ICONS: Record<string, string> = {
    facebook: "📘",
    instagram: "📷",
    tiktok: "🎵",
    youtube: "▶️",
    twitter: "🐦",
    linkedin: "💼",
    telegram: "✈️",
    zalo: "💬",
    email: "✉️",
    custom: "🔗",
  };
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title")}</SectionHeading>
      <div className="flex justify-center gap-2 px-4">
        {links.map((l, i) => (
          <span
            key={i}
            className="grid size-8 place-items-center rounded-full bg-stone-200 text-sm"
          >
            {ICONS[l.platform] ?? "🔗"}
          </span>
        ))}
      </div>
    </div>
  );
}

function FaqPreview({ config }: { config: Cfg }) {
  const items = (config.items as Array<{ question: string; answer: string }>) ?? [];
  const [open, setOpen] = useState<number | null>(0);
  if (items.length === 0) return <EmptyState>Chưa có câu hỏi</EmptyState>;
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title") || "Câu hỏi thường gặp"}</SectionHeading>
      <div className="space-y-1 px-4">
        {items.slice(0, 4).map((q, i) => (
          <div key={i} className="rounded border bg-stone-50">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(open === i ? null : i);
              }}
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[11px] font-semibold"
            >
              <span className="flex-1">{q.question || "(câu hỏi)"}</span>
              <ChevronDown
                className={cn(
                  "size-3 shrink-0 transition-transform",
                  open === i && "rotate-180",
                )}
              />
            </button>
            {open === i && q.answer && (
              <div className="border-t px-2 py-1.5 text-[10px] text-stone-600">
                {q.answer.slice(0, 200)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CountdownPreview({ config }: { config: Cfg }) {
  const target = str(config, "targetDate");
  if (!target) return <EmptyState>Chưa set ngày countdown</EmptyState>;
  const ms = new Date(target).getTime() - Date.now();
  const days = Math.max(0, Math.floor(ms / 86400000));
  return (
    <div
      className="p-4 text-center text-white"
      style={{ background: "linear-gradient(135deg, var(--prev-primary), var(--prev-secondary))" }}
    >
      <div className="text-xs font-bold">{str(config, "title")}</div>
      <div className="mt-1 font-mono text-2xl font-black">
        {ms <= 0 ? "🎉 Sự kiện đã bắt đầu" : `Còn ${days} ngày`}
      </div>
    </div>
  );
}

function VideoEmbedPreview({ config }: { config: Cfg }) {
  if (!str(config, "videoId")) return <EmptyState>Chưa có video</EmptyState>;
  return (
    <div className="bg-white p-3">
      <SectionHeading>{str(config, "title")}</SectionHeading>
      <div className="mx-4 grid aspect-video place-items-center rounded bg-stone-800 text-stone-400">
        ▶️ Video {str(config, "provider") || "youtube"}
      </div>
    </div>
  );
}

function ImageGalleryPreview({ config }: { config: Cfg }) {
  const images = (config.images as Array<{ url: string }>) ?? [];
  if (images.length === 0) return <EmptyState>Chưa có ảnh</EmptyState>;
  const cols = num(config, "columns", 3);
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title")}</SectionHeading>
      <div className={`grid gap-1 px-4 grid-cols-${Math.min(cols, 4)}`}>
        {images.slice(0, 8).map((img, i) =>
          img.url ? (
            <div
              key={i}
              className="aspect-square bg-stone-200 bg-cover bg-center"
              style={{ backgroundImage: `url(${encodeURI(img.url)})` }}
            />
          ) : (
            <div key={i} className="aspect-square bg-stone-200" />
          ),
        )}
      </div>
    </div>
  );
}

function TestimonialPreview({ config }: { config: Cfg }) {
  const items = (config.items as Array<{ quote: string; author: string; role: string }>) ?? [];
  if (items.length === 0) return <EmptyState>Chưa có quote</EmptyState>;
  return (
    <div className="bg-stone-100 p-4">
      <SectionHeading>{str(config, "title")}</SectionHeading>
      <div className="mx-4 space-y-2">
        {items.slice(0, 2).map((it, i) => (
          <figure key={i} className="rounded-lg border bg-white p-2.5 text-[11px]">
            <blockquote className="italic text-stone-700">
              "{it.quote || "(quote)"}"
            </blockquote>
            <figcaption className="mt-1 text-[10px] text-stone-500">
              — {it.author || "Khách hàng"}
              {it.role && `, ${it.role}`}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function MapEmbedPreview({ config }: { config: Cfg }) {
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title") || "Địa điểm"}</SectionHeading>
      <div className="mx-4 grid aspect-[16/9] place-items-center rounded bg-stone-200 text-xs text-stone-500">
        📍 {str(config, "address") || "Bản đồ Google Maps"}
      </div>
    </div>
  );
}

function SchedulePreview({ config }: { config: Cfg }) {
  const items = (config.items as Array<{ time: string; title: string }>) ?? [];
  if (items.length === 0) return <EmptyState>Chưa có mốc thời gian</EmptyState>;
  return (
    <div className="bg-white p-4">
      <SectionHeading>{str(config, "title") || "Lịch trình"}</SectionHeading>
      <ol className="mx-4 space-y-1 border-l-2 border-[var(--prev-primary)] pl-3">
        {items.slice(0, 5).map((it, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[15px] top-1 size-2 rounded-full bg-[var(--prev-primary)] ring-2 ring-white" />
            <div className="font-mono text-[10px] font-bold text-[var(--prev-primary)]">
              {it.time || "—"}
            </div>
            <div className="text-[11px] font-semibold">{it.title || "(title)"}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FormEmbedPreview({ config }: { config: Cfg }) {
  return (
    <div className="bg-stone-100 p-4 text-center">
      <SectionHeading>{str(config, "title") || "Đăng ký nhận tin"}</SectionHeading>
      {str(config, "description") && (
        <div className="px-4 text-[10px] text-stone-600">
          {str(config, "description")}
        </div>
      )}
      <div className="mt-2 inline-block rounded bg-[var(--prev-primary)] px-4 py-1.5 text-[10px] font-bold uppercase text-white">
        {str(config, "title") || "Mở form"}
      </div>
    </div>
  );
}

function FallbackPreview({ type }: { type: string }) {
  return <EmptyState>Section type "{type}" chưa có preview render</EmptyState>;
}
