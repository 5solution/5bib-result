/**
 * FEATURE-027 — Promo Hub section type metadata.
 *
 * 9 section types defined per PRD BR-PH-04. UI display + default config
 * per type. Editor uses these defaults when admin adds a new section,
 * then admin fills in concrete values via `SectionConfigDialog`.
 *
 * Backend stores `config` as `Record<string, unknown>` (loose schema —
 * type-specific shape evolves without DB migration). Frontend renders
 * each section type with its own React component on the public site
 * (Phase A3 work).
 */

import {
  Sparkles,
  Calendar,
  Trophy,
  Megaphone,
  MousePointerClick,
  Handshake,
  BarChart3,
  FileText,
  Medal,
  type LucideIcon,
} from "lucide-react";

export type SectionType =
  | "hero"
  | "race_calendar"
  | "featured_races"
  | "promo_banner"
  | "cta_buttons"
  | "sponsors"
  | "stats"
  | "rich_text"
  | "recent_results";

export const SECTION_TYPES: SectionType[] = [
  "hero",
  "race_calendar",
  "featured_races",
  "promo_banner",
  "cta_buttons",
  "sponsors",
  "stats",
  "rich_text",
  "recent_results",
];

export type SectionTypeMeta = {
  type: SectionType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultConfig: Record<string, unknown>;
};

export const SECTION_TYPE_META: Record<SectionType, SectionTypeMeta> = {
  hero: {
    type: "hero",
    label: "Hero",
    description: "Tiêu đề lớn + ảnh nền + CTA chính.",
    icon: Sparkles,
    defaultConfig: {
      title: "",
      subtitle: "",
      backgroundImage: "",
      ctaLabel: "",
      ctaUrl: "",
      align: "center",
    },
  },
  race_calendar: {
    type: "race_calendar",
    label: "Lịch giải đấu",
    description: "Hiển thị danh sách giải sắp tới từ Races collection.",
    icon: Calendar,
    defaultConfig: {
      title: "Lịch giải sắp tới",
      limit: 6,
      filter: { status: "pre_race" },
    },
  },
  featured_races: {
    type: "featured_races",
    label: "Giải nổi bật",
    description: "Curated race highlights (admin chọn race IDs cụ thể).",
    icon: Trophy,
    defaultConfig: {
      title: "Giải nổi bật",
      raceIds: [],
    },
  },
  promo_banner: {
    type: "promo_banner",
    label: "Banner khuyến mãi",
    description: "Banner promo full-width với link CTA.",
    icon: Megaphone,
    defaultConfig: {
      imageUrl: "",
      linkUrl: "",
      alt: "",
    },
  },
  cta_buttons: {
    type: "cta_buttons",
    label: "Nút CTA",
    description: "Hàng nút bấm — đăng ký / xem thêm / liên hệ.",
    icon: MousePointerClick,
    defaultConfig: {
      title: "",
      buttons: [
        { label: "Đăng ký ngay", url: "", variant: "primary" },
      ],
    },
  },
  sponsors: {
    type: "sponsors",
    label: "Nhà tài trợ",
    description: "Hàng logo nhà tài trợ — query từ Sponsors collection.",
    icon: Handshake,
    defaultConfig: {
      title: "Đối tác đồng hành",
      levels: ["diamond", "gold", "silver"],
    },
  },
  stats: {
    type: "stats",
    label: "Số liệu thống kê",
    description: "Card số nổi bật (số VĐV / giải đã tổ chức / huy chương).",
    icon: BarChart3,
    defaultConfig: {
      title: "",
      items: [
        { label: "VĐV đã tham gia", value: "94K+" },
        { label: "Giải đã tổ chức", value: "195" },
      ],
    },
  },
  rich_text: {
    type: "rich_text",
    label: "Văn bản tự do",
    description: "Khối rich-text (sanitized HTML).",
    icon: FileText,
    defaultConfig: {
      title: "",
      html: "<p></p>",
    },
  },
  recent_results: {
    type: "recent_results",
    label: "Kết quả gần đây",
    description: "Snapshot kết quả VĐV race vừa diễn ra.",
    icon: Medal,
    defaultConfig: {
      title: "Kết quả mới",
      limit: 5,
      raceId: "",
    },
  },
};
