/**
 * F-019 PAUSE-CODER-08 — confidence thresholds + tier mapping.
 *
 * KHÔNG hardcode magic numbers trong logic code. Mọi tier classification +
 * pattern formula reference từ file này. Defaults từ Section B advisory §3
 * (Sports Domain Expert) + Section A advisory §4 (Race Ops Expert).
 *
 * BR-AG-19 LOCKED:
 *   confidence ≥ 0.8 → Mức 1 BLOCK (blocks podium lock until BTC resolve)
 *   0.5 ≤ confidence < 0.8 → Mức 2 FLAG (BTC explicit Acknowledge với note)
 *   confidence < 0.5 → Mức 3 INFO (display only)
 */

export const TIER_THRESHOLDS = {
  LEVEL_1_BLOCK_MIN: 0.8,
  LEVEL_2_FLAG_MIN: 0.5,
} as const;

export type WarningTier = 1 | 2 | 3;

/** BR-AG-19 — confidence → tier mapping. */
export function tierFromConfidence(c: number): WarningTier {
  if (c >= TIER_THRESHOLDS.LEVEL_1_BLOCK_MIN) return 1;
  if (c >= TIER_THRESHOLDS.LEVEL_2_FLAG_MIN) return 2;
  return 3;
}

/** Pattern A — thiếu đọc chip finish (~3-5% giải VN). */
export const PATTERN_A_THRESHOLDS = {
  LAST_SPLIT_RANK_HIGH: 3, // ≤ 3 → confidence 0.9
  LAST_SPLIT_RANK_MED: 10, // ≤ 10 → confidence 0.6
  CONFIDENCE_HIGH: 0.9,
  CONFIDENCE_MED: 0.6,
  CONFIDENCE_LOW: 0.3,
} as const;

/** Pattern B — DNF status conflict (status=DNF nhưng có finish chip read). */
export const PATTERN_B_CONFIDENCE = 0.95;

/** Pattern C — DSQ pending re-check. */
export const PATTERN_C_CONFIDENCE = 0.7;
export const PATTERN_C_PENDING_REGEX =
  /pending|review|investigation|đang xem xét|đang kiểm tra|chờ/i;

/** Pattern D — CUTOFF marginal (giáp ranh). */
export const PATTERN_D_THRESHOLDS = {
  MARGIN_TIGHT_MIN: 2, // < 2 phút → confidence 0.85
  MARGIN_LOOSE_MIN: 5, // < 5 phút → confidence 0.6
  CONFIDENCE_TIGHT: 0.85,
  CONFIDENCE_LOOSE: 0.6,
  CONFIDENCE_FAR: 0.3,
} as const;

/** Pattern E — Duplicate finish read. */
export const PATTERN_E_CONFIDENCE = 0.9;

/** Pattern F — Wave start mismatch. */
export const PATTERN_F_THRESHOLDS = {
  WAVE_START_TOLERANCE_SEC: 30,
  DISCREPANCY_HIGH_MIN: 5, // > 5 phút → confidence 0.85
  CONFIDENCE_HIGH: 0.85,
  CONFIDENCE_LOW: 0.4,
} as const;

/**
 * Pattern G — Pace impossibility.
 * Lower bound (sec/km) — pace nhỏ hơn này = bất khả thi.
 * Threshold raised vs Section B advisory cũ vì Hoàng Nguyên Thanh sub-2:25 = 3:24/km
 * → buffer generous tránh false positive cho elite.
 */
export const PATTERN_G_LOWER_BOUNDS_SEC_PER_KM = {
  road: 170, // 2:50/km
  trail: 240, // 4:00/km
  ultra: 240, // 4:00/km
  half_marathon: 170, // 2:50/km
} as const;

/** PDF cardinality warning threshold (BR-AG-34). */
export const PDF_BATCH_WARNING_THRESHOLD = 50;

/** PDF generation hard timeout (BR-AG-33). */
export const PDF_HARD_TIMEOUT_MS = 30_000;

/** Predicted rank scope — chỉ display ≤ top-3 (BR-AG-29 LOCKED). */
export const PREDICTED_RANK_DISPLAY_TOP_N = 3;

/** Error margin per loại race (BR-AG-31). */
export const PREDICTED_RANK_ERROR_MARGIN_MIN = {
  marathon: 3,
  half_marathon: 1,
  ultra_trail: 10,
  default: 3,
} as const;

/** Redis cache TTL (seconds). */
export const REDIS_TTL = {
  PODIUM_PREVIEW: 60,
  ANOMALIES: 60,
  PREDICTED_RANK: 60,
  COMPUTE_LOCK: 30, // SETNX anti-stampede
  STATE_LOCK: 5, // SETNX concurrent transition guard
} as const;

/** SSE heartbeat interval (port từ F-018). */
export const SSE_HEARTBEAT_MS = 25_000;

/** Auto-FINAL transition window after PUBLISHED (BR-AG-26 — 30 phút WA TR8). */
export const PUBLISHED_TO_FINAL_MS = 30 * 60 * 1000;
