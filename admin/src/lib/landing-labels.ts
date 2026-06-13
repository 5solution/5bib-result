/**
 * FEATURE-083 — VN display dictionaries for the Race Landing builder.
 * Display Convention: never render raw enum in JSX text — map through here.
 */

export const LANDING_STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  published: 'Đã đăng',
  unpublished: 'Đã gỡ',
  archived: 'Đã xoá',
};

export const SECTION_TYPE_LABEL: Record<string, string> = {
  hero: 'Hero (đầu trang)',
  about: 'Giới thiệu',
  course: 'Cung đường',
  schedule: 'Lịch trình',
  pricing: 'Bảng giá vé',
  results_embed: 'Kết quả',
  photos_embed: 'Tìm ảnh (5pix)',
  gallery: 'Thư viện ảnh & video',
  sponsors: 'Nhà tài trợ',
  contact_social: 'Liên hệ & Zalo/FB',
};

/** Allowed variants per type (mirror backend VARIANTS_BY_TYPE / BR-83-07). */
export const VARIANTS_BY_TYPE: Record<string, string[]> = {
  hero: ['video', 'image', 'text', 'split'],
  about: ['image-right', 'image-left', 'stats'],
  course: ['default'],
  schedule: ['timeline', 'image'],
  pricing: ['default'],
  results_embed: ['default'],
  photos_embed: ['default'],
  gallery: ['bento', 'grid'],
  sponsors: ['tier', 'wall'],
  contact_social: ['default'],
};

export const VARIANT_LABEL: Record<string, string> = {
  video: 'Video nền',
  image: 'Ảnh nền',
  text: 'Chữ',
  split: 'Split (ảnh + nội dung)',
  'image-right': 'Ảnh bên phải',
  'image-left': 'Ảnh bên trái',
  stats: 'Số liệu nổi bật',
  timeline: 'Timeline (5BIB dựng)',
  bento: 'Bento grid',
  grid: 'Lưới đều',
  tier: 'Phân tầng',
  wall: 'Tường logo',
  default: 'Mặc định',
};

/** Sections whose content is auto-pulled from race data (read-only hint). */
export const AUTO_DATA_SECTIONS = new Set(['course', 'sponsors', 'results_embed']);

export const THEME_PRESETS: { id: string; label: string; main: string; sec: string }[] = [
  { id: 'velocity-orange', label: 'Velocity (cam/xanh)', main: '#ea580c', sec: '#1d4ed8' },
  { id: 'trail-green', label: 'Trail (lá/cyan)', main: '#166534', sec: '#06b6d4' },
  { id: 'ocean-blue', label: 'Biển (xanh/cyan)', main: '#0369a1', sec: '#06b6d4' },
  { id: 'sunset', label: 'Hoàng hôn (đỏ/cam)', main: '#dc2626', sec: '#f59e0b' },
  { id: 'royal', label: 'Tím (tím/hồng)', main: '#7c3aed', sec: '#db2777' },
];
