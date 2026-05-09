/**
 * F-007 Item #4 + #9 — Vietnamese microcopy single source of truth.
 *
 * Maps internal/EN status keys to Vietnamese display labels for all
 * race-day surfaces. Use `vnLabel(key, fallback?)` to look up safely with
 * fallback to raw key when not mapped (no XSS leak — keys are app-internal).
 *
 * BR-UX-29 — VN microcopy consistency 100% across F-005/F-006 surfaces.
 *
 * Server-Component-safe (no React imports). Pure constants + lookup fn.
 */

/** Health-badge / per-checkpoint status (AthleteFlowChart). */
export const VN_HEALTH_LABELS = {
  good: 'TỐT',
  warn: 'CHÚ Ý',
  fail: 'KIỂM TRA THIẾT BỊ',
  OK: 'TỐT',
  ATT: 'CHÚ Ý',
  CRIT: 'KIỂM TRA THIẾT BỊ',
} as const;

/** Alert severity (AlertFeedPanel + AlertDetailDialog). */
export const VN_SEVERITY_LABELS = {
  CRITICAL: 'NGHIÊM TRỌNG',
  HIGH: 'CAO',
  WARNING: 'CẢNH BÁO',
  INFO: 'THÔNG TIN',
  // Compact form used trong filter tabs (Artboard 3 spec):
  HIGH_SHORT: 'CAO',
  MED: 'TRUNG BÌNH',
  LOW: 'THẤP',
} as const;

/** Race-day lifecycle (StatusPill). */
export const VN_RACE_STATUS_LABELS = {
  draft: 'NHÁP',
  pre_race: 'TRƯỚC RACE',
  live: 'ĐANG DIỄN RA',
  ended: 'KẾT THÚC',
} as const;

/** Action verbs (buttons, CTAs). */
export const VN_ACTION_LABELS = {
  'force-refresh': 'Cập nhật ngay',
  'manual-mode': 'Kéo thả thủ công',
  'discover': 'Phát hiện checkpoint',
  'snap': 'Bám đường tự động',
  'export-csv': 'Tải xuống CSV',
  'export-clipboard': 'Sao chép',
  'export-print': 'In',
  'upload-gpx': 'Tải lên GPX/KML',
  'save': 'Lưu',
  'cancel': 'Huỷ',
} as const;

/** Course-map / wizard step labels. */
export const VN_WIZARD_LABELS = {
  step1: 'Cơ bản',
  step2: 'Discover RR',
  step3: 'Upload GPX',
  step4: 'Manual drag',
  state_done: 'Hoàn tất',
  state_pending: 'Chờ',
  state_active: 'Đang làm',
  state_blocked: 'Bị chặn',
} as const;

/**
 * Centralized label lookup. Falls back gracefully:
 *  1. Health table
 *  2. Severity table
 *  3. Race status table
 *  4. Action table
 *  5. Wizard table
 *  6. Provided `fallback` (caller-supplied)
 *  7. The raw key (last resort — guarantees never returns undefined)
 */
export function vnLabel(key: string, fallback?: string): string {
  const tables: Record<string, string>[] = [
    VN_HEALTH_LABELS as Record<string, string>,
    VN_SEVERITY_LABELS as Record<string, string>,
    VN_RACE_STATUS_LABELS as Record<string, string>,
    VN_ACTION_LABELS as Record<string, string>,
    VN_WIZARD_LABELS as Record<string, string>,
  ];
  for (const t of tables) {
    if (Object.prototype.hasOwnProperty.call(t, key)) return t[key];
  }
  return fallback ?? key;
}

/** Type-narrowed health lookup (no fallback to other tables). */
export function vnHealthLabel(
  k: keyof typeof VN_HEALTH_LABELS | string,
): string {
  return (VN_HEALTH_LABELS as Record<string, string>)[k] ?? String(k);
}

/** Type-narrowed severity lookup. */
export function vnSeverityLabel(
  k: keyof typeof VN_SEVERITY_LABELS | string,
): string {
  return (VN_SEVERITY_LABELS as Record<string, string>)[k] ?? String(k);
}
