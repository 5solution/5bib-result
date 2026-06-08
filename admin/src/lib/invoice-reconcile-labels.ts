/**
 * F-076 — VN dictionary (Display Convention CLAUDE.md):
 * Backend returns raw enum, frontend maps to VN labels at render layer.
 */

export const BUCKET_LABEL = {
  OK: '🟢 Đã xuất',
  SYNC_LAG: '🟡 DB chưa sync',
  UNISSUED: '🔴 Chưa xuất',
  DUPLICATE: '🔥 Trùng hóa đơn',
} as const;

export const BUCKET_REASON = {
  OK: 'Đã có hóa đơn MISA + DB match',
  SYNC_LAG:
    'MISA đã xuất hóa đơn rồi nhưng vat_ref bên DB chưa update',
  UNISSUED:
    'DB paid nhưng MISA chưa thấy hóa đơn — cần check legacy publish',
  DUPLICATE:
    'MISA có ≥2 hóa đơn gốc cùng order — DEV test local hoặc retry bug',
} as const;

export const LAYER2_STATUS_LABEL = {
  OK: 'MISA verify OK',
  DEGRADED: 'MISA chậm (retry success)',
  UNAVAILABLE:
    'MISA không kết nối được — báo cáo chỉ dựa Layer 1 (DB)',
} as const;

export const SEVERITY_LABEL = {
  INFO: 'Bình thường',
  WARN: 'Cảnh báo',
  CRITICAL: 'Khẩn cấp',
} as const;

export type BucketKey = keyof typeof BUCKET_LABEL;
export type Layer2Status = keyof typeof LAYER2_STATUS_LABEL;
export type SeverityKey = keyof typeof SEVERITY_LABEL;
