/**
 * F-019 — Awards module constants (admin scope-local).
 *
 * 5 presets + 8 podium states + 3 tiers + 7 patterns + thresholds.
 * Pattern reference: F-013 `kiosk.constant.ts` (single source of truth).
 *
 * KHÔNG hardcode magic numbers — service code reads from awards.constant.ts.
 */

export const PODIUM_STATES = [
  'RAW_RESULT',
  'AG_COMPUTED',
  'WARNINGS_GENERATED',
  'BTC_REVIEW',
  'PODIUM_DRAFT',
  'PODIUM_LOCKED',
  'PODIUM_PUBLISHED',
  'DISPUTE_OPEN',
  'PODIUM_FINAL',
] as const;
export type PodiumState = (typeof PODIUM_STATES)[number];

/** BR-AG-23 — forward-only matrix (mirror of backend). */
export const ALLOWED_TRANSITIONS: Record<PodiumState, PodiumState[]> = {
  RAW_RESULT: ['AG_COMPUTED'],
  AG_COMPUTED: ['WARNINGS_GENERATED'],
  WARNINGS_GENERATED: ['BTC_REVIEW'],
  BTC_REVIEW: ['PODIUM_DRAFT'],
  PODIUM_DRAFT: ['PODIUM_LOCKED'],
  PODIUM_LOCKED: ['PODIUM_PUBLISHED'],
  PODIUM_PUBLISHED: ['DISPUTE_OPEN', 'PODIUM_FINAL'],
  DISPUTE_OPEN: ['AG_COMPUTED'],
  PODIUM_FINAL: [],
};

/**
 * F-019 Anomaly patterns A-G (v1) + H VENDOR_MISMATCH (v2 cross-check layer).
 * Pattern H emitted khi 5BIB top-3 AG vs Vendor top-3 lệch ≥1 BIB.
 */
export const ANOMALY_PATTERNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type AnomalyPattern = (typeof ANOMALY_PATTERNS)[number];

/** F-019 v2 — render label/icon for Pattern H VENDOR_MISMATCH. */
export const PATTERN_LABELS: Record<AnomalyPattern, { icon: string; label: string }> = {
  A: { icon: 'A', label: 'PHANTOM finish' },
  B: { icon: 'B', label: 'Course cut suspicion' },
  C: { icon: 'C', label: 'DSQ pending review' },
  D: { icon: 'D', label: 'CUTOFF risk' },
  E: { icon: 'E', label: 'Duplicate finish' },
  F: { icon: 'F', label: 'Wave start mismatch' },
  G: { icon: 'G', label: 'Pace impossibility' },
  H: { icon: 'H', label: 'Vendor mismatch (5BIB vs Vendor cross-check)' },
};

export const TIERS = [1, 2, 3] as const;
export type Tier = (typeof TIERS)[number];

export const RESOLUTIONS = ['pending', 'ignored', 'fixed', 'btc_override'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const GENDERS = ['M', 'F'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * F-020 BR-AG-43 — discriminator AG vs OVERALL podium.
 *  - `'AG'` (default): nhóm tuổi (1 doc per ageGroupKey × gender).
 *  - `'OVERALL'`: top chung cuộc per course, gender = 'mixed'.
 */
export const PODIUM_TYPES = ['AG', 'OVERALL'] as const;
export type PodiumType = (typeof PODIUM_TYPES)[number];

/** F-020 — sentinel `ageGroupKey` cho OVERALL podium. */
export const OVERALL_AGE_GROUP_KEY = '__OVERALL__';

/**
 * F-020 — gender mở rộng `'mixed'` cho OVERALL. Frontend filter UI vẫn dùng
 * `Gender = 'M' | 'F'` (chỉ AG bucket); OVERALL không filter theo gender.
 */
export type PodiumGender = Gender | 'mixed';

/** BR-AG-19 LOCKED — confidence → tier mapping. */
export const TIER_THRESHOLDS = {
  LEVEL_1_BLOCK_MIN: 0.8,
  LEVEL_2_FLAG_MIN: 0.5,
} as const;

export function tierFromConfidence(c: number): Tier {
  if (c >= TIER_THRESHOLDS.LEVEL_1_BLOCK_MIN) return 1;
  if (c >= TIER_THRESHOLDS.LEVEL_2_FLAG_MIN) return 2;
  return 3;
}

export const PRESET_KEYS = [
  'vn_road_default',
  'road_5_year',
  'trail_itra',
  'trail_lite',
  'open_only',
] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export const COMPOUNDING_MODES = ['compounding', 'mutually_exclusive'] as const;
export type CompoundingMode = (typeof COMPOUNDING_MODES)[number];

/** UX warning threshold for PDF batch export (BR-AG-34). */
export const PDF_BATCH_WARNING_THRESHOLD = 50;

/** Cache stale time mirroring backend Redis 60s TTL (TanStack staleTime ms). */
export const QUERY_STALE_TIME_MS = 60_000;
