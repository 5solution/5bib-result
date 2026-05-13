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
  LayoutGrid,
  Share2,
  HelpCircle,
  Clock,
  PlayCircle,
  Images,
  Quote,
  MapPin,
  ListChecks,
  Mail,
  type LucideIcon,
} from "lucide-react";

export type SectionType =
  // Phase A1 — core (9)
  | "hero"
  | "race_calendar"
  | "featured_races"
  | "promo_banner"
  | "cta_buttons"
  | "sponsors"
  | "stats"
  | "rich_text"
  | "recent_results"
  // Phase B — landing-page expansion (10)
  | "link_grid"
  | "social_links"
  | "faq"
  | "countdown"
  | "video_embed"
  | "image_gallery"
  | "testimonial"
  | "map_embed"
  | "schedule_timeline"
  | "form_embed";

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
  "link_grid",
  "social_links",
  "faq",
  "countdown",
  "video_embed",
  "image_gallery",
  "testimonial",
  "map_embed",
  "schedule_timeline",
  "form_embed",
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

  /* ─────────── Phase B — Landing-page expansion ─────────── */

  link_grid: {
    type: "link_grid",
    label: "Lưới liên kết",
    description: "Grid card (ảnh + tiêu đề + URL) cho sản phẩm / shop / link ngoài.",
    icon: LayoutGrid,
    defaultConfig: {
      title: "",
      columns: 3,
      items: [
        { imageUrl: "", title: "", url: "" },
      ],
    },
  },
  social_links: {
    type: "social_links",
    label: "Mạng xã hội",
    description: "Hàng icon Facebook / TikTok / YouTube / Instagram / link tuỳ chỉnh.",
    icon: Share2,
    defaultConfig: {
      title: "",
      align: "center",
      links: [
        { platform: "facebook", url: "" },
      ],
    },
  },
  faq: {
    type: "faq",
    label: "Câu hỏi thường gặp",
    description: "Accordion Q&A — rules, refund, transport, BIB pickup.",
    icon: HelpCircle,
    defaultConfig: {
      title: "Câu hỏi thường gặp",
      items: [
        { question: "", answer: "" },
      ],
    },
  },
  countdown: {
    type: "countdown",
    label: "Đếm ngược",
    description: "Đếm ngược tới ngày race day / sự kiện.",
    icon: Clock,
    defaultConfig: {
      title: "Đếm ngược đến giờ G",
      targetDate: "",
      message: "Sự kiện đã bắt đầu!",
    },
  },
  video_embed: {
    type: "video_embed",
    label: "Video nhúng",
    description: "Nhúng YouTube / Vimeo cho promo video / recap.",
    icon: PlayCircle,
    defaultConfig: {
      title: "",
      provider: "youtube",
      videoId: "",
      caption: "",
    },
  },
  image_gallery: {
    type: "image_gallery",
    label: "Thư viện ảnh",
    description: "Grid ảnh kỷ niệm race / sự kiện trước.",
    icon: Images,
    defaultConfig: {
      title: "",
      columns: 3,
      images: [
        { url: "", alt: "" },
      ],
    },
  },
  testimonial: {
    type: "testimonial",
    label: "Cảm nhận",
    description: "Quote từ VĐV / Influencer / KOL.",
    icon: Quote,
    defaultConfig: {
      title: "",
      items: [
        { quote: "", author: "", role: "", avatarUrl: "" },
      ],
    },
  },
  map_embed: {
    type: "map_embed",
    label: "Bản đồ",
    description: "Nhúng Google Maps — địa điểm race start / venue.",
    icon: MapPin,
    defaultConfig: {
      title: "Địa điểm",
      embedUrl: "",
      address: "",
    },
  },
  schedule_timeline: {
    type: "schedule_timeline",
    label: "Lịch trình",
    description: "Timeline race day (4h00 mat-bib → 6h00 start → 14h00 award).",
    icon: ListChecks,
    defaultConfig: {
      title: "Lịch trình race day",
      items: [
        { time: "", title: "", description: "" },
      ],
    },
  },
  form_embed: {
    type: "form_embed",
    label: "Form nhúng",
    description: "Form thu thập email / lead (Google Form / Tally / Form 5BIB).",
    icon: Mail,
    defaultConfig: {
      title: "Đăng ký nhận tin",
      description: "",
      provider: "iframe",
      embedUrl: "",
    },
  },
};
