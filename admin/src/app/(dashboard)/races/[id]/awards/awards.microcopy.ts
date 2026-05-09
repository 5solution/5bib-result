/**
 * F-019 — Vietnamese microcopy for Awards module.
 *
 * Pattern reference: F-013 `kiosk.microcopy.ts` — scope-local, NOT shared.
 * 100% VN strings (BR-AS — VN microcopy mandate).
 */

import type { PodiumState, AnomalyPattern, Tier, Resolution, PresetKey } from './awards.constant';

export const VN = {
  PAGE_TITLE: 'Lễ trao giải theo nhóm tuổi',
  PAGE_TITLE_SHORT: 'Trao giải',
  EMPTY_RACE_NOT_ENDED: 'Race đang LIVE / chưa kết thúc — AG podium sẽ hiển thị sau cut-off',
  EMPTY_NO_ATHLETES: 'Chưa có vận động viên FIN cho race này',
  EMPTY_FILTERED: 'Không có AG card khớp filter — thử mở rộng filter',
  ERROR_LOAD: 'Lỗi tải AG podium',
  RECOMPUTE_BUTTON: 'Tính lại AG',
  RECOMPUTE_TOOLTIP:
    'Trigger recompute AG manual (vd sau khi edit DOB của vận động viên). Sẽ skip courses có podium ở trạng thái LOCKED+.',

  BANNER_BLOCK_PREFIX: 'cảnh báo Mức 1 BLOCK',
  BANNER_FLAG_PREFIX: 'Mức 2 chờ ack',
  BANNER_INFO_PREFIX: 'Mức 3 thông tin',
  BANNER_OPEN_DRAWER: 'Mở drawer chi tiết',

  LOCK_BUTTON: 'Lock podium',
  PUBLISH_BUTTON: 'Phát hành công khai',
  EXPORT_PDF_BUTTON: 'Xuất PDF',
  OPEN_DISPUTE_BUTTON: 'Mở khiếu nại',
  ACK_BUTTON: 'Acknowledge',
  RESOLVE_BUTTON: 'Resolve',

  LOCK_DISABLED_TIP: (n: number) => `Còn ${n} cảnh báo Mức 1 chưa resolve — không thể lock`,
  ACK_DISABLED_TIP: (n: number) => `Còn ${n} cảnh báo Mức 2 chưa acknowledge — không thể lock`,
  COMPOUNDING_BADGE: 'Loại trừ overall top — slot AG trao xuống vị trí kế tiếp',

  PDF_BATCH_WARNING: (n: number) =>
    `Batch lớn (${n} files) — Phase 1 generate on-demand only, không auto-batch. Recommend export per-cự-ly.`,

  ACK_NOTE_LABEL: 'Ghi chú (bắt buộc, ≥5 ký tự)',
  ACK_EVIDENCE_LABEL: 'Đường dẫn evidence (tuỳ chọn)',
  RESOLUTION_LABEL: 'Cách xử lý',
  RESOLUTION_OPTIONS: {
    ignored: 'Bỏ qua (false positive)',
    fixed: 'Đã fix data',
    btc_override: 'BTC override',
  },

  PRESET_LABELS: {
    vn_road_default: 'VN Road Default (5 brackets × 2 gender)',
    road_5_year: 'Road 5-year (WMA quốc tế)',
    trail_itra: 'Trail ITRA (Espoir/Senior/V1/V2/V3)',
    trail_lite: 'Trail Lite (Open + 50+)',
    open_only: 'Open Only (5K/10K fun-run)',
  } as Record<PresetKey, string>,

  PATTERN_LABELS: {
    A: 'Pattern A — Thiếu finish chip',
    B: 'Pattern B — DNF status conflict',
    C: 'Pattern C — DSQ pending',
    D: 'Pattern D — CUTOFF marginal',
    E: 'Pattern E — Duplicate finish',
    F: 'Pattern F — Wave start mismatch',
    G: 'Pattern G — Pace bất khả thi',
    H: 'Pattern H — Vendor mismatch (5BIB top-3 AG vs Vendor top-3 lệch)',
  } as Record<AnomalyPattern, string>,

  STATE_LABELS: {
    RAW_RESULT: 'Raw kết quả',
    AG_COMPUTED: 'Đã tính AG',
    WARNINGS_GENERATED: 'Đã sinh cảnh báo',
    BTC_REVIEW: 'BTC đang review',
    PODIUM_DRAFT: 'Podium nháp',
    PODIUM_LOCKED: 'Podium đã khoá',
    PODIUM_PUBLISHED: 'Podium đã phát hành',
    DISPUTE_OPEN: 'Đang xử lý khiếu nại',
    PODIUM_FINAL: 'Podium FINAL',
  } as Record<PodiumState, string>,

  TIER_LABELS: {
    1: 'Mức 1 — BLOCK',
    2: 'Mức 2 — FLAG',
    3: 'Mức 3 — INFO',
  } as Record<Tier, string>,

  RESOLUTION_LABELS_FULL: {
    pending: 'Đang chờ xử lý',
    ignored: 'Đã bỏ qua',
    fixed: 'Đã fix',
    btc_override: 'BTC override',
  } as Record<Resolution, string>,

  PREDICTED_RANK_BANNER: (rank: number, group: string) =>
    `Vận động viên dự đoán rank #${rank} ${group} nếu fix Pattern A`,
  PREDICTED_RANK_ERROR_NOTE: (margin: number) =>
    `Sai số ước lượng ±${margin} phút (pace decay cuối race khác nhau)`,

  CONFIRM_DELETE: 'Xác nhận?',
  CONFIRM_TRANSITION: (from: PodiumState, to: PodiumState) =>
    `Chuyển trạng thái ${from} → ${to}?`,
  TRANSITION_NOTE_LABEL: 'Ghi chú (tuỳ chọn, ≥5 ký tự nếu nhập)',

  TOAST_RECOMPUTE_OK: 'Đã tính lại AG thành công',
  TOAST_RECOMPUTE_FAIL: 'Tính lại AG thất bại — thử lại sau',
  TOAST_PDF_GENERATING: 'Đang tạo PDF... (timeout 30s)',
  TOAST_ACK_OK: 'Đã acknowledge cảnh báo',
  TOAST_RESOLVE_OK: 'Đã resolve cảnh báo',
  TOAST_TRANSITION_OK: 'Đã chuyển trạng thái',
  TOAST_TRANSITION_CONFLICT: 'Trạng thái đã thay đổi — refresh và thử lại',
} as const;
